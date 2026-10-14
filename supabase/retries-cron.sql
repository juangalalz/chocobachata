-- Llama a /api/reintentos cada 10 minutos. El secreto es el mismo CRON_SECRET de Vercel:
--   psql "$DATABASE_URL" -v secret="$CRON_SECRET" -f supabase/retries-cron.sql
-- Volver a ejecutarlo actualiza la tarea (mismo nombre).
select cron.schedule(
  'reintentar-pedidos',
  '*/10 * * * *',
  format(
    $job$select net.http_post(
      url := %L,
      headers := jsonb_build_object('x-cron-secret', %L, 'Content-Type', 'application/json'),
      body := '{}'::jsonb
    )$job$,
    'https://curso.chocobachata.com/api/reintentos',
    :'secret'
  )
);
