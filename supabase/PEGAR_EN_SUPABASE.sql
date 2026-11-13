-- ===== PEGAR TODO EN SUPABASE > SQL EDITOR > RUN (una sola vez) =====
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

-- =====================================================================
-- TECNO INFO GT · Carga de cotizaciones pendientes (COT-2026-11-003 a 007)
-- Pegar completo en Supabase > SQL Editor > Run.
-- Es seguro: si alguna ya existe (mismo número o mismo cliente con el mismo total), la salta.
-- =====================================================================
do $$
declare v_cli uuid; v_doc uuid; v_otra text;
begin

  -- COT-2026-11-003 · Dra. Alma Meléndez · Q 1,150.00
  select id into v_cli from clientes where lower(nombre) = lower('Dra. Alma Meléndez') limit 1;
  if v_cli is null then
    insert into clientes (nombre, nit, direccion, notas) values ('Dra. Alma Meléndez', 'CF', null, 'Equipo: Dell Inspiron 14 3000 (i5, 4 GB RAM, HDD 1 TB)')
    returning id into v_cli;
  end if;
  select numero into v_otra from documentos where tipo = 'COT' and cliente_id = v_cli and total = 1150.0 limit 1;
  if v_otra is not null then
    raise notice 'COT-2026-11-003: ya estaba en el sistema como %, se salta', v_otra;
  elsif exists (select 1 from documentos where numero = 'COT-2026-11-003') then
    raise exception 'El número COT-2026-11-003 ya lo tiene otro documento en el sistema. No se cargó nada; avísale a Claude.';
  else
    insert into documentos (tipo, numero, cliente_id, fecha, valida_hasta, estado, aplicar_iva, subtotal, iva, total, notas, condiciones)
    values ('COT', 'COT-2026-11-003', v_cli, '2026-11-05 12:00:00-06', '2026-11-18', 'pendiente', true, 1092.5, 57.5, 1150.0, 'Equipo: Dell Inspiron 14 3000 · Intel Core i5 · 4 GB RAM · HDD 1 TB', 'Pago al contado o por transferencia bancaria. Entrega del equipo en 2 a 3 días hábiles después de confirmar. Garantía: SSD 12 meses (fabricante) · Servicio técnico 30 días. El equipo queda notablemente más rápido: el disco actual (HDD) trabaja al 100% y es la causa principal de la lentitud. Antivirus con vigencia de 1 año a partir de su activación.')
    returning id into v_doc;
    insert into documento_items (documento_id, descripcion, detalle, cantidad, precio_unitario, total, garantia_dias, orden) values
      (v_doc, 'SSD ADATA SU650 240 GB', 'Unidad de estado sólido 2.5" SATA III · 520 MB/s lectura · 450 MB/s escritura · Incluye envío', 1, 792.5, 792.5, 365, 1),
      (v_doc, 'Servicio técnico de instalación y configuración', 'Instalación del SSD · Instalación limpia de Windows 11 Pro + drivers · Paquete de software básico (navegador, lector PDF, compresor, utilidades) · Respaldo de archivos', 1, 100.0, 100.0, 30, 2),
      (v_doc, 'Paquete de licencias', 'Windows 11 Pro · Microsoft Office 2021 Professional Plus · Antivirus 1 año · Para 1 equipo · Instalación y activación incluidas', 1, 200.0, 200.0, 0, 3);
  end if;

  -- COT-2026-11-004 · Hospital Centro Médico Zacapa · Q 5,000.00
  select id into v_cli from clientes where lower(nombre) = lower('Hospital Centro Médico Zacapa') limit 1;
  if v_cli is null then
    insert into clientes (nombre, nit, direccion, notas) values ('Hospital Centro Médico Zacapa', 'CF', 'Zacapa, Guatemala', 'Atención: Manuel — Departamento de IT')
    returning id into v_cli;
  end if;
  select numero into v_otra from documentos where tipo = 'COT' and cliente_id = v_cli and total = 5000.0 limit 1;
  if v_otra is not null then
    raise notice 'COT-2026-11-004: ya estaba en el sistema como %, se salta', v_otra;
  elsif exists (select 1 from documentos where numero = 'COT-2026-11-004') then
    raise exception 'El número COT-2026-11-004 ya lo tiene otro documento en el sistema. No se cargó nada; avísale a Claude.';
  else
    insert into documentos (tipo, numero, cliente_id, fecha, valida_hasta, estado, aplicar_iva, subtotal, iva, total, notas, condiciones)
    values ('COT', 'COT-2026-11-004', v_cli, '2026-11-06 12:00:00-06', '2026-11-21', 'pendiente', true, 4750.0, 250.0, 5000.0, 'Atención: Manuel — Departamento de IT', 'Sistema completo de 4 cámaras IP Hikvision 2MP con grabación en disco de 1 TB (aprox. 2 semanas de grabación continua). Incluye 80 m de cable 100% cobre y 80 m de canaleta (20 m por cámara); metros adicionales se cotizan por separado. Configuración de visualización remota en celular sin costo adicional. Garantía de 1 año en equipo por defectos de fábrica. Forma de pago: 50% de anticipo para programar la instalación y 50% al finalizar. Oferta válida por 15 días, sujeta a disponibilidad de inventario.')
    returning id into v_doc;
    insert into documento_items (documento_id, descripcion, detalle, cantidad, precio_unitario, total, garantia_dias, orden) values
      (v_doc, 'NVR Hikvision 4 canales PoE', 'Modelo DS-7104NI-Q1/4P · grabador de red con 4 puertos PoE integrados', 1, 750.0, 750.0, 365, 1),
      (v_doc, 'Cámara IP bala Hikvision 2MP', 'DS-2CD1023G2-LIU · Full HD, micrófono integrado, Smart Hybrid Light (IR 30 m / luz blanca 20 m), IP67', 4, 450.0, 1800.0, 365, 2),
      (v_doc, 'Disco duro 1 TB para videovigilancia', 'Almacenamiento para grabación continua de las 4 cámaras', 1, 350.0, 350.0, 365, 3),
      (v_doc, 'Cableado 100% cobre y conectores', 'Cable UTP Cat5e 100% cobre, 80 m (20 m por cámara) + conectores RJ45 con botas', 1, 200.0, 200.0, 0, 4),
      (v_doc, 'Canaleta plástica 80 m (20 m por cámara)', 'Incluye accesorios (uniones, codos, tapas) e instalación para cableado ordenado y protegido', 1, 950.0, 950.0, 0, 5),
      (v_doc, 'Instalación y configuración por cámara', 'Montaje, cableado, configuración del NVR y acceso remoto desde el celular', 4, 175.0, 700.0, 0, 6);
  end if;

  -- COT-2026-11-005 · Edna Raquel · Q 2,178.95
  select id into v_cli from clientes where lower(nombre) = lower('Edna Raquel') limit 1;
  if v_cli is null then
    insert into clientes (nombre, nit, direccion, notas) values ('Edna Raquel', 'CF', null, 'Sistema de videovigilancia existente (XVR Dahua 2MP)')
    returning id into v_cli;
  end if;
  select numero into v_otra from documentos where tipo = 'COT' and cliente_id = v_cli and total = 2178.95 limit 1;
  if v_otra is not null then
    raise notice 'COT-2026-11-005: ya estaba en el sistema como %, se salta', v_otra;
  elsif exists (select 1 from documentos where numero = 'COT-2026-11-005') then
    raise exception 'El número COT-2026-11-005 ya lo tiene otro documento en el sistema. No se cargó nada; avísale a Claude.';
  else
    insert into documentos (tipo, numero, cliente_id, fecha, valida_hasta, estado, aplicar_iva, subtotal, iva, total, notas, condiciones)
    values ('COT', 'COT-2026-11-005', v_cli, '2026-11-11 12:00:00-06', '2026-11-26', 'pendiente', true, 2070.0, 108.95, 2178.95, 'Sistema de videovigilancia existente (XVR Dahua 2MP) · Reubicación de cámaras, ampliación e iluminación solar', 'Precios en quetzales, incluyen impuestos (IVA 5%, Pequeño Contribuyente). El cambio de cableado incluye 90 m de cable UTP exterior; metros adicionales se cotizan por separado. La cámara Wi-Fi se agrega al XVR como canal IP (debe estar en la misma red que el XVR). El cable TSJ de 50 m para energía lo proporciona el cliente. Forma de pago: 50% de anticipo y 50% al finalizar la instalación. Garantía: 1 año en cámara y lámpara contra defectos de fábrica; 3 meses en mano de obra.')
    returning id into v_doc;
    insert into documento_items (documento_id, descripcion, detalle, cantidad, precio_unitario, total, garantia_dias, orden) values
      (v_doc, 'Reubicación de cámaras existentes', 'Desmontaje, traslado y montaje en nueva ubicación (portón, exterior y área donde Ahías)', 3, 90.0, 270.0, 90, 1),
      (v_doc, 'Cable UTP Cat5e exterior para cambio de cableado (metros)', '90 m: 18 m portón + 17 m exterior + 45 m donde Ahías, más 10% de holgura', 90, 3.0, 270.0, 0, 2),
      (v_doc, 'Cámara Imou Cruiser SE+ 2MP Wi-Fi PT 360°', 'IPC-S21FEN · seguimiento automático (autotracking), Full Color 30 m, audio 2 vías, sirena 110 dB, IP66. Se integra a su XVR Dahua como canal IP', 1, 770.0, 770.0, 365, 3),
      (v_doc, 'Bracket tipo cuello de ganso 600 mm', 'SpryWire SW-20X60L · aluminio resistente, para colocar la cámara en alto con buen ángulo', 1, 275.0, 275.0, 0, 4),
      (v_doc, 'Caja de registro exterior', 'Protección de conexiones de la cámara Wi-Fi', 1, 35.0, 35.0, 0, 5),
      (v_doc, 'Instalación de cámara Wi-Fi', 'Montaje en brazo, conexión al tramo de cable TSJ existente (50 m), configuración Wi-Fi y enlace al XVR', 1, 100.0, 100.0, 90, 6),
      (v_doc, 'Lámpara solar para exterior 12 m', 'Alumbra hasta 12 metros · sensor de movimiento · control remoto · cero recibo de luz', 1, 350.0, 350.0, 365, 7);
  end if;

  -- COT-2026-11-006 · Donald Martínez · Q 5,736.84
  select id into v_cli from clientes where lower(nombre) = lower('Donald Martínez') limit 1;
  if v_cli is null then
    insert into clientes (nombre, nit, direccion, notas) values ('Donald Martínez', 'CF', null, null)
    returning id into v_cli;
  end if;
  select numero into v_otra from documentos where tipo = 'COT' and cliente_id = v_cli and total = 5736.84 limit 1;
  if v_otra is not null then
    raise notice 'COT-2026-11-006: ya estaba en el sistema como %, se salta', v_otra;
  elsif exists (select 1 from documentos where numero = 'COT-2026-11-006') then
    raise exception 'El número COT-2026-11-006 ya lo tiene otro documento en el sistema. No se cargó nada; avísale a Claude.';
  else
    insert into documentos (tipo, numero, cliente_id, fecha, valida_hasta, estado, aplicar_iva, subtotal, iva, total, notas, condiciones)
    values ('COT', 'COT-2026-11-006', v_cli, '2026-11-09 12:00:00-06', '2026-11-12', 'pendiente', true, 5450.0, 286.84, 5736.84, 'Opción 2 · 8 cámaras movibles 3K con instalación', 'Precios en quetzales. Incluyen el 5% de impuesto (Régimen de Pequeño Contribuyente). La instalación incluye montaje y configuración del grabador (NVR) y de la app EZVIZ en su celular. Se aprovecha el cableado y las cajas de registro existentes. El grabador no incluye disco duro: sin disco se ven las cámaras en vivo, pero no se guardan grabaciones. El disco se puede agregar después. Se requiere red WiFi en el lugar y tomacorriente cerca de cada cámara. El grabador se conecta por HDMI a su TV o monitor (no incluido). Garantía de fábrica en el equipo por desperfectos y 3 meses en mano de obra. Forma de pago: 50% de anticipo para confirmar el pedido y 50% al finalizar la instalación. Cotización válida por 3 días.')
    returning id into v_doc;
    insert into documento_items (documento_id, descripcion, detalle, cantidad, precio_unitario, total, garantia_dias, orden) values
      (v_doc, 'Cámara EZVIZ H8C 3K movible 360°', 'Exterior, gira horizontal y vertical, seguimiento inteligente de personas, colores en la oscuridad, audio de dos vías, sirena', 8, 450.0, 3600.0, 0, 1),
      (v_doc, 'Grabador NVR WiFi EZVIZ 8 canales (sin disco duro)', 'CS-X5S, compresión H.265, salida HDMI/VGA, admite disco de hasta 8 TB', 1, 550.0, 550.0, 0, 2),
      (v_doc, 'Instalación y configuración del sistema', 'Montaje de 8 cámaras sobre el cableado y cajas de registro existentes, configuración del NVR y acceso remoto desde el celular', 8, 162.5, 1300.0, 90, 3);
  end if;

  -- COT-2026-11-007 · Colegio Liceo Cristiano Zacapaneco · Q 4,200.00
  select id into v_cli from clientes where lower(nombre) = lower('Colegio Liceo Cristiano Zacapaneco') limit 1;
  if v_cli is null then
    insert into clientes (nombre, nit, direccion, notas) values ('Colegio Liceo Cristiano Zacapaneco', 'CF', 'Zacapa, Guatemala', 'Directora: Licda. Raquel Aparicio · usa el Sistema de Notas (notas.tecnoinfo.info)')
    returning id into v_cli;
  end if;
  select numero into v_otra from documentos where tipo = 'COT' and cliente_id = v_cli and total = 4200.0 limit 1;
  if v_otra is not null then
    raise notice 'COT-2026-11-007: ya estaba en el sistema como %, se salta', v_otra;
  elsif exists (select 1 from documentos where numero = 'COT-2026-11-007') then
    raise exception 'El número COT-2026-11-007 ya lo tiene otro documento en el sistema. No se cargó nada; avísale a Claude.';
  else
    insert into documentos (tipo, numero, cliente_id, fecha, valida_hasta, estado, aplicar_iva, subtotal, iva, total, notas, condiciones)
    values ('COT', 'COT-2026-11-007', v_cli, '2026-11-13 12:00:00-06', '2026-12-13', 'pendiente', true, 3990.0, 210.0, 4200.0, 'Atención: Licda. Raquel Aparicio, Directora. Pago anticipado: si el año se cancela en un solo pago, el total es de Q 3,900.00 (ahorro de Q 300.00).', 'Precios en quetzales, incluyen IVA 5% (Pequeño Contribuyente). Pago mensual de Q 350.00 dentro de los primeros 5 días de cada mes, o pago anual anticipado. Vigencia del servicio: enero a diciembre de 2027. Nuevos módulos o cambios mayores al sistema se cotizan por separado.')
    returning id into v_doc;
    insert into documento_items (documento_id, descripcion, detalle, cantidad, precio_unitario, total, garantia_dias, orden) values
      (v_doc, 'Servicio de nube – Sistema de Notas', 'Alojamiento del sistema (notas.tecnoinfo.info), dominio, certificado SSL y respaldos periódicos. Pago mensual, enero a diciembre 2027.', 12, 190.0, 2280.0, 0, 1),
      (v_doc, 'Mantenimiento y soporte técnico anual', 'Preparación del ciclo 2027 (grados, secciones y estudiantes), ajuste del formato de impresión de notas, soporte a docentes y administración, y corrección de fallas. Pago mensual.', 12, 142.5, 1710.0, 0, 2);
  end if;

  -- Que la próxima cotización del sistema sea la COT-2026-11-008 (o la que siga si ya hay más)
  insert into contadores (prefijo, periodo, ultimo) values ('COT', '2026-11', 7)
  on conflict (prefijo, periodo) do update set ultimo = greatest(contadores.ultimo, 7);
end $$;

select numero, fecha::date, valida_hasta, total, estado from documentos where tipo = 'COT' order by numero;
