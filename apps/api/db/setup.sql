-- =============================================================================
-- CoffeeAtlas Database Setup Script
-- =============================================================================
-- Run this script in Supabase Dashboard → SQL Editor
-- Execute all statements at once
-- =============================================================================

-- ============================================================================
-- 1. Extensions
-- ============================================================================
create extension if not exists pgcrypto;
create extension if not exists pg_trgm;
create extension if not exists unaccent;

-- ============================================================================
-- 2. Schema - Enums, Tables, Functions, Triggers
-- ============================================================================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'publish_status') then
    create type publish_status as enum ('DRAFT', 'ACTIVE', 'ARCHIVED');
  end if;

  if not exists (select 1 from pg_type where typname = 'import_job_status') then
    create type import_job_status as enum ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'PARTIAL');
  end if;

  if not exists (select 1 from pg_type where typname = 'import_job_type') then
    create type import_job_type as enum ('XLSX_IMPORT', 'CSV_IMPORT', 'SCRAPE_SYNC', 'MANUAL_PATCH');
  end if;

  if not exists (select 1 from pg_type where typname = 'source_type') then
    create type source_type as enum ('MANUAL', 'OFFICIAL_SITE', 'ECOMMERCE', 'SOCIAL', 'IMPORT_FILE', 'OTHER');
  end if;

  if not exists (select 1 from pg_type where typname = 'change_request_status') then
    create type change_request_status as enum ('PENDING', 'APPROVED', 'REJECTED');
  end if;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.normalize_bean_process_fields()
returns trigger
language plpgsql
as $$
declare
  normalized_raw text;
  source_text text;
begin
  normalized_raw := nullif(btrim(coalesce(new.process_method_raw, new.process_method)), '');
  new.process_method_raw := normalized_raw;
  source_text := lower(coalesce(normalized_raw, ''));

  if new.process_base is null or new.process_base not in ('washed', 'natural', 'honey', 'other') then
    if source_text ~ '(honey|蜜处理|密处理|黄蜜|红蜜|黑蜜)' then
      new.process_base := 'honey';
    elsif source_text ~ '(^|[^a-z])(washed|wash)([^a-z]|$)|水洗' then
      new.process_base := 'washed';
    elsif source_text ~ '(^|[^a-z])natural([^a-z]|$)|日晒|日曬|晒处理|曬處理' then
      new.process_base := 'natural';
    else
      new.process_base := 'other';
    end if;
  end if;

  if new.process_style is null or new.process_style not in ('traditional', 'anaerobic', 'yeast', 'carbonic_maceration', 'thermal_shock', 'other') then
    if source_text ~ 'thermal[[:space:]]*shock|热冲击|熱衝擊' then
      new.process_style := 'thermal_shock';
    elsif source_text ~ 'carbonic|二氧化碳' then
      new.process_style := 'carbonic_maceration';
    elsif source_text ~ 'yeast|酵母' then
      new.process_style := 'yeast';
    elsif source_text ~ 'anaerobic|厌氧|厭氧' then
      new.process_style := 'anaerobic';
    elsif new.process_base = 'other' then
      new.process_style := 'other';
    else
      new.process_style := 'traditional';
    end if;
  end if;

  return new;
end;
$$;

create table if not exists public.sources (
  id uuid primary key default gen_random_uuid(),
  source_type source_type not null,
  source_name text not null,
  source_url text,
  owner_label text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_type, source_name)
);

create table if not exists public.roasters (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  name_en text,
  slug text unique,
  country_code char(2),
  city text,
  description text,
  website_url text,
  instagram_handle text,
  logo_url text,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_tsv tsvector
);

create table if not exists public.roaster_source_bindings (
  id uuid primary key default gen_random_uuid(),
  roaster_id uuid not null references public.roasters(id) on delete cascade,
  source_id uuid not null references public.sources(id) on delete cascade,
  canonical_shop_url text not null,
  canonical_shop_name text not null,
  search_keyword text,
  is_active boolean not null default true,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (roaster_id, source_id)
);

create table if not exists public.beans (
  id uuid primary key default gen_random_uuid(),
  canonical_name text not null,
  canonical_name_en text,
  origin_country text,
  origin_region text,
  farm text,
  producer text,
  variety text,
  process_method text,
  process_method_raw text,
  process_base text,
  process_style text,
  altitude_min_m int check (altitude_min_m is null or altitude_min_m >= 0),
  altitude_max_m int check (altitude_max_m is null or altitude_max_m >= altitude_min_m),
  harvest_year smallint check (harvest_year is null or harvest_year between 1990 and 2100),
  flavor_tags text[] not null default '{}',
  notes text,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_tsv tsvector
);

create table if not exists public.bean_aliases (
  id uuid primary key default gen_random_uuid(),
  bean_id uuid not null references public.beans(id) on delete cascade,
  alias text not null,
  alias_lang text not null default 'zh-CN',
  source_id uuid references public.sources(id) on delete set null,
  confidence numeric(3, 2) not null default 1.00 check (confidence >= 0 and confidence <= 1),
  created_at timestamptz not null default now(),
  unique(bean_id, alias, alias_lang)
);

create table if not exists public.roaster_beans (
  id uuid primary key default gen_random_uuid(),
  roaster_id uuid not null references public.roasters(id) on delete cascade,
  bean_id uuid not null references public.beans(id) on delete restrict,
  source_id uuid references public.sources(id) on delete set null,
  display_name text not null,
  roast_level text,
  price_amount numeric(10, 2) check (price_amount is null or price_amount >= 0),
  price_currency char(3) not null default 'CNY',
  sales_count int check (sales_count is null or sales_count >= 0),
  weight_grams int check (weight_grams is null or weight_grams > 0),
  product_url text,
  image_url text,
  source_item_id text,
  source_sku_id text,
  status publish_status not null default 'DRAFT',
  is_in_stock boolean not null default true,
  release_at timestamptz,
  retire_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_tsv tsvector,
  unique (roaster_id, bean_id, display_name)
);

create table if not exists public.price_snapshots (
  id bigserial primary key,
  roaster_bean_id uuid not null references public.roaster_beans(id) on delete cascade,
  source_id uuid references public.sources(id) on delete set null,
  price_amount numeric(10, 2) not null check (price_amount >= 0),
  price_currency char(3) not null default 'CNY',
  captured_at timestamptz not null default now()
);

create table if not exists public.import_jobs (
  id uuid primary key default gen_random_uuid(),
  job_type import_job_type not null,
  status import_job_status not null default 'PENDING',
  source_id uuid references public.sources(id) on delete set null,
  file_name text,
  file_url text,
  row_count int not null default 0,
  error_count int not null default 0,
  summary jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ingestion_events (
  id bigserial primary key,
  import_job_id uuid references public.import_jobs(id) on delete set null,
  source_id uuid references public.sources(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  payload jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  check (entity_type in ('ROASTER', 'BEAN', 'ROASTER_BEAN', 'ALIAS')),
  check (action in ('INSERT', 'UPDATE', 'UPSERT', 'SKIP', 'ERROR'))
);

create table if not exists public.change_requests (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  proposed_patch jsonb not null,
  reason text,
  status change_request_status not null default 'PENDING',
  requested_by uuid,
  reviewer_id uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (entity_type in ('ROASTER', 'BEAN', 'ROASTER_BEAN', 'ALIAS'))
);

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  wechat_openid text not null unique,
  wechat_unionid text,
  nickname text,
  avatar_url text,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  target_type text not null check (target_type in ('bean', 'roaster')),
  target_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, target_type, target_id)
);

create table if not exists public.user_badge_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  badge_id text not null check (btrim(badge_id) <> ''),
  unlocked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, badge_id)
);

-- Search vector maintenance functions
create or replace function public.update_roaster_search_tsv()
returns trigger
language plpgsql
as $$
begin
  new.search_tsv :=
    setweight(to_tsvector('simple', coalesce(unaccent(new.name), '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(unaccent(new.name_en), '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(unaccent(new.city), '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(unaccent(new.description), '')), 'D');
  return new;
end;
$$;

create or replace function public.update_bean_search_tsv()
returns trigger
language plpgsql
as $$
begin
  new.search_tsv :=
    setweight(to_tsvector('simple', coalesce(unaccent(new.canonical_name), '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(unaccent(new.canonical_name_en), '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(unaccent(new.origin_country), '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(unaccent(new.origin_region), '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(unaccent(new.variety), '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(unaccent(array_to_string(new.flavor_tags, ' ')), '')), 'D');
  return new;
end;
$$;

create or replace function public.update_roaster_bean_search_tsv()
returns trigger
language plpgsql
as $$
begin
  new.search_tsv :=
    setweight(to_tsvector('simple', coalesce(unaccent(new.display_name), '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(unaccent(new.roast_level), '')), 'C');
  return new;
end;
$$;

-- Triggers
drop trigger if exists trg_sources_updated_at on public.sources;
create trigger trg_sources_updated_at before update on public.sources for each row execute function public.set_updated_at();

drop trigger if exists trg_roasters_updated_at on public.roasters;
create trigger trg_roasters_updated_at before update on public.roasters for each row execute function public.set_updated_at();

drop trigger if exists trg_roaster_source_bindings_updated_at on public.roaster_source_bindings;
create trigger trg_roaster_source_bindings_updated_at before update on public.roaster_source_bindings for each row execute function public.set_updated_at();

drop trigger if exists trg_beans_updated_at on public.beans;
create trigger trg_beans_updated_at before update on public.beans for each row execute function public.set_updated_at();

drop trigger if exists trg_beans_normalize_process on public.beans;
create trigger trg_beans_normalize_process before insert or update of process_method, process_method_raw, process_base, process_style on public.beans for each row execute function public.normalize_bean_process_fields();

drop trigger if exists trg_roaster_beans_updated_at on public.roaster_beans;
create trigger trg_roaster_beans_updated_at before update on public.roaster_beans for each row execute function public.set_updated_at();

drop trigger if exists trg_import_jobs_updated_at on public.import_jobs;
create trigger trg_import_jobs_updated_at before update on public.import_jobs for each row execute function public.set_updated_at();

drop trigger if exists trg_change_requests_updated_at on public.change_requests;
create trigger trg_change_requests_updated_at before update on public.change_requests for each row execute function public.set_updated_at();

drop trigger if exists trg_app_users_updated_at on public.app_users;
create trigger trg_app_users_updated_at before update on public.app_users for each row execute function public.set_updated_at();

drop trigger if exists trg_user_favorites_updated_at on public.user_favorites;
create trigger trg_user_favorites_updated_at before update on public.user_favorites for each row execute function public.set_updated_at();

drop trigger if exists trg_user_badge_progress_updated_at on public.user_badge_progress;
create trigger trg_user_badge_progress_updated_at before update on public.user_badge_progress for each row execute function public.set_updated_at();

drop trigger if exists trg_roasters_search_tsv on public.roasters;
create trigger trg_roasters_search_tsv before insert or update of name, name_en, city, description on public.roasters for each row execute function public.update_roaster_search_tsv();

drop trigger if exists trg_beans_search_tsv on public.beans;
create trigger trg_beans_search_tsv before insert or update of canonical_name, canonical_name_en, origin_country, origin_region, variety, flavor_tags on public.beans for each row execute function public.update_bean_search_tsv();

drop trigger if exists trg_roaster_beans_search_tsv on public.roaster_beans;
create trigger trg_roaster_beans_search_tsv before insert or update of display_name, roast_level on public.roaster_beans for each row execute function public.update_roaster_bean_search_tsv();

-- ============================================================================
-- 3. Indexes
-- ============================================================================
create index if not exists idx_roaster_beans_roaster_id on public.roaster_beans (roaster_id);
create index if not exists idx_roaster_beans_bean_id on public.roaster_beans (bean_id);
create index if not exists idx_roaster_beans_status_stock_release on public.roaster_beans (status, is_in_stock, release_at desc);
create index if not exists idx_roaster_beans_price_amount on public.roaster_beans (price_amount);
create index if not exists idx_roaster_source_bindings_roaster_id on public.roaster_source_bindings (roaster_id);
create index if not exists idx_roaster_source_bindings_source_id on public.roaster_source_bindings (source_id);
create index if not exists idx_roaster_source_bindings_active_sync on public.roaster_source_bindings (is_active, last_synced_at desc);
create unique index if not exists idx_roaster_beans_source_identity_unique
on public.roaster_beans (source_id, source_item_id, coalesce(source_sku_id, ''))
where source_id is not null and source_item_id is not null;

create index if not exists idx_roasters_city_country on public.roasters (city, country_code);
create index if not exists idx_roasters_is_public on public.roasters (is_public);

create index if not exists idx_beans_origin_process on public.beans (origin_country, process_method);
create index if not exists idx_beans_process_base_style on public.beans (process_base, process_style);
create index if not exists idx_beans_variety on public.beans (variety);
create index if not exists idx_beans_is_public on public.beans (is_public);

create index if not exists idx_price_snapshots_rb_captured on public.price_snapshots (roaster_bean_id, captured_at desc);
create index if not exists idx_import_jobs_status_created on public.import_jobs (status, created_at desc);
create index if not exists idx_ingestion_events_created on public.ingestion_events (created_at desc);
create index if not exists idx_change_requests_status_created on public.change_requests (status, created_at desc);
create index if not exists idx_app_users_openid on public.app_users (wechat_openid);
create index if not exists idx_user_favorites_user_created on public.user_favorites (user_id, created_at desc);
create index if not exists idx_user_favorites_target on public.user_favorites (target_type, target_id);
create index if not exists idx_user_badge_progress_user_unlocked on public.user_badge_progress (user_id, unlocked_at desc);
create index if not exists idx_user_badge_progress_badge_id on public.user_badge_progress (badge_id);

create index if not exists idx_roasters_search_tsv on public.roasters using gin (search_tsv);
create index if not exists idx_beans_search_tsv on public.beans using gin (search_tsv);
create index if not exists idx_roaster_beans_search_tsv on public.roaster_beans using gin (search_tsv);

create index if not exists idx_roasters_name_trgm on public.roasters using gin (name gin_trgm_ops);
create index if not exists idx_beans_name_trgm on public.beans using gin (canonical_name gin_trgm_ops);
create index if not exists idx_roaster_beans_display_name_trgm on public.roaster_beans using gin (display_name gin_trgm_ops);
create index if not exists idx_bean_aliases_alias_trgm on public.bean_aliases using gin (alias gin_trgm_ops);

-- ============================================================================
-- 4. Row Level Security (RLS)
-- ============================================================================
alter table public.sources enable row level security;
alter table public.roaster_source_bindings enable row level security;
alter table public.roasters enable row level security;
alter table public.beans enable row level security;
alter table public.bean_aliases enable row level security;
alter table public.roaster_beans enable row level security;
alter table public.price_snapshots enable row level security;
alter table public.import_jobs enable row level security;
alter table public.ingestion_events enable row level security;
alter table public.change_requests enable row level security;
alter table public.app_users enable row level security;
alter table public.user_favorites enable row level security;
alter table public.user_badge_progress enable row level security;
-- app_users / user_favorites / user_badge_progress intentionally do not expose
-- anon/authenticated policies. These tables are server-only and must be accessed via service_role.

create or replace function public.has_platform_role(required_roles text[])
returns boolean
language sql
stable
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'platform_role') = any(required_roles), false);
$$;

drop policy if exists roasters_public_read on public.roasters;
create policy roasters_public_read on public.roasters for select to anon, authenticated using (is_public = true);

drop policy if exists beans_public_read on public.beans;
create policy beans_public_read on public.beans for select to anon, authenticated using (is_public = true);

drop policy if exists roaster_beans_public_read on public.roaster_beans;
create policy roaster_beans_public_read on public.roaster_beans for select to anon, authenticated using (status = 'ACTIVE' and is_in_stock = true);

drop policy if exists roasters_admin_all on public.roasters;
create policy roasters_admin_all on public.roasters for all to authenticated using (public.has_platform_role(array['admin', 'editor'])) with check (public.has_platform_role(array['admin', 'editor']));

drop policy if exists beans_admin_all on public.beans;
create policy beans_admin_all on public.beans for all to authenticated using (public.has_platform_role(array['admin', 'editor'])) with check (public.has_platform_role(array['admin', 'editor']));

drop policy if exists roaster_beans_admin_all on public.roaster_beans;
create policy roaster_beans_admin_all on public.roaster_beans for all to authenticated using (public.has_platform_role(array['admin', 'editor'])) with check (public.has_platform_role(array['admin', 'editor']));

drop policy if exists bean_aliases_admin_all on public.bean_aliases;
create policy bean_aliases_admin_all on public.bean_aliases for all to authenticated using (public.has_platform_role(array['admin', 'editor'])) with check (public.has_platform_role(array['admin', 'editor']));

drop policy if exists sources_admin_all on public.sources;
create policy sources_admin_all on public.sources for all to authenticated using (public.has_platform_role(array['admin', 'editor'])) with check (public.has_platform_role(array['admin', 'editor']));

drop policy if exists roaster_source_bindings_admin_all on public.roaster_source_bindings;
create policy roaster_source_bindings_admin_all on public.roaster_source_bindings for all to authenticated using (public.has_platform_role(array['admin', 'editor'])) with check (public.has_platform_role(array['admin', 'editor']));

drop policy if exists price_snapshots_admin_all on public.price_snapshots;
create policy price_snapshots_admin_all on public.price_snapshots for all to authenticated using (public.has_platform_role(array['admin', 'editor'])) with check (public.has_platform_role(array['admin', 'editor']));

drop policy if exists import_jobs_admin_all on public.import_jobs;
create policy import_jobs_admin_all on public.import_jobs for all to authenticated using (public.has_platform_role(array['admin', 'editor'])) with check (public.has_platform_role(array['admin', 'editor']));

drop policy if exists ingestion_events_admin_all on public.ingestion_events;
create policy ingestion_events_admin_all on public.ingestion_events for all to authenticated using (public.has_platform_role(array['admin', 'editor'])) with check (public.has_platform_role(array['admin', 'editor']));

drop policy if exists change_requests_admin_all on public.change_requests;
create policy change_requests_admin_all on public.change_requests for all to authenticated using (public.has_platform_role(array['admin', 'editor'])) with check (public.has_platform_role(array['admin', 'editor']));

-- ============================================================================
-- 5. Views
-- ============================================================================
create or replace view public.v_catalog_active as
select
  rb.id as roaster_bean_id,
  r.id as roaster_id,
  r.name as roaster_name,
  r.city,
  b.id as bean_id,
  b.canonical_name as bean_name,
  b.origin_country,
  b.origin_region,
  b.farm,
  b.producer,
  b.process_method,
  b.process_method_raw,
  b.process_base,
  b.process_style,
  b.variety,
  rb.display_name,
  rb.roast_level,
  rb.price_amount,
  rb.price_currency,
  rb.sales_count,
  rb.is_in_stock,
  rb.product_url,
  rb.image_url,
  rb.release_at,
  rb.updated_at
from public.roaster_beans rb
join public.roasters r on r.id = rb.roaster_id
join public.beans b on b.id = rb.bean_id
where r.is_public = true
  and b.is_public = true
  and rb.status = 'ACTIVE';

create or replace view public.v_catalog_admin as
select
  rb.id as roaster_bean_id,
  rb.status,
  rb.is_in_stock,
  rb.display_name,
  rb.roast_level,
  rb.price_amount,
  rb.price_currency,
  rb.sales_count,
  rb.product_url,
  rb.image_url,
  rb.release_at,
  rb.retire_at,
  rb.created_at,
  rb.updated_at,
  r.id as roaster_id,
  r.name as roaster_name,
  r.city,
  r.country_code,
  b.id as bean_id,
  b.canonical_name as bean_name,
  b.origin_country,
  b.origin_region,
  b.process_method,
  b.process_method_raw,
  b.process_base,
  b.process_style,
  b.variety,
  b.flavor_tags,
  s.source_type,
  s.source_name,
  s.source_url
from public.roaster_beans rb
join public.roasters r on r.id = rb.roaster_id
join public.beans b on b.id = rb.bean_id
left join public.sources s on s.id = rb.source_id;

-- ============================================================================
-- 6. Search Function
-- ============================================================================
create or replace function public.search_catalog_matches(
  p_query text
)
returns table (
  roaster_bean_id uuid,
  roaster_name text,
  city text,
  bean_name text,
  display_name text,
  process_method text,
  roast_level text,
  price_amount numeric,
  price_currency char(3),
  is_in_stock boolean,
  rank_score real,
  updated_at timestamptz
)
language sql
stable
as $$
  with normalized as (
    select btrim(coalesce(p_query, '')) as q
  ),
  tsq as (
    select
      normalized.q,
      case
        when normalized.q = '' then null::tsquery
        else websearch_to_tsquery('simple', normalized.q)
      end as query
    from normalized
  )
  select
    rb.id as roaster_bean_id,
    r.name as roaster_name,
    r.city,
    b.canonical_name as bean_name,
    rb.display_name,
    b.process_method,
    rb.roast_level,
    rb.price_amount,
    rb.price_currency,
    rb.is_in_stock,
    case
      when tsq.q = '' then 0::real
      else ts_rank_cd(
        coalesce(rb.search_tsv, ''::tsvector) ||
        coalesce(b.search_tsv, ''::tsvector) ||
        coalesce(r.search_tsv, ''::tsvector),
        tsq.query
      )
    end as rank_score,
    rb.updated_at
  from public.roaster_beans rb
  join public.roasters r on r.id = rb.roaster_id
  join public.beans b on b.id = rb.bean_id
  cross join tsq
  where rb.status = 'ACTIVE'
    and r.is_public = true
    and b.is_public = true
    and (
      tsq.q = ''
      or (
        coalesce(rb.search_tsv, ''::tsvector) ||
        coalesce(b.search_tsv, ''::tsvector) ||
        coalesce(r.search_tsv, ''::tsvector)
      ) @@ tsq.query
      or similarity(rb.display_name, tsq.q) > 0.2
      or similarity(b.canonical_name, tsq.q) > 0.2
      or similarity(r.name, tsq.q) > 0.2
    );
$$;

create or replace function public.search_catalog(
  p_query text,
  p_limit int default 50,
  p_offset int default 0
)
returns table (
  roaster_bean_id uuid,
  roaster_name text,
  city text,
  bean_name text,
  display_name text,
  process_method text,
  roast_level text,
  price_amount numeric,
  price_currency char(3),
  is_in_stock boolean,
  rank_score real
)
language sql
stable
as $$
  select
    matches.roaster_bean_id,
    matches.roaster_name,
    matches.city,
    matches.bean_name,
    matches.display_name,
    matches.process_method,
    matches.roast_level,
    matches.price_amount,
    matches.price_currency,
    matches.is_in_stock,
    matches.rank_score
  from public.search_catalog_matches(p_query) matches
  order by matches.rank_score desc, matches.updated_at desc
  limit greatest(1, least(coalesce(p_limit, 50), 200))
  offset greatest(0, coalesce(p_offset, 0));
$$;

create or replace function public.search_catalog_count(
  p_query text
)
returns bigint
language sql
stable
as $$
  select count(*)::bigint
  from public.search_catalog_matches(p_query) matches;
$$;

create or replace function public.latest_synced_new_arrival_ids()
returns table (
  roaster_bean_id uuid
)
language sql
security definer
set search_path = public
stable
as $$
  with latest_job as (
    select id
    from public.import_jobs
    where job_type = 'SCRAPE_SYNC'
      and file_name = 'sync-taobao-new-arrivals'
      and status in ('SUCCEEDED', 'PARTIAL')
    order by completed_at desc nulls last, created_at desc
    limit 1
  )
  select distinct event.entity_id as roaster_bean_id
  from public.ingestion_events event
  join latest_job on latest_job.id = event.import_job_id
  where event.entity_type = 'ROASTER_BEAN'
    and event.action in ('INSERT', 'UPSERT')
    and event.entity_id is not null;
$$;

grant execute on function public.latest_synced_new_arrival_ids() to anon, authenticated;

-- ============================================================================
-- Complete!
-- ============================================================================
select 'Database setup complete!' as status;
