export interface IngestionEventEntityRow {
  entity_id: string | null;
  action: 'INSERT' | 'UPDATE' | 'UPSERT' | 'SKIP' | 'ERROR' | null;
}

const NEW_ARRIVAL_WINDOW_DAYS = 30;

export function extractLatestNewArrivalBeanIds(rows: IngestionEventEntityRow[]): string[] {
  return Array.from(
    new Set(
      rows
        .filter((row) => row.action === 'INSERT' || row.action === 'UPSERT')
        .map((row) => row.entity_id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0)
      )
  );
}

export function normalizeLatestNewArrivalBeanIds(ids: string[]): string[] | null {
  return ids.length > 0 ? ids : null;
}

export function isRecentUpdatedAt(value: string | null | undefined): boolean {
  const time = value ? Date.parse(value) : Number.NaN;
  if (!Number.isFinite(time)) return false;
  return time >= Date.now() - NEW_ARRIVAL_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}
