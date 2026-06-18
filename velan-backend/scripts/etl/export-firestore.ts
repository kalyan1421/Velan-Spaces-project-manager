/**
 * Phase 4 ETL — dump the legacy Firestore project to the JSON layout that
 * import.ts consumes. Requires a Firebase service account for the OLD project.
 *
 *   FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-legacy.json \
 *   npx ts-node scripts/etl/export-firestore.ts [outDir]   # default: scripts/etl/data
 *
 * Writes:
 *   <outDir>/<collection>.json                      [{id,data}, ...]
 *   <outDir>/subcollections/<projectId>/<sub>.json  [{id,data}, ...]
 * Firestore Timestamps are serialized as ISO strings (mappers expect that).
 */
import * as admin from 'firebase-admin';
import { readFileSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const saPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
const OUT = process.argv[2] ?? join(__dirname, 'data');

const TOP_LEVEL = [
  'users',
  'workers',
  'managers',
  'projects',
  'leads',
  'catalog_items',
  'quote_templates',
  'quotes',
  'quotation_settings',
  'notifications',
  'phases',
  'counters',
];
const PROJECT_SUBS = [
  'updates',
  'designs',
  'files',
  'rooms',
  'settlements',
  'budgetTransactions',
  'chatMessages',
  'complaints',
];

/** Recursively convert Firestore Timestamps to ISO strings for clean JSON. */
function normalize(v: any): any {
  if (v == null) return v;
  if (v instanceof admin.firestore.Timestamp) return v.toDate().toISOString();
  if (Array.isArray(v)) return v.map(normalize);
  if (typeof v === 'object') {
    const o: Record<string, any> = {};
    for (const [k, val] of Object.entries(v)) o[k] = normalize(val);
    return o;
  }
  return v;
}

function write(file: string, docs: Array<{ id: string; data: any }>) {
  const full = join(OUT, file);
  mkdirSync(join(full, '..'), { recursive: true });
  writeFileSync(full, JSON.stringify(docs, null, 2));
  console.log(`  ${file.padEnd(40)} ${docs.length}`);
}

async function dumpCollection(db: admin.firestore.Firestore, name: string) {
  const snap = await db.collection(name).get();
  write(
    `${name}.json`,
    snap.docs.map((d) => ({ id: d.id, data: normalize(d.data()) })),
  );
  return snap.docs.map((d) => d.id);
}

async function main() {
  if (!saPath) throw new Error('Set FIREBASE_SERVICE_ACCOUNT_PATH');
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(readFileSync(saPath, 'utf8'))),
  });
  const db = admin.firestore();

  console.log('-- top-level collections');
  let projectIds: string[] = [];
  for (const c of TOP_LEVEL) {
    try {
      const ids = await dumpCollection(db, c);
      if (c === 'projects') projectIds = ids;
    } catch (e) {
      console.warn(`  (skip ${c}: ${(e as Error).message})`);
    }
  }

  console.log('-- project subcollections');
  for (const pid of projectIds) {
    for (const sub of PROJECT_SUBS) {
      const snap = await db.collection('projects').doc(pid).collection(sub).get();
      if (snap.empty) continue;
      write(
        join('subcollections', pid, `${sub}.json`),
        snap.docs.map((d) => ({ id: d.id, data: normalize(d.data()) })),
      );
    }
  }

  console.log('\nExport complete →', OUT);
}

main().catch((e) => {
  console.error('Firestore export failed:', e.message ?? e);
  process.exit(1);
});
