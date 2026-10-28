create table if not exists public.page_events (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  name text not null,
  depth integer,
  seconds integer,
  path text,
  fbclid text,
  fbc text,
  fbp text,
  utm_content text,
  event_id text,
  created_at timestamptz not null default now()
);

create index if not exists page_events_session_idx
  on public.page_events (session_id, created_at);

alter table public.page_events enable row level security;

-- IP y navegador del clic en Comprar ahora, para el Purchase de CAPI.
alter table public.page_events add column if not exists client_ip text;
alter table public.page_events add column if not exists user_agent text;

-- Experimento de oct 2026: grupo del anuncio (utm_term), ubicación de Meta ({{placement}}),
-- segundos con la página a la vista y si cargó oculta (la app la precargó o se volvió al feed).
alter table public.page_events add column if not exists ad_group text;
alter table public.page_events add column if not exists placement text;
alter table public.page_events add column if not exists visible_seconds integer;
alter table public.page_events add column if not exists loaded_hidden boolean;

-- Espera al pago: milisegundos desde que toca Comprar hasta que el navegador deja la página
-- (cuando empieza a llegar el pago de Lemon). Y si cargó oculta, cuántos segundos pasaron
-- hasta que la persona la vio (precarga aprovechada) o null si nunca la vio.
alter table public.page_events add column if not exists checkout_wait_ms integer;
alter table public.page_events add column if not exists shown_after integer;
