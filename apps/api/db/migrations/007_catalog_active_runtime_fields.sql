begin;

do $$
declare
  select_list text;
begin
  with column_expr as (
    select *
    from (
      values
        ('roaster_bean_id', 'rb.id as roaster_bean_id'),
        ('roaster_id', 'r.id as roaster_id'),
        ('roaster_name', 'r.name as roaster_name'),
        ('city', 'r.city'),
        ('bean_id', 'b.id as bean_id'),
        ('bean_name', 'b.canonical_name as bean_name'),
        ('origin_country', 'b.origin_country'),
        ('origin_region', 'b.origin_region'),
        ('farm', 'b.farm'),
        ('producer', 'b.producer'),
        ('process_method', 'b.process_method'),
        ('process_method_raw', 'b.process_method_raw'),
        ('process_base', 'b.process_base'),
        ('process_style', 'b.process_style'),
        ('variety', 'b.variety'),
        ('display_name', 'rb.display_name'),
        ('roast_level', 'rb.roast_level'),
        ('price_amount', 'rb.price_amount'),
        ('price_currency', 'rb.price_currency'),
        ('sales_count', 'rb.sales_count'),
        ('is_in_stock', 'rb.is_in_stock'),
        ('product_url', 'rb.product_url'),
        ('image_url', 'rb.image_url'),
        ('release_at', 'rb.release_at'),
        ('updated_at', 'rb.updated_at')
    ) as expressions(column_name, expression)
  ),
  existing_columns as (
    select
      columns.column_name,
      columns.ordinal_position
    from information_schema.columns
    where columns.table_schema = 'public'
      and columns.table_name = 'v_catalog_active'
  ),
  required_columns as (
    select
      column_expr.column_name,
      1000 + row_number() over (order by column_expr.column_name) as ordinal_position
    from column_expr
    where column_expr.column_name in ('farm', 'producer', 'sales_count')
      and not exists (
        select 1
        from existing_columns
        where existing_columns.column_name = column_expr.column_name
      )
  ),
  final_columns as (
    select * from existing_columns
    union all
    select * from required_columns
  )
  select string_agg(column_expr.expression, E',\n  ' order by final_columns.ordinal_position)
  into select_list
  from final_columns
  join column_expr on column_expr.column_name = final_columns.column_name;

  if select_list is null then
    select string_agg(column_expr.expression, E',\n  ' order by array_position(
      array[
        'roaster_bean_id',
        'roaster_id',
        'roaster_name',
        'city',
        'bean_id',
        'bean_name',
        'origin_country',
        'origin_region',
        'farm',
        'producer',
        'process_method',
        'process_method_raw',
        'process_base',
        'process_style',
        'variety',
        'display_name',
        'roast_level',
        'price_amount',
        'price_currency',
        'sales_count',
        'is_in_stock',
        'product_url',
        'image_url',
        'release_at',
        'updated_at'
      ],
      column_expr.column_name
    ))
    into select_list
    from column_expr;
  end if;

  execute format(
    'create or replace view public.v_catalog_active as
select
  %s
from public.roaster_beans rb
join public.roasters r on r.id = rb.roaster_id
join public.beans b on b.id = rb.bean_id
where r.is_public = true
  and b.is_public = true
  and rb.status = ''ACTIVE''',
    select_list
  );
end $$;

commit;
