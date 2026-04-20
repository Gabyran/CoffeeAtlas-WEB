import { requireSupabaseServer } from '@/lib/supabase';
import { normalizeLatestNewArrivalBeanIds } from './new-arrivals-helpers.ts';

interface IngestionEventRow {
  entity_id: string | null;
}

export async function getLatestSyncedNewArrivalBeanIds(): Promise<string[] | null> {
  const supabaseServer = requireSupabaseServer();

  // 查找最近一次成功的每日上新同步和各店铺同步任务
  const { data: jobs, error: jobError } = await supabaseServer
    .from('import_jobs')
    .select('id, file_name, completed_at')
    .eq('job_type', 'SCRAPE_SYNC')
    .or('file_name.eq.sync-taobao-new-arrivals,file_name.ilike.sync-taobao-single-shop:%')
    .in('status', ['SUCCEEDED', 'PARTIAL'])
    .order('completed_at', { ascending: false, nullsFirst: false })
    .limit(20);

  if (jobError) throw jobError;
  if (!jobs?.length) return null;

  const jobIds = jobs.map((row) => row.id);

  const { data, error } = await supabaseServer
    .from('ingestion_events')
    .select('entity_id')
    .in('import_job_id', jobIds)
    .eq('entity_type', 'ROASTER_BEAN')
    .in('action', ['INSERT', 'UPSERT'])
    .not('entity_id', 'is', null);

  if (error) throw error;

  return normalizeLatestNewArrivalBeanIds(
    Array.from(
      new Set(
        ((data ?? []) as IngestionEventRow[])
          .map((row) => row.entity_id)
          .filter((id): id is string => typeof id === 'string' && id.length > 0)
      )
    )
  );
}

export async function getLatestSyncedNewArrivalBeanIdSet(): Promise<Set<string> | null> {
  const ids = await getLatestSyncedNewArrivalBeanIds();
  return ids ? new Set(ids) : null;
}
