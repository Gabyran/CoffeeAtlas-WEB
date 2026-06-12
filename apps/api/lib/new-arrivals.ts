import { queryRows } from './server/database.ts';
import { normalizeLatestNewArrivalBeanIds } from './new-arrivals-helpers.ts';

interface IngestionEventRow {
  entity_id: string | null;
}

export async function getLatestSyncedNewArrivalBeanIds(): Promise<string[] | null> {
  const rows = await queryRows<IngestionEventRow>(
    'select roaster_bean_id as entity_id from public.latest_synced_new_arrival_ids()'
  );

  return normalizeLatestNewArrivalBeanIds(
    Array.from(new Set(rows.map((row) => row.entity_id).filter((id): id is string => typeof id === 'string' && id.length > 0)))
  );
}

export async function getLatestSyncedNewArrivalBeanIdSet(): Promise<Set<string> | null> {
  const ids = await getLatestSyncedNewArrivalBeanIds();
  return ids ? new Set(ids) : null;
}
