/**
 * Phase 4 ETL — import a Firestore JSON export into PostgreSQL (idempotent).
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   npx ts-node scripts/etl/import.ts [dataDir]   # default: scripts/etl/data
 *
 * Expects the layout produced by export-firestore.ts:
 *   <dataDir>/<collection>.json                       [{id,data}, ...]
 *   <dataDir>/subcollections/<projectId>/<sub>.json   [{id,data}, ...]
 *
 * Order: users → projects → project_members → per-project children →
 * top-level (leads, catalog, quotes, settings, notifications, timeline).
 * Every row upserts on `legacy_firestore_id`, so re-runs are safe.
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import * as M from './mappers';

const url = process.env.SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const DATA = process.argv[2] ?? join(__dirname, 'data');
const CHUNK = 500;

function load(name: string): M.FsDoc[] {
  const p = join(DATA, name);
  if (!existsSync(p)) return [];
  return JSON.parse(readFileSync(p, 'utf8')) as M.FsDoc[];
}

async function upsert(
  db: SupabaseClient,
  table: string,
  rows: Record<string, any>[],
  onConflict = 'legacy_firestore_id',
): Promise<number> {
  let n = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    const { error } = await db.from(table).upsert(slice, { onConflict });
    if (error) throw new Error(`${table}: ${error.message}`);
    n += slice.length;
  }
  return n;
}

async function buildMap(
  db: SupabaseClient,
  table: string,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const { data, error } = await db
    .from(table)
    .select('id, legacy_firestore_id')
    .not('legacy_firestore_id', 'is', null);
  if (error) throw new Error(`map ${table}: ${error.message}`);
  for (const r of data ?? []) map.set(r.legacy_firestore_id as string, r.id as string);
  return map;
}

/**
 * User id map. Prefers legacy_user_map (populated by auth-migrate.ts — handles
 * users/workers/managers collapsing to one auth user); falls back to
 * users.legacy_firestore_id so the importer still works standalone in dev.
 */
async function buildUserMap(db: SupabaseClient): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const { data: lm } = await db
    .from('legacy_user_map')
    .select('legacy_firestore_id, user_id');
  for (const r of lm ?? []) map.set(r.legacy_firestore_id as string, r.user_id as string);
  const { data: us } = await db
    .from('users')
    .select('id, legacy_firestore_id')
    .not('legacy_firestore_id', 'is', null);
  for (const r of us ?? [])
    if (!map.has(r.legacy_firestore_id as string))
      map.set(r.legacy_firestore_id as string, r.id as string);
  return map;
}

async function main() {
  if (!url || !key) throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  if (!existsSync(DATA)) throw new Error(`Data dir not found: ${DATA}`);
  const db = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const report: Record<string, number> = {};
  const log = (t: string, n: number) => {
    report[t] = (report[t] ?? 0) + n;
    console.log(`  ${t.padEnd(20)} ${n}`);
  };

  // 1) users (+ workers/managers collections)
  console.log('-- identities');
  log('users', await upsert(db, 'users', load('users.json').map(M.mapUser)));
  log('users(worker)', await upsert(db, 'users', load('workers.json').map((d) => M.mapStaff(d, 'worker'))));
  log('users(manager)', await upsert(db, 'users', load('managers.json').map((d) => M.mapStaff(d, 'manager'))));
  const maps: M.IdMaps = { users: await buildUserMap(db), projects: new Map() };

  // 2) projects
  console.log('-- projects');
  const projectDocs = load('projects.json');
  log('projects', await upsert(db, 'projects', projectDocs.map(M.mapProject)));
  maps.projects = await buildMap(db, 'projects');

  // 3) project_members (derived from project array fields)
  const members = projectDocs.flatMap((doc) => {
    const pid = maps.projects.get(doc.id);
    return pid ? M.mapProjectMembers(doc, pid, maps) : [];
  });
  if (members.length)
    log('project_members', await upsert(db, 'project_members', members, 'project_id,user_id,member_role'));

  // 4) per-project subcollections
  console.log('-- project children');
  const subDir = join(DATA, 'subcollections');
  const SUBS: Array<[string, string, (d: M.FsDoc, pid: string, m: M.IdMaps) => any]> = [
    ['updates', 'project_updates', M.mapUpdate],
    ['designs', 'designs', M.mapDesign],
    ['files', 'files', M.mapFile],
    ['rooms', 'rooms', (d, pid) => M.mapRoom(d, pid)],
    ['settlements', 'settlements', M.mapSettlement],
    ['budgetTransactions', 'budget_transactions', M.mapBudgetTxn],
    ['chatMessages', 'chat_messages', M.mapChat],
    ['complaints', 'complaints', M.mapComplaint],
  ];
  for (const doc of projectDocs) {
    const pid = maps.projects.get(doc.id);
    if (!pid || !existsSync(join(subDir, doc.id))) continue;
    for (const [sub, table, fn] of SUBS) {
      const docs = load(join('subcollections', doc.id, `${sub}.json`));
      if (docs.length) log(table, await upsert(db, table, docs.map((x) => fn(x, pid, maps))));
    }
  }

  // 5) top-level collections
  console.log('-- sales / crm / feed / timeline');
  log('leads', await upsert(db, 'leads', load('leads.json').map((d) => M.mapLead(d, maps))));
  log('catalog_items', await upsert(db, 'catalog_items', load('catalog_items.json').map(M.mapCatalogItem)));
  log('quote_templates', await upsert(db, 'quote_templates', load('quote_templates.json').map(M.mapQuoteTemplate)));
  log('quotes', await upsert(db, 'quotes', load('quotes.json').map(M.mapQuote)));
  log('notifications', await upsert(db, 'notifications', load('notifications.json').map((d) => M.mapNotification(d, maps))));
  const phases = load('phases.json').flatMap((d) => {
    const pid = d.data?.projectId ? maps.projects.get(String(d.data.projectId)) : undefined;
    return pid ? [M.mapTimelinePhase(d, pid)] : [];
  });
  if (phases.length) log('timeline_phases', await upsert(db, 'timeline_phases', phases));

  console.log('\nImport complete:', JSON.stringify(report));
}

main().catch((e) => {
  console.error('ETL import failed:', e.message ?? e);
  process.exit(1);
});
