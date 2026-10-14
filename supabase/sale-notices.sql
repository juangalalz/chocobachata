-- Hora en que se avisó la venta por Telegram (evita avisar dos veces el mismo pedido).
alter table public.orders add column if not exists sale_notified_at timestamptz;

notify pgrst, 'reload schema';
