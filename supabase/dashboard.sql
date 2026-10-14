-- Datos extra para el tablero: qué botón se tocó, de qué app llega la visita y en
-- qué dispositivo. Ninguno identifica a la persona.
alter table public.page_events add column if not exists cta text;
alter table public.page_events add column if not exists source text;
alter table public.page_events add column if not exists device text;

create index if not exists page_events_created_idx
  on public.page_events (created_at);

-- Une cada pedido con la visita que lo originó, para saber qué anuncio vende.
alter table public.orders add column if not exists session_id text;

create index if not exists orders_session_idx on public.orders (session_id);

-- Todo el tablero en una sola consulta. Agrupa en la base de datos, así no hay
-- límite de filas aunque haya miles de visitas.
create or replace function public.dashboard_stats(since timestamptz)
returns jsonb
language sql
stable
as $$
  with sessions as (
    select
      session_id,
      min(created_at) as started,
      (array_agg(utm_content order by created_at) filter (where utm_content <> ''))[1] as ad,
      (array_agg(source order by created_at) filter (where source is not null))[1] as source,
      (array_agg(device order by created_at) filter (where device is not null))[1] as device,
      coalesce(max(depth) filter (where name in ('scroll', 'leave')), 0) as max_depth,
      bool_or(name = 'cta_click') as clicked,
      max(seconds) filter (where name = 'leave') as seconds,
      bool_or(name = 'video_play') as video_play,
      coalesce(max(depth) filter (where name = 'video_progress'), 0) as video_depth,
      (array_agg(cta order by created_at desc) filter (where name = 'cta_click'))[1] as last_cta
    from public.page_events
    where created_at >= since
    group by session_id
  ),
  bought as (
    select
      session_id,
      count(*) filter (where wix_status <> 'refunded') as sales,
      count(*) filter (where wix_status = 'refunded') as refunds
    from public.orders
    where created_at >= since and session_id is not null
    group by session_id
  ),
  joined as (
    select s.*, coalesce(b.sales, 0) as sales, coalesce(b.refunds, 0) as refunds
    from sessions s
    left join bought b using (session_id)
  ),
  funnel as (
    select
      grouping_key,
      grouping_value,
      count(*) as visits,
      count(*) filter (where max_depth < 25 and not clicked) as bounced,
      count(*) filter (where max_depth >= 50) as read_half,
      count(*) filter (where clicked) as clicked,
      sum(sales) as sales
    from joined
    cross join lateral (
      values
        ('ad', coalesce(ad, 'sin anuncio')),
        ('source', coalesce(source, 'sin dato')),
        ('device', coalesce(device, 'sin dato'))
    ) as g(grouping_key, grouping_value)
    group by grouping_key, grouping_value
  )
  select jsonb_build_object(
    'totals', (
      select jsonb_build_object(
        'visits', count(*),
        'bounced', count(*) filter (where max_depth < 25 and not clicked),
        'read_half', count(*) filter (where max_depth >= 50),
        'clicked', count(*) filter (where clicked),
        'sales', coalesce(sum(sales), 0),
        'refunds', coalesce(sum(refunds), 0),
        'all_orders', (
          select count(*) from public.orders
          where created_at >= since and wix_status <> 'refunded'
        ),
        'stuck', (
          select count(*) from public.orders
          where last_error is not null
        )
      )
      from joined
    ),
    'groups', coalesce((
      select jsonb_agg(to_jsonb(f) order by f.visits desc) from funnel f
    ), '[]'::jsonb),
    'ctas', coalesce((
      select jsonb_agg(to_jsonb(c) order by c.clicks desc)
      from (
        select coalesce(last_cta, 'sin dato') as cta, count(*) as clicks, sum(sales) as sales
        from joined
        where clicked
        group by 1
      ) c
    ), '[]'::jsonb),
    'video', (
      select jsonb_build_object(
        'played', count(*) filter (where video_play),
        'p25', count(*) filter (where video_depth >= 25),
        'p50', count(*) filter (where video_depth >= 50),
        'p75', count(*) filter (where video_depth >= 75),
        'p100', count(*) filter (where video_depth >= 100),
        'played_sales', coalesce(sum(sales) filter (where video_play), 0),
        'played_clicked', count(*) filter (where video_play and clicked)
      )
      from joined
    ),
    'recent', coalesce((
      select jsonb_agg(to_jsonb(r))
      from (
        select started, ad, source, device, max_depth, seconds, clicked,
          sales > 0 as bought, video_depth
        from joined
        order by started desc
        limit 30
      ) r
    ), '[]'::jsonb)
  );
$$;

-- Solo el servidor (service role) puede leer el tablero.
revoke execute on function public.dashboard_stats(timestamptz) from public, anon, authenticated;

notify pgrst, 'reload schema';
