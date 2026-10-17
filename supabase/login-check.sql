-- Revisión de si el alumno entró al curso en las primeras 24 h (ver src/lib/login-check.ts).
alter table public.orders add column if not exists login_checked_at timestamptz;
alter table public.orders add column if not exists logged_in boolean;

notify pgrst, 'reload schema';
