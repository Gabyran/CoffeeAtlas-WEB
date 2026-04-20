-- Expose latest synced new arrival roaster_bean_ids to anon/authenticated clients.
-- Safe to run multiple times.

begin;

create or replace function public.latest_synced_new_arrival_ids()
returns table (
  roaster_bean_id uuid
)
language sql
security definer
set search_path = public
stable
as $$
  with latest_jobs as (
    select distinct on (coalesce(split_part(file_name, ':', 1), file_name)) id
    from public.import_jobs
    where job_type = 'SCRAPE_SYNC'
      and (file_name = 'sync-taobao-new-arrivals' or file_name like 'sync-taobao-single-shop:%')
      and status in ('SUCCEEDED', 'PARTIAL')
    order by coalesce(split_part(file_name, ':', 1), file_name), completed_at desc nulls last, created_at desc
  )
  select distinct event.entity_id as roaster_bean_id
  from public.ingestion_events event
  join latest_jobs on latest_jobs.id = event.import_job_id
  where event.entity_type = 'ROASTER_BEAN'
    and event.action in ('INSERT', 'UPSERT')
    and event.entity_id is not null;
$$;

grant execute on function public.latest_synced_new_arrival_ids() to anon, authenticated;

commit;

-- Verification:
select *
from public.latest_synced_new_arrival_ids()
limit 20;
