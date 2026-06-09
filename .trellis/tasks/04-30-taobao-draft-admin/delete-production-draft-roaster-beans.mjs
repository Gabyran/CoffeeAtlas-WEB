import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '../../..');
const taskDir = resolve(repoRoot, '.trellis/tasks/04-30-taobao-draft-admin');
const requireFromApi = createRequire(resolve(repoRoot, 'apps/api/package.json'));
const { createClient } = requireFromApi('@supabase/supabase-js');
const dotenv = requireFromApi('dotenv');

dotenv.config({ path: resolve(repoRoot, '.env.production') });
dotenv.config({ path: resolve(repoRoot, 'apps/api/.env') });

const shouldDelete = process.argv.includes('--delete');
const deleteKnownNonBeanTargets = process.argv.includes('--known-non-bean-targets');
const expectedCount = 4;
const targetSourceItemIds = [
  '819854523818',
  '970510729490',
  'listing:白鲸咖啡精品风味挂耳系列手冲便携挂耳包10gx12',
  'listing:terraform随心随行氮气保鲜便携多种口味挂耳式精品手冲咖啡',
];
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const selection =
  'id, roaster_id, bean_id, source_id, display_name, status, price_amount, product_url, source_item_id, source_sku_id, created_at, updated_at, roasters(name), beans(canonical_name)';

let query = supabase
  .from('roaster_beans')
  .select(selection)
  .order('updated_at', { ascending: false });

if (deleteKnownNonBeanTargets) {
  query = query.in('source_item_id', targetSourceItemIds);
} else {
  query = query.eq('status', 'DRAFT');
}

const { data, error } = await query;

if (error) throw error;

const rows = data ?? [];
await mkdir(taskDir, { recursive: true });

const backupPath = resolve(
  taskDir,
  `${deleteKnownNonBeanTargets ? 'known-non-bean' : 'draft'}-roaster-beans-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
);
await writeFile(
  backupPath,
  JSON.stringify(
    {
      mode: shouldDelete ? 'delete' : 'dry-run',
      selector: deleteKnownNonBeanTargets ? 'known-non-bean-targets' : 'status=DRAFT',
      selectedAt: new Date().toISOString(),
      count: rows.length,
      rows,
    },
    null,
    2
  )
);

console.log(
  JSON.stringify(
    {
      mode: shouldDelete ? 'delete' : 'dry-run',
      selector: deleteKnownNonBeanTargets ? 'known-non-bean-targets' : 'status=DRAFT',
      count: rows.length,
      backupPath,
    },
    null,
    2
  )
);

if (!shouldDelete) {
  console.log(JSON.stringify(rows.map((row) => ({ id: row.id, roaster: row.roasters?.name, name: row.display_name })), null, 2));
  process.exit(0);
}

if (rows.length !== expectedCount) {
  throw new Error(`Refusing to delete: expected ${expectedCount} selected rows, found ${rows.length}`);
}

const ids = rows.map((row) => row.id);
const { data: deletedRows, error: deleteError } = await supabase
  .from('roaster_beans')
  .delete()
  .in('id', ids)
  .select('id');

if (deleteError) throw deleteError;

let verifyQuery = supabase
  .from('roaster_beans')
  .select('id', { count: 'exact', head: true });

if (deleteKnownNonBeanTargets) {
  verifyQuery = verifyQuery.in('source_item_id', targetSourceItemIds);
} else {
  verifyQuery = verifyQuery.eq('status', 'DRAFT');
}

const { count: remainingCount, error: verifyError } = await verifyQuery;

if (verifyError) throw verifyError;

console.log(
  JSON.stringify(
    {
      deleted: deletedRows?.length ?? 0,
      remainingSelectedCount: remainingCount ?? null,
    },
    null,
    2
  )
);
