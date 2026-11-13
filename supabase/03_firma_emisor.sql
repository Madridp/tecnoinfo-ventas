-- =====================================================================
-- TECNO INFO GT · Firma del emisor (Pedro) en cotizaciones, recibos y garantías
-- Correr DESPUÉS de 02_firmas.sql. Se puede volver a correr sin problema.
-- =====================================================================

-- Nuevo momento de firma: 'emisor' = firma de TECNO INFO en el documento
alter table firmas drop constraint if exists firmas_momento_check;
alter table firmas add constraint firmas_momento_check
  check (momento in ('aceptacion','entrega','recepcion','retiro','emisor'));

-- Ajustes del negocio (aquí se guarda tu firma para reutilizarla con un clic)
create table if not exists ajustes (
  clave text primary key,
  valor jsonb not null,
  actualizado timestamptz not null default now()
);
alter table ajustes enable row level security;
drop policy if exists "solo_autenticados" on ajustes;
create policy "solo_autenticados" on ajustes for all to authenticated using (true) with check (true);
grant select, insert, update, delete on ajustes to authenticated;
revoke all on ajustes from anon;
