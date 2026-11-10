-- =====================================================================
-- TECNO INFO GT · Firmas electrónicas (correr DESPUÉS de schema.sql)
-- =====================================================================

-- Una fila por firma. momento:
--   aceptacion → cliente acepta una cotización
--   entrega    → cliente recibe conforme lo vendido
--   recepcion  → cliente deja equipo por garantía/devolución
--   retiro     → cliente retira equipo o recibe reembolso
create table if not exists firmas (
  id uuid primary key default gen_random_uuid(),
  documento_id uuid references documentos(id) on delete cascade,
  caso_id uuid references casos(id) on delete cascade,
  momento text not null check (momento in ('aceptacion','entrega','recepcion','retiro')),
  nombre text not null,
  dpi text,
  firma text not null check (firma like 'data:image/png;base64,%' and length(firma) < 400000),
  via text not null default 'presencial' check (via in ('presencial','enlace')),
  user_agent text,
  firmado_en timestamptz not null default now(),
  check ((documento_id is null) <> (caso_id is null))
);
create unique index if not exists firmas_unica_doc on firmas (documento_id, momento) where documento_id is not null;
create unique index if not exists firmas_unica_caso on firmas (caso_id, momento) where caso_id is not null;

-- Enlaces de un solo uso que se mandan al cliente
create table if not exists firma_solicitudes (
  token uuid primary key default gen_random_uuid(),
  documento_id uuid references documentos(id) on delete cascade,
  caso_id uuid references casos(id) on delete cascade,
  momento text not null,
  usada boolean not null default false,
  expira timestamptz not null default now() + interval '7 days',
  created_at timestamptz not null default now()
);

alter table firmas enable row level security;
alter table firma_solicitudes enable row level security;
drop policy if exists "solo_autenticados" on firmas;
create policy "solo_autenticados" on firmas for all to authenticated using (true) with check (true);
drop policy if exists "solo_autenticados" on firma_solicitudes;
create policy "solo_autenticados" on firma_solicitudes for all to authenticated using (true) with check (true);
grant select, insert, update, delete on firmas, firma_solicitudes to authenticated;
revoke all on firmas, firma_solicitudes from anon;

-- Genera (o reutiliza) un enlace vigente para firmar
create or replace function solicitar_firma(p_documento uuid, p_caso uuid, p_momento text)
returns uuid language plpgsql as $$
declare v_token uuid;
begin
  select token into v_token from firma_solicitudes
   where documento_id is not distinct from p_documento and caso_id is not distinct from p_caso
     and momento = p_momento and not usada and expira > now()
   order by created_at desc limit 1;
  if v_token is null then
    insert into firma_solicitudes (documento_id, caso_id, momento) values (p_documento, p_caso, p_momento)
    returning token into v_token;
  end if;
  return v_token;
end $$;

-- ---------- Funciones PÚBLICAS (el cliente no tiene sesión) ----------
-- Solo devuelven el resumen del documento ligado a un token válido.
create or replace function info_firma(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s firma_solicitudes; r jsonb;
begin
  select * into s from firma_solicitudes where token = p_token;
  if not found then return jsonb_build_object('error','Enlace no válido'); end if;
  if s.usada then return jsonb_build_object('error','Este documento ya fue firmado. ¡Gracias!'); end if;
  if s.expira < now() then return jsonb_build_object('error','El enlace venció. Pide uno nuevo a TECNO INFO.'); end if;

  if s.documento_id is not null then
    select jsonb_build_object('tipo', d.tipo, 'numero', d.numero, 'fecha', d.fecha, 'total', d.total,
             'subtotal', d.subtotal, 'iva', d.iva, 'descuento', d.descuento, 'condiciones', d.condiciones,
             'valida_hasta', d.valida_hasta, 'cliente', c.nombre,
             'items', (select jsonb_agg(jsonb_build_object('descripcion', i.descripcion, 'detalle', i.detalle,
                         'cantidad', i.cantidad, 'total', i.total, 'garantia_dias', i.garantia_dias) order by i.orden)
                       from documento_items i where i.documento_id = d.id))
      into r from documentos d left join clientes c on c.id = d.cliente_id where d.id = s.documento_id;
  else
    select jsonb_build_object('tipo', 'CASO', 'subtipo', k.tipo, 'numero', k.numero, 'fecha', k.fecha_recepcion,
             'cliente', c.nombre, 'producto', i.descripcion, 'detalle', i.detalle, 'cantidad', k.cantidad,
             'motivo', k.motivo, 'estado_equipo', k.estado_equipo, 'resolucion', k.resolucion,
             'monto_reembolso', k.monto_reembolso, 'recibo', v.numero)
      into r from casos k join documento_items i on i.id = k.item_id join documentos v on v.id = k.venta_id
      left join clientes c on c.id = k.cliente_id where k.id = s.caso_id;
  end if;
  return r || jsonb_build_object('momento', s.momento);
end $$;

create or replace function firmar_con_token(p_token uuid, p_nombre text, p_dpi text, p_firma text, p_user_agent text)
returns void language plpgsql security definer set search_path = public as $$
declare s firma_solicitudes;
begin
  select * into s from firma_solicitudes where token = p_token for update;
  if not found or s.usada or s.expira < now() then raise exception 'Enlace no válido o vencido'; end if;
  if coalesce(trim(p_nombre),'') = '' then raise exception 'Escribe tu nombre'; end if;
  insert into firmas (documento_id, caso_id, momento, nombre, dpi, firma, via, user_agent)
  values (s.documento_id, s.caso_id, s.momento, trim(p_nombre), nullif(trim(p_dpi),''), p_firma, 'enlace', left(p_user_agent, 300))
  on conflict do nothing;
  update firma_solicitudes set usada = true where token = p_token;
end $$;

revoke execute on function solicitar_firma(uuid,uuid,text) from anon, public;
grant execute on function solicitar_firma(uuid,uuid,text) to authenticated;
revoke execute on function info_firma(uuid), firmar_con_token(uuid,text,text,text,text) from public;
grant execute on function info_firma(uuid), firmar_con_token(uuid,text,text,text,text) to anon, authenticated;
