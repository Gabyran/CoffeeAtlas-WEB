import { requireSupabaseServer } from '@/lib/supabase';
import { normalizeLatestNewArrivalBeanIds } from './new-arrivals-helpers.ts';

interface LatestNewArrivalIdRow {
  roaster_bean_id: string | null;
}

export async function getLatestSyncedNewArrivalBeanIds(): Promise<string[] | null> {
  const supabaseServer = requireSupabaseServer();

  const { data, error } = await supabaseServer.rpc('latest_synced_new_arrival_ids');
  if (error) throw error;

  return normalizeLatestNewArrivalBeanIds(
    Array.from(
      new Set(
        ((data ?? []) as LatestNewArrivalIdRow[])
          .map((row) => row.roaster_bean_id)
          .filter((id): id is string => typeof id === 'string' && id.length > 0)
      )
    )
  );
}

export async function getLatestSyncedNewArrivalBeanIdSet(): Promise<Set<string> | null> {
  const ids = await getLatestSyncedNewArrivalBeanIds();
  return ids ? new Set(ids) : null;
}
