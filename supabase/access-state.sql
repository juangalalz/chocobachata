-- En qué punto se quedó el alumno a las 24 h: started (empezó clases), not_started (entró
-- pero no empezó), link_opened (abrió el correo de la contraseña pero no entró) o not_opened.
alter table public.orders add column if not exists access_state text;

notify pgrst, 'reload schema';
