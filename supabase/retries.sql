-- Reintentos de pedidos que fallaron (src/lib/retry-orders.ts).
alter table public.orders add column if not exists attempts integer not null default 0;
alter table public.orders add column if not exists last_error text;
alter table public.orders add column if not exists alerted_at timestamptz;
alter table public.orders add column if not exists refund_requested_at timestamptz;

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

notify pgrst, 'reload schema';
