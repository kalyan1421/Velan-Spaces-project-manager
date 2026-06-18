/**
 * Phase 4 — parity & reconciliation (AKS-214). Run AFTER import.ts.
 *
 *   set -a; source .env; set +a
 *   npx ts-node scripts/etl/parity.ts [dataDir]
 *
 * Compares the Firestore export (source of truth) against the migrated rows
 * (counted as rows WHERE legacy_firestore_id IS NOT NULL, so pre-existing
 * seed/demo data is ignored), and reconciles each project's current_spend
 * against the sum of its migrated budget transactions.
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { FsDoc } from './mappers';

const url = process.env.SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const DATA = process.argv[2] ?? join(__dirname, 'data');

function load(name: string): FsDoc[] {
  const p = join(DATA, name);
  return existsSync(p) ? (JSON.parse(readFileSync(p, 'utf8')) as FsDoc[]) : [];
}

async function migratedCount(db: SupabaseClient, table: string): Promise<number> {
  const { count, error } = await db
    .from(table)
    .select('id', { count: 'exact', head: true })
    .not('legacy_firestore_id', 'is', null);
  if (error) throw new Error(`count ${table}: ${error.message}`);
  return count ?? 0;
}

async function plainCount(db: SupabaseClient, table: string): Promise<number> {
  const { count, error } = await db.from(table).select('*', { count: 'exact', head: true });
  if (error) throw new Error(`count ${table}: ${error.message}`);
  return count ?? 0;
}

async function main() {
  if (!url || !key) throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

  let pass = 0, fail = 0;
  const row = (label: string, src: number, pg: number, ok = src === pg) => {
    console.log(`  ${ok ? '✓' : '✗'} ${label.padEnd(22)} source=${src}  migrated=${pg}`);
    ok ? pass++ : fail++;
  };

  console.log('== identities ==');
  const idDocs = load('users.json').length + load('workers.json').length + load('managers.json').length;
  row('legacy ids mapped', idDocs, await plainCount(db, 'legacy_user_map'));

  console.log('== top-level ==');
  const projectDocs = load('projects.json');
  row('projects', projectDocs.length, await migratedCount(db, 'projects'));
  row('leads', load('leads.json').length, await migratedCount(db, 'leads'));
  row('catalog_items', load('catalog_items.json').length, await migratedCount(db, 'catalog_items'));
  row('quote_templates', load('quote_templates.json').length, await migratedCount(db, 'quote_templates'));
  row('quotes', load('quotes.json').length, await migratedCount(db, 'quotes'));
  row('notifications', load('notifications.json').length, await migratedCount(db, 'notifications'));

  console.log('== project subcollections (summed) ==');
  const SUBS: Array<[string, string]> = [
    ['updates', 'project_updates'],
    ['designs', 'designs'],
    ['files', 'files'],
    ['rooms', 'rooms'],
    ['settlements', 'settlements'],
    ['budgetTransactions', 'budget_transactions'],
    ['chatMessages', 'chat_messages'],
    ['complaints', 'complaints'],
  ];
  for (const [sub, table] of SUBS) {
    let src = 0;
    for (const p of projectDocs) src += load(join('subcollections', p.id, `${sub}.json`)).length;
    row(table, src, await migratedCount(db, table));
  }

  console.log('== budget reconciliation (current_spend vs Σ debits−credits) ==');
  const { data: projects } = await db
    .from('projects')
    .select('id, project_code, current_spend')
    .not('legacy_firestore_id', 'is', null);
  let recPass = 0, recFail = 0;
  for (const p of projects ?? []) {
    const { data: txns } = await db
      .from('budget_transactions')
      .select('type, amount')
      .eq('project_id', p.id);
    const computed = (txns ?? []).reduce(
      (a, t) => (t.type === 'credit' ? a - Number(t.amount) : a + Number(t.amount)),
      0,
    );
    const diff = Math.abs(Number(p.current_spend) - computed);
    if (diff <= 0.01) recPass++;
    else {
      recFail++;
      console.log(`  ✗ ${p.project_code}: current_spend=${p.current_spend} computed=${computed.toFixed(2)}`);
    }
  }
  console.log(`  reconciled: ${recPass} ok, ${recFail} mismatch`);
  fail += recFail;

  console.log(`\nPARITY: ${pass} matched, ${fail} discrepancies`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error('parity failed:', e.message ?? e); process.exit(1); });
