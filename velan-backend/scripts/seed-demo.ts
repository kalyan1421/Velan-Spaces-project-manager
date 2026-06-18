/**
 * Seed a full demo cast on the VS-DEMO-001 project so every role flow can be
 * exercised: a budget-enabled manager, a worker, and a client.
 *
 *   npx ts-node scripts/seed-demo.ts
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PASSWORD = process.env.SEED_DEMO_PASSWORD ?? 'ChangeMe123!';

const CAST: Array<{
  email: string;
  role: 'manager' | 'worker' | 'client';
  name: string;
  budget?: boolean;
}> = [
  { email: 'manager@velanspaces.com', role: 'manager', name: 'Demo Manager', budget: true },
  { email: 'worker@velanspaces.com', role: 'worker', name: 'Demo Worker' },
  { email: 'client@velanspaces.com', role: 'client', name: 'Demo Client' },
];

async function main() {
  if (!url || !serviceKey) throw new Error('Missing SUPABASE_URL / SERVICE_ROLE_KEY');
  const db = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: project, error: pErr } = await db
    .from('projects')
    .select('id, project_code')
    .eq('project_code', 'VS-DEMO-001')
    .single();
  if (pErr || !project) throw new Error('Run seed.ts first (VS-DEMO-001 missing)');

  for (const c of CAST) {
    // auth user (idempotent)
    let authId: string | undefined;
    const created = await db.auth.admin.createUser({
      email: c.email,
      password: PASSWORD,
      email_confirm: true,
    });
    if (created.error) {
      if (!/already/i.test(created.error.message)) throw created.error;
      const { data } = await db.auth.admin.listUsers();
      authId = (data.users as Array<{ id: string; email?: string }>).find(
        (u) => u.email === c.email,
      )?.id;
    } else {
      authId = created.data.user?.id;
    }
    if (!authId) throw new Error(`No auth id for ${c.email}`);

    await db
      .from('users')
      .upsert(
        { id: authId, email: c.email, role: c.role, display_name: c.name },
        { onConflict: 'id' },
      );

    await db.from('project_members').upsert(
      {
        project_id: project.id,
        user_id: authId,
        member_role: c.role,
        has_budget_access: !!c.budget,
      },
      { onConflict: 'project_id,user_id,member_role' },
    );

    console.log(
      `✓ ${c.role.padEnd(8)} ${c.email}  (budget=${!!c.budget})  → member of ${project.project_code}`,
    );
  }

  console.log(`\nDemo cast ready (password: ${PASSWORD}).`);
}

main().catch((e) => {
  console.error('seed-demo failed:', e.message ?? e);
  process.exit(1);
});
