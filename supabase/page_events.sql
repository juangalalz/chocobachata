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
