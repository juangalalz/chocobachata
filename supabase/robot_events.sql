-- Robots (revisor de anuncios de Meta y otros), aparte de las visitas de personas: para saber
-- cuántos entran, cuándo (¿solo al crear anuncios o también después?) y qué hacen.
create table if not exists public.robot_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  -- "navegador": se delata en el user agent. "red_meta": se disfraza, pero viene de la IP de Meta.
  reason text not null,
  session_id text not null,
  name text not null,
  depth integer,
  seconds integer,
  visible_seconds integer,
  loaded_hidden boolean,
  cta text,
  utm_content text,
  ad_group text,
  placement text,
  has_fbclid boolean,
  client_ip text,
  user_agent text
);

create index if not exists robot_events_created_idx on public.robot_events (created_at);

alter table public.robot_events enable row level security;
