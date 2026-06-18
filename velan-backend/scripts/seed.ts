/**
 * Seed an initial head user + a sample project.
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment
 * (e.g. via a .env loaded by your shell) and the schema already applied.
 *
 *   npx ts-node scripts/seed.ts
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const headEmail = process.env.SEED_HEAD_EMAIL ?? 'head@velanspaces.com';
const headPassword = process.env.SEED_HEAD_PASSWORD ?? 'ChangeMe123!';

async function main() {
  if (!url || !serviceKey) {
    throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.');
  }
  const db = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1) Create (or fetch) the head auth user.
  let authId: string | undefined;
  const created = await db.auth.admin.createUser({
    email: headEmail,
    password: headPassword,
    email_confirm: true,
  });
  if (created.error) {
    if (!/already/i.test(created.error.message)) throw created.error;
    const { data } = await db.auth.admin.listUsers();
    authId = (data.users as Array<{ id: string; email?: string }>).find(
      (u) => u.email === headEmail,
    )?.id;
    console.log(`Head user already existed: ${headEmail}`);
  } else {
    authId = created.data.user?.id;
    console.log(`Created head user: ${headEmail} (password: ${headPassword})`);
  }
  if (!authId) throw new Error('Could not resolve head auth id');

  // 2) Upsert the app users row.
  const { error: uErr } = await db.from('users').upsert(
    {
      id: authId,
      email: headEmail,
      role: 'head',
      display_name: 'Velan Head',
    },
    { onConflict: 'id' },
  );
  if (uErr) throw uErr;
  console.log('Upserted users row (role=head).');

  // 3) Create a sample project (idempotent on project_code).
  const { data: project, error: pErr } = await db
    .from('projects')
    .upsert(
      {
        project_code: 'VS-DEMO-001',
        project_name: 'Demo Project',
        client_name: 'Demo Client',
        location: 'Chennai',
        budget: 1000000,
        estimated_cost: 950000,
      },
      { onConflict: 'project_code' },
    )
    .select()
    .single();
  if (pErr) throw pErr;
  console.log(`Sample project ready: ${project.project_code} (${project.id})`);

  console.log('\nSeed complete. Log in with the head credentials above.');
}

main().catch((e) => {
  console.error('Seed failed:', e.message ?? e);
  process.exit(1);
});
