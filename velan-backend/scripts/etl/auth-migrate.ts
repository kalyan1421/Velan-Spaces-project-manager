/**
 * Phase 4 — auth migration (AKS-212). Run BEFORE import.ts.
 *
 *   set -a; source .env; set +a
 *   npx ts-node scripts/etl/auth-migrate.ts [dataDir]
 *
 * For every legacy identity across the `users`, `workers`, and `managers`
 * exports it:
 *   - creates (or finds) a Supabase Auth user, keyed by email
 *   - upserts the `users` profile row with id = auth uid
 *   - records EVERY legacy doc id → that user in `legacy_user_map`
 * People appearing in multiple collections under the same email collapse to one
 * auth user; all their legacy ids still resolve. Identities without an email get
 * a profile row (generated uuid) but no login — flagged for manual onboarding.
 *
 * Set SEND_INVITES=true to email password-set invites instead of using a temp
 * password (requires SMTP configured in Supabase).
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { FsDoc } from './mappers';

const url = process.env.SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const DATA = process.argv[2] ?? join(__dirname, 'data');
const SEND_INVITES = process.env.SEND_INVITES === 'true';
const TEMP_PASSWORD = process.env.MIGRATE_TEMP_PASSWORD ?? 'ChangeMe!' + Math.random().toString(36).slice(2, 10);

interface Identity {
  fid: string;
  source: 'users' | 'workers' | 'managers';
  email: string | null;
  role: string;
  name: string | null;
  phone: string | null;
  trade: string | null;
}

function load(name: string): FsDoc[] {
  const p = join(DATA, name);
  return existsSync(p) ? (JSON.parse(readFileSync(p, 'utf8')) as FsDoc[]) : [];
}

function collect(): Identity[] {
  const out: Identity[] = [];
  for (const d of load('users.json'))
    out.push({ fid: d.id, source: 'users', email: d.data.email ?? null, role: String(d.data.role ?? 'client').toLowerCase(), name: d.data.name ?? d.data.displayName ?? null, phone: d.data.phone ?? null, trade: d.data.trade ?? null });
  for (const d of load('managers.json'))
    out.push({ fid: d.id, source: 'managers', email: d.data.email ?? null, role: 'manager', name: d.data.name ?? null, phone: d.data.phone ?? null, trade: null });
  for (const d of load('workers.json'))
    out.push({ fid: d.id, source: 'workers', email: d.data.email ?? null, role: 'worker', name: d.data.name ?? null, phone: d.data.phone ?? null, trade: d.data.trade ?? null });
  return out;
}

async function findAuthIdByEmail(db: SupabaseClient, email: string): Promise<string | undefined> {
  const target = email.toLowerCase();
  for (let page = 1; page <= 50; page++) {
    const { data } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    const list = data.users as Array<{ id: string; email?: string }>;
    const hit = list.find((u) => (u.email ?? '').toLowerCase() === target);
    if (hit) return hit.id;
    if (list.length < 1000) return undefined;
  }
  return undefined;
}

async function ensureAuthUser(db: SupabaseClient, email: string): Promise<string> {
  if (SEND_INVITES) {
    const { data, error } = await db.auth.admin.inviteUserByEmail(email);
    if (!error && data.user) return data.user.id;
    if (error && !/already|registered/i.test(error.message)) throw error;
  } else {
    const { data, error } = await db.auth.admin.createUser({ email, password: TEMP_PASSWORD, email_confirm: true });
    if (!error && data.user) return data.user.id;
    if (error && !/already|registered/i.test(error.message)) throw error;
  }
  const existing = await findAuthIdByEmail(db, email);
  if (!existing) throw new Error(`could not resolve auth user for ${email}`);
  return existing;
}

async function main() {
  if (!url || !key) throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

  const identities = collect();
  // Group by lowercased email; first occurrence (users.json wins) sets role/name.
  const byEmail = new Map<string, Identity[]>();
  const noEmail: Identity[] = [];
  for (const id of identities) {
    if (!id.email) { noEmail.push(id); continue; }
    const k = id.email.toLowerCase();
    (byEmail.get(k) ?? byEmail.set(k, []).get(k)!).push(id);
  }

  let created = 0, mappedFids = 0;
  for (const [email, group] of byEmail) {
    const primary = group[0];
    const uid = await ensureAuthUser(db, email);
    created++;
    const { error: uErr } = await db.from('users').upsert(
      { id: uid, legacy_firestore_id: primary.fid, email, role: primary.role, display_name: primary.name, phone: primary.phone, trade: primary.trade },
      { onConflict: 'id' },
    );
    if (uErr) throw new Error(`users upsert ${email}: ${uErr.message}`);
    for (const m of group) {
      const { error } = await db.from('legacy_user_map').upsert(
        { legacy_firestore_id: m.fid, user_id: uid, source: m.source },
        { onConflict: 'legacy_firestore_id' },
      );
      if (error) throw new Error(`legacy_user_map ${m.fid}: ${error.message}`);
      mappedFids++;
    }
  }

  // Email-less identities: profile row only (no login).
  for (const id of noEmail) {
    const { data, error } = await db.from('users')
      .upsert({ legacy_firestore_id: id.fid, role: id.role, display_name: id.name, phone: id.phone, trade: id.trade }, { onConflict: 'legacy_firestore_id' })
      .select('id').single();
    if (error) throw new Error(`profile user ${id.fid}: ${error.message}`);
    await db.from('legacy_user_map').upsert({ legacy_firestore_id: id.fid, user_id: data.id, source: id.source }, { onConflict: 'legacy_firestore_id' });
    mappedFids++;
  }

  console.log(`auth users ensured: ${created}`);
  console.log(`legacy ids mapped:  ${mappedFids}`);
  console.log(`no-email (no login, manual onboarding): ${noEmail.length}`);
  if (!SEND_INVITES && created) console.log(`temp password for new accounts: ${TEMP_PASSWORD}  (trigger password resets before go-live)`);
}

main().catch((e) => { console.error('auth-migrate failed:', e.message ?? e); process.exit(1); });
