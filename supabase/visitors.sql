-- Identificador propio del navegador (localStorage), para saber si alguien vuelve
-- y desde qué anuncios. El _fbp de Meta llega tarde y falta en la mitad de visitas.
alter table public.page_events add column if not exists visitor_id text;
create index if not exists page_events_visitor_id_idx on public.page_events (visitor_id);

notify pgrst, 'reload schema';
