create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  lemon_order_id text unique not null,
  email text,
  full_name text,
  amount_cents integer,
  currency text,
  fbclid text,
  fbc text,
  fbp text,
  client_ip text,
  user_agent text,
  wix_member_id text,
  wix_status text not null default 'pending',
  capi_status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.orders enable row level security;
