-- =====================================================================
-- TECNO INFO GT · Sistema de Ventas
-- Ejecutar completo en Supabase > SQL Editor (una sola vez)
-- =====================================================================

-- ---------- Catálogos ----------
create table if not exists productos (
  id uuid primary key default gen_random_uuid(),
  sku text unique,
  nombre text not null,
  descripcion text,
  categoria text default 'General',
  proveedor text,
  costo numeric(12,2) not null default 0,
  precio numeric(12,2) not null default 0,
  stock integer not null default 0,
  stock_minimo integer not null default 0,
  controla_stock boolean not null default true,   -- false = servicio o producto bajo pedido
  garantia_dias integer not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists clientes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  nit text not null default 'CF',
  telefono text,
  email text,
  direccion text,
  notas text,
  created_at timestamptz not null default now()
);

-- ---------- Correlativos: PREFIJO-AAAA-MM-NNN ----------
create table if not exists contadores (
  prefijo text not null,
  periodo text not null,
  ultimo integer not null default 0,
  primary key (prefijo, periodo)
);

create or replace function siguiente_numero(p_prefijo text)
returns text language plpgsql as $$
declare
  v_periodo text := to_char(now() at time zone 'America/Guatemala', 'YYYY-MM');
  v_n integer;
begin
  insert into contadores (prefijo, periodo, ultimo) values (p_prefijo, v_periodo, 1)
  on conflict (prefijo, periodo) do update set ultimo = contadores.ultimo + 1
  returning ultimo into v_n;
  return p_prefijo || '-' || v_periodo || '-' || lpad(v_n::text, 3, '0');
end $$;

-- ---------- Cotizaciones (COT) y Ventas/Recibos (REC) ----------
create table if not exists documentos (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('COT','VTA')),
  numero text not null unique,
  cliente_id uuid references clientes(id),
  fecha timestamptz not null default now(),
  valida_hasta date,
  estado text not null check (estado in ('pendiente','aceptada','rechazada','pagada','anulada')),
  metodo_pago text check (metodo_pago in ('efectivo','tarjeta','transferencia','deposito','otro')),
  aplicar_iva boolean not null default true,
  descuento numeric(12,2) not null default 0,
  subtotal numeric(12,2) not null default 0,
  iva numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  notas text,
  condiciones text,
  origen_id uuid references documentos(id),   -- venta generada desde cotización
  motivo_anulacion text,
  created_at timestamptz not null default now()
);
create index if not exists documentos_tipo_fecha on documentos (tipo, fecha desc);

create table if not exists documento_items (
  id uuid primary key default gen_random_uuid(),
  documento_id uuid not null references documentos(id) on delete cascade,
  producto_id uuid references productos(id),
  descripcion text not null,
  detalle text,
  cantidad numeric(12,2) not null check (cantidad > 0),
  precio_unitario numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  garantia_dias integer not null default 0,
  orden integer not null default 0
);
create index if not exists documento_items_doc on documento_items (documento_id);

-- ---------- Kardex ----------
create table if not exists movimientos_inventario (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references productos(id),
  tipo text not null check (tipo in ('entrada','salida','ajuste','anulacion','devolucion','reemplazo')),
  cantidad integer not null,          -- positivo suma, negativo resta
  stock_resultante integer not null,
  referencia text,
  nota text,
  created_at timestamptz not null default now()
);
create index if not exists movs_prod on movimientos_inventario (producto_id, created_at desc);

-- ---------- Garantías y devoluciones ----------
create table if not exists casos (
  id uuid primary key default gen_random_uuid(),
  numero text not null unique,
  tipo text not null check (tipo in ('garantia','devolucion')),
  venta_id uuid not null references documentos(id),
  item_id uuid not null references documento_items(id),
  cliente_id uuid references clientes(id),
  cantidad integer not null default 1,
  en_garantia boolean not null default true,
  motivo text not null,
  estado_equipo text,                 -- cómo se recibió (accesorios, golpes, etc.)
  estado text not null default 'recibido'
    check (estado in ('recibido','en_revision','enviado_proveedor','reparado','reemplazado','reembolsado','rechazado','entregado')),
  resolucion text,
  monto_reembolso numeric(12,2) not null default 0,
  stock_reintegrado boolean not null default false,
  reemplazo_descontado boolean not null default false,
  fecha_recepcion timestamptz not null default now(),
  fecha_cierre timestamptz,
  created_at timestamptz not null default now()
);

-- =====================================================================
-- Funciones de negocio (todo pasa por aquí para que el inventario cuadre)
-- =====================================================================

create or replace function mover_stock(p_producto uuid, p_delta integer, p_tipo text, p_ref text, p_nota text)
returns void language plpgsql as $$
declare v_stock integer; v_controla boolean; v_nombre text;
begin
  select stock, controla_stock, nombre into v_stock, v_controla, v_nombre
    from productos where id = p_producto for update;
  if not found or not v_controla then return; end if;
  if v_stock + p_delta < 0 then
    raise exception 'Stock insuficiente de "%": hay %, se necesitan %', v_nombre, v_stock, -p_delta;
  end if;
  update productos set stock = stock + p_delta where id = p_producto;
  insert into movimientos_inventario (producto_id, tipo, cantidad, stock_resultante, referencia, nota)
  values (p_producto, p_tipo, p_delta, v_stock + p_delta, p_ref, p_nota);
end $$;

-- Crea (o edita, si es cotización) un documento con sus líneas.
-- p_items: [{producto_id, descripcion, detalle, cantidad, precio_unitario, garantia_dias}]
create or replace function guardar_documento(
  p_tipo text, p_cliente_id uuid, p_items jsonb,
  p_metodo_pago text default 'efectivo', p_aplicar_iva boolean default true,
  p_descuento numeric default 0, p_valida_dias integer default 8,
  p_notas text default null, p_condiciones text default null,
  p_origen_id uuid default null, p_id uuid default null)
returns uuid language plpgsql as $$
declare
  v_id uuid; v_num text; v_sub numeric(12,2); v_total numeric(12,2); it jsonb; i integer := 0;
begin
  if jsonb_array_length(coalesce(p_items,'[]'::jsonb)) = 0 then
    raise exception 'El documento no tiene productos';
  end if;

  select coalesce(sum(round((x->>'cantidad')::numeric * (x->>'precio_unitario')::numeric, 2)),0)
    into v_sub from jsonb_array_elements(p_items) x;
  v_sub := v_sub - coalesce(p_descuento,0);
  if v_sub < 0 then raise exception 'El descuento es mayor que el subtotal'; end if;
  -- Pequeño contribuyente: el 5% es sobre el total facturado → total = subtotal / 0.95
  v_total := case when p_aplicar_iva then round(v_sub / 0.95, 2) else v_sub end;

  if p_id is not null then
    if p_tipo <> 'COT' then raise exception 'Solo las cotizaciones se pueden editar'; end if;
    update documentos set cliente_id = p_cliente_id, aplicar_iva = p_aplicar_iva,
      descuento = coalesce(p_descuento,0), subtotal = v_sub, iva = v_total - v_sub, total = v_total,
      valida_hasta = (fecha at time zone 'America/Guatemala')::date + p_valida_dias,
      notas = p_notas, condiciones = p_condiciones
    where id = p_id and tipo = 'COT' and estado = 'pendiente'
    returning id into v_id;
    if v_id is null then raise exception 'La cotización ya no está pendiente'; end if;
    delete from documento_items where documento_id = v_id;
  else
    v_num := siguiente_numero(case p_tipo when 'COT' then 'COT' else 'REC' end);
    insert into documentos (tipo, numero, cliente_id, valida_hasta, estado, metodo_pago, aplicar_iva,
                            descuento, subtotal, iva, total, notas, condiciones, origen_id)
    values (p_tipo, v_num, p_cliente_id,
            case when p_tipo = 'COT' then (now() at time zone 'America/Guatemala')::date + p_valida_dias end,
            case when p_tipo = 'COT' then 'pendiente' else 'pagada' end,
            case when p_tipo = 'VTA' then p_metodo_pago end,
            p_aplicar_iva, coalesce(p_descuento,0), v_sub, v_total - v_sub, v_total,
            p_notas, p_condiciones, p_origen_id)
    returning id into v_id;
  end if;

  for it in select * from jsonb_array_elements(p_items) loop
    i := i + 1;
    insert into documento_items (documento_id, producto_id, descripcion, detalle, cantidad,
                                 precio_unitario, total, garantia_dias, orden)
    values (v_id, nullif(it->>'producto_id','')::uuid, it->>'descripcion', nullif(it->>'detalle',''),
            (it->>'cantidad')::numeric, (it->>'precio_unitario')::numeric,
            round((it->>'cantidad')::numeric * (it->>'precio_unitario')::numeric, 2),
            coalesce((it->>'garantia_dias')::int, 0), i);
    if p_tipo = 'VTA' and nullif(it->>'producto_id','') is not null then
      perform mover_stock((it->>'producto_id')::uuid, -ceil((it->>'cantidad')::numeric)::int,
                          'salida', v_num, 'Venta');
    end if;
  end loop;

  if p_tipo = 'VTA' and p_origen_id is not null then
    update documentos set estado = 'aceptada' where id = p_origen_id and tipo = 'COT';
  end if;
  return v_id;
end $$;

create or replace function anular_venta(p_id uuid, p_motivo text)
returns void language plpgsql as $$
declare d documentos; it documento_items;
begin
  select * into d from documentos where id = p_id and tipo = 'VTA' for update;
  if not found then raise exception 'Venta no encontrada'; end if;
  if d.estado = 'anulada' then raise exception 'La venta ya está anulada'; end if;
  if exists (select 1 from casos where venta_id = p_id) then
    raise exception 'La venta tiene casos de garantía/devolución; resuélvalos primero';
  end if;
  for it in select * from documento_items where documento_id = p_id and producto_id is not null loop
    perform mover_stock(it.producto_id, ceil(it.cantidad)::int, 'anulacion', d.numero, p_motivo);
  end loop;
  update documentos set estado = 'anulada', motivo_anulacion = p_motivo where id = p_id;
end $$;

create or replace function ajustar_stock(p_producto uuid, p_tipo text, p_cantidad integer, p_nota text)
returns void language plpgsql as $$
begin
  if p_tipo not in ('entrada','ajuste') then raise exception 'Tipo inválido'; end if;
  if p_tipo = 'entrada' and p_cantidad <= 0 then raise exception 'La entrada debe ser mayor a 0'; end if;
  perform mover_stock(p_producto, p_cantidad, p_tipo, null, p_nota);
end $$;

create or replace function registrar_caso(p_tipo text, p_item_id uuid, p_cantidad integer,
                                          p_motivo text, p_estado_equipo text default null)
returns uuid language plpgsql as $$
declare it documento_items; d documentos; v_id uuid; v_vence date;
begin
  select * into it from documento_items where id = p_item_id;
  select * into d from documentos where id = it.documento_id;
  if d.tipo <> 'VTA' or d.estado = 'anulada' then raise exception 'Solo aplica a ventas vigentes'; end if;
  if p_cantidad < 1 or p_cantidad > it.cantidad then raise exception 'Cantidad inválida'; end if;
  v_vence := (d.fecha at time zone 'America/Guatemala')::date + it.garantia_dias;
  insert into casos (numero, tipo, venta_id, item_id, cliente_id, cantidad, en_garantia, motivo, estado_equipo)
  values (siguiente_numero(case p_tipo when 'garantia' then 'GAR' else 'DEV' end), p_tipo, d.id, it.id,
          d.cliente_id, p_cantidad, (now() at time zone 'America/Guatemala')::date <= v_vence,
          p_motivo, p_estado_equipo)
  returning id into v_id;
  return v_id;
end $$;

-- Cambia el estado de un caso. Mueve inventario cuando corresponde:
--  · p_reintegrar = true  → el producto devuelto vuelve a stock (una sola vez)
--  · estado 'reemplazado' → sale una unidad nueva del stock (una sola vez)
create or replace function actualizar_caso(p_id uuid, p_estado text, p_resolucion text,
                                           p_monto numeric default 0, p_reintegrar boolean default false)
returns void language plpgsql as $$
declare c casos; it documento_items;
begin
  select * into c from casos where id = p_id for update;
  if not found then raise exception 'Caso no encontrado'; end if;
  select * into it from documento_items where id = c.item_id;

  if p_reintegrar and not c.stock_reintegrado and it.producto_id is not null then
    perform mover_stock(it.producto_id, c.cantidad, 'devolucion', c.numero, 'Devuelto por cliente');
    c.stock_reintegrado := true;
  end if;
  if p_estado = 'reemplazado' and not c.reemplazo_descontado and it.producto_id is not null then
    perform mover_stock(it.producto_id, -c.cantidad, 'reemplazo', c.numero, 'Unidad de reemplazo');
    c.reemplazo_descontado := true;
  end if;

  update casos set estado = p_estado, resolucion = p_resolucion,
    monto_reembolso = coalesce(p_monto, 0),
    stock_reintegrado = c.stock_reintegrado, reemplazo_descontado = c.reemplazo_descontado,
    fecha_cierre = case when p_estado in ('reembolsado','rechazado','entregado') then now() else null end
  where id = p_id;
end $$;

create or replace function resumen_dashboard()
returns jsonb language sql stable as $$
  with hoy as (select (now() at time zone 'America/Guatemala') as t),
  v as (
    select d.*, (d.fecha at time zone 'America/Guatemala') as f from documentos d
    where tipo = 'VTA' and estado <> 'anulada'
  )
  select jsonb_build_object(
    'ventas_hoy',   (select coalesce(sum(total),0) from v, hoy where f::date = t::date),
    'ventas_mes',   (select coalesce(sum(total),0) from v, hoy where date_trunc('month', f) = date_trunc('month', t)),
    'num_ventas_mes',(select count(*) from v, hoy where date_trunc('month', f) = date_trunc('month', t)),
    'ganancia_mes', (select coalesce(sum(i.total - i.cantidad * coalesce(p.costo,0)),0)
                       from v join documento_items i on i.documento_id = v.id
                       left join productos p on p.id = i.producto_id, hoy
                      where date_trunc('month', f) = date_trunc('month', t)),
    'ventas_anio',  (select coalesce(sum(total),0) from v, hoy where date_trunc('year', f) = date_trunc('year', t)),
    'cotizaciones_pendientes', (select count(*) from documentos where tipo = 'COT' and estado = 'pendiente'),
    'casos_abiertos', (select count(*) from casos where fecha_cierre is null),
    'stock_bajo', (select coalesce(jsonb_agg(jsonb_build_object('id',id,'nombre',nombre,'stock',stock,'minimo',stock_minimo) order by stock),'[]')
                     from productos where activo and controla_stock and stock <= stock_minimo)
  );
$$;

-- =====================================================================
-- Seguridad: solo usuarios con sesión iniciada pueden ver/escribir
-- =====================================================================
do $$
declare t text;
begin
  foreach t in array array['productos','clientes','contadores','documentos','documento_items','movimientos_inventario','casos'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "solo_autenticados" on %I', t);
    execute format('create policy "solo_autenticados" on %I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

grant select, insert, update, delete on all tables in schema public to authenticated;
revoke all on all tables in schema public from anon;
revoke execute on all functions in schema public from anon, public;
grant execute on all functions in schema public to authenticated;

-- Continúa tu correlativo de cotizaciones (última emitida: COT-2026-11-004)
insert into contadores (prefijo, periodo, ultimo) values ('COT', '2026-11', 4)
on conflict (prefijo, periodo) do nothing;

-- Cliente genérico para ventas rápidas
insert into clientes (nombre, nit) select 'Consumidor Final', 'CF'
where not exists (select 1 from clientes where nombre = 'Consumidor Final');
