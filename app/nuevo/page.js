'use client';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { CONDICIONES, METODOS_PAGO } from '@/lib/config';
import { q, textoGarantia, errMsg } from '@/lib/format';
import { Field } from '@/components/ui';
import { FormCliente, VACIO_CLIENTE } from '@/components/FormCliente';

export default function Page() {
  return <Suspense fallback={<p className="text-gray-400">Cargando…</p>}><NuevoDocumento /></Suspense>;
}

function NuevoDocumento() {
  const router = useRouter();
  const sp = useSearchParams();
  const tipo = sp.get('tipo') === 'COT' ? 'COT' : 'VTA';
  const editId = sp.get('id');          // editar cotización
  const desde = sp.get('desde');        // cargar líneas desde otro documento (convertir o duplicar)

  const [productos, setProductos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [clienteId, setClienteId] = useState('');
  const [items, setItems] = useState([]);
  const [buscar, setBuscar] = useState('');
  const [descuento, setDescuento] = useState(0);
  const [aplicarIva, setAplicarIva] = useState(true);
  const [metodo, setMetodo] = useState('efectivo');
  const [validaDias, setValidaDias] = useState(8);
  const [notas, setNotas] = useState('');
  const [condiciones, setCondiciones] = useState(CONDICIONES[tipo]);
  const [origenId, setOrigenId] = useState(null);
  const [nuevoCliente, setNuevoCliente] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    supabase.from('productos').select('*').eq('activo', true).order('nombre').then(({ data }) => setProductos(data || []));
    supabase.from('clientes').select('id,nombre,nit').order('nombre').then(({ data }) => {
      setClientes(data || []);
      if (!editId && !desde) setClienteId(data?.find((c) => c.nombre === 'Consumidor Final')?.id || '');
    });
    const fuente = editId || desde;
    if (fuente) {
      supabase.from('documentos').select('*, documento_items(*)').eq('id', fuente).single().then(({ data: d }) => {
        if (!d) return;
        setClienteId(d.cliente_id || '');
        setItems(d.documento_items.sort((a, b) => a.orden - b.orden).map(({ producto_id, descripcion, detalle, cantidad, precio_unitario, garantia_dias }) =>
          ({ key: Math.random(), producto_id, descripcion, detalle: detalle || '', cantidad, precio_unitario, garantia_dias })));
        setDescuento(d.descuento); setAplicarIva(d.aplicar_iva); setNotas(d.notas || '');
        if (editId) setCondiciones(d.condiciones || CONDICIONES.COT);
        if (tipo === 'VTA' && d.tipo === 'COT' && d.estado === 'pendiente') setOrigenId(d.id);
      });
    }
  }, [editId, desde, tipo]);

  const sugeridos = useMemo(() => {
    if (!buscar) return [];
    const b = buscar.toLowerCase();
    return productos.filter((p) => `${p.nombre} ${p.sku || ''} ${p.categoria}`.toLowerCase().includes(b)).slice(0, 8);
  }, [buscar, productos]);

  const agregar = (p) => {
    setItems([...items, p
      ? { key: Math.random(), producto_id: p.id, descripcion: p.nombre, detalle: p.descripcion || '', cantidad: 1, precio_unitario: p.precio, garantia_dias: p.garantia_dias }
      : { key: Math.random(), producto_id: null, descripcion: '', detalle: '', cantidad: 1, precio_unitario: 0, garantia_dias: 0 }]);
    setBuscar('');
  };
  const setItem = (key, campo, valor) => setItems(items.map((i) => (i.key === key ? { ...i, [campo]: valor } : i)));
  const quitar = (key) => setItems(items.filter((i) => i.key !== key));

  const bruto = items.reduce((s, i) => s + Math.round(i.cantidad * i.precio_unitario * 100) / 100, 0);
  const subtotal = bruto - Number(descuento || 0);
  const total = aplicarIva ? Math.round((subtotal / 0.95) * 100) / 100 : subtotal;

  async function guardar() {
    setErr('');
    if (!items.length) return setErr('Agrega al menos un producto');
    if (items.some((i) => !i.descripcion)) return setErr('Hay líneas sin descripción');
    if (tipo === 'VTA') {
      const falta = items.find((i) => {
        const p = productos.find((x) => x.id === i.producto_id);
        return p?.controla_stock && p.stock < i.cantidad;
      });
      if (falta) return setErr(`No hay existencia suficiente de "${falta.descripcion}". Registra la entrada en Productos → Stock.`);
    }
    setGuardando(true);
    const { data, error } = await supabase.rpc('guardar_documento', {
      p_tipo: tipo, p_cliente_id: clienteId || null,
      p_items: items.map(({ key, ...i }) => ({ ...i, cantidad: Number(i.cantidad), precio_unitario: Number(i.precio_unitario), garantia_dias: Number(i.garantia_dias) })),
      p_metodo_pago: metodo, p_aplicar_iva: aplicarIva, p_descuento: Number(descuento || 0),
      p_valida_dias: Number(validaDias), p_notas: notas || null, p_condiciones: condiciones || null,
      p_origen_id: origenId, p_id: editId || null,
    });
    setGuardando(false);
    if (error) return setErr(errMsg(error));
    router.push(`/documento/${data}`);
  }

  const titulo = editId ? 'Editar cotización' : tipo === 'COT' ? 'Nueva cotización' : 'Nueva venta';

  return (
    <div className="space-y-4 pb-24">
      <h1 className="text-xl font-semibold">{titulo}</h1>
      {origenId && <p className="text-sm bg-green-50 text-green-800 rounded-lg px-3 py-2">Convirtiendo cotización en venta. Al guardar, la cotización queda como <b>aceptada</b>.</p>}

      <div className="card grid sm:grid-cols-3 gap-3">
        <Field label="Cliente" className="sm:col-span-2">
          <div className="flex gap-2">
            <select className="input" value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
              <option value="">— Sin cliente —</option>
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre} · {c.nit}</option>)}
            </select>
            <button type="button" className="btn-ghost whitespace-nowrap" onClick={() => setNuevoCliente(true)}>+ Nuevo</button>
          </div>
        </Field>
        {tipo === 'VTA' ? (
          <Field label="Forma de pago">
            <select className="input" value={metodo} onChange={(e) => setMetodo(e.target.value)}>
              {METODOS_PAGO.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
        ) : (
          <Field label="Validez (días)"><input className="input" type="number" value={validaDias} onChange={(e) => setValidaDias(e.target.value)} /></Field>
        )}
      </div>

      <div className="card space-y-3">
        <div className="relative">
          <div className="flex gap-2">
            <input className="input" placeholder="Buscar producto o servicio para agregar…" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
            <button type="button" className="btn-ghost whitespace-nowrap" onClick={() => agregar(null)}>+ Línea libre</button>
          </div>
          {sugeridos.length > 0 && (
            <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-brand-line rounded-lg shadow-lg">
              {sugeridos.map((p) => (
                <button key={p.id} type="button" onClick={() => agregar(p)} className="w-full text-left px-3 py-2 hover:bg-brand-soft flex justify-between text-sm">
                  <span>{p.nombre} <span className="text-xs text-gray-400">{p.sku}</span></span>
                  <span className="text-gray-500">{q(p.precio)} {p.controla_stock && <span className={p.stock > 0 ? '' : 'text-red-500'}>· {p.stock} disp.</span>}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {items.map((i, n) => (
          <div key={i.key} className="border border-brand-line rounded-lg p-3 grid grid-cols-12 gap-2 bg-brand-soft/50">
            <span className="col-span-12 sm:col-span-1 text-xs text-gray-400 sm:pt-2">#{n + 1}</span>
            <div className="col-span-12 sm:col-span-6 space-y-1">
              <input className="input font-medium" placeholder="Descripción" value={i.descripcion} onChange={(e) => setItem(i.key, 'descripcion', e.target.value)} />
              <input className="input text-xs" placeholder="Detalle / especificaciones / No. de serie" value={i.detalle} onChange={(e) => setItem(i.key, 'detalle', e.target.value)} />
            </div>
            <Field label="Cant." className="col-span-3 sm:col-span-1"><input className="input" type="number" min="1" step="1" value={i.cantidad} onChange={(e) => setItem(i.key, 'cantidad', e.target.value)} /></Field>
            <Field label="P. unit. (sin IVA)" className="col-span-5 sm:col-span-2"><input className="input" type="number" step="0.01" value={i.precio_unitario} onChange={(e) => setItem(i.key, 'precio_unitario', e.target.value)} /></Field>
            <Field label="Garantía" className="col-span-4 sm:col-span-2">
              <select className="input" value={i.garantia_dias} onChange={(e) => setItem(i.key, 'garantia_dias', e.target.value)}>
                {[0, 7, 30, 90, 180, 365, 730, 1095].map((d) => <option key={d} value={d}>{textoGarantia(d)}</option>)}
              </select>
            </Field>
            <div className="col-span-12 flex justify-between text-sm">
              <span className="text-gray-500">{i.producto_id ? '' : 'Línea libre (no mueve inventario)'}</span>
              <span>Total línea: <b>{q(i.cantidad * i.precio_unitario)}</b> <button type="button" className="text-red-600 text-xs ml-3" onClick={() => quitar(i.key)}>Quitar</button></span>
            </div>
          </div>
        ))}
        {!items.length && <p className="text-sm text-gray-400 text-center py-4">Busca un producto arriba o agrega una línea libre.</p>}
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="card space-y-3">
          <Field label="Notas internas / para el cliente"><textarea className="input" rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} /></Field>
          <Field label="Condiciones (salen impresas)"><textarea className="input text-xs" rows={4} value={condiciones} onChange={(e) => setCondiciones(e.target.value)} /></Field>
        </div>
        <div className="card space-y-2 text-sm">
          <div className="flex justify-between"><span>Suma de líneas</span><span>{q(bruto)}</span></div>
          <div className="flex justify-between items-center gap-3"><span>Descuento (Q)</span>
            <input className="input w-28 text-right" type="number" step="0.01" value={descuento} onChange={(e) => setDescuento(e.target.value)} /></div>
          <div className="flex justify-between"><span>Subtotal</span><span>{q(subtotal)}</span></div>
          <label className="flex justify-between items-center">
            <span className="flex items-center gap-2"><input type="checkbox" checked={aplicarIva} onChange={(e) => setAplicarIva(e.target.checked)} /> IVA 5% (Peq. Contribuyente)</span>
            <span>{q(total - subtotal)}</span>
          </label>
          <div className="flex justify-between text-lg font-semibold bg-brand text-white rounded-lg px-3 py-2"><span>TOTAL</span><span>{q(total)}</span></div>
        </div>
      </div>

      <div className="fixed bottom-0 inset-x-0 bg-white border-t p-3 no-print z-20">
        <div className="max-w-6xl mx-auto flex items-center justify-end gap-3">
          {err && <p className="text-sm text-red-600 flex-1">{err}</p>}
          <button className="btn-ghost" onClick={() => router.back()}>Cancelar</button>
          <button className="btn-primary px-6" disabled={guardando} onClick={guardar}>
            {guardando ? 'Guardando…' : tipo === 'COT' ? 'Guardar cotización' : `Registrar venta · ${q(total)}`}
          </button>
        </div>
      </div>

      {nuevoCliente && <FormCliente inicial={VACIO_CLIENTE} onClose={() => setNuevoCliente(false)}
        onSaved={(c) => { setClientes([...clientes, c].sort((a, b) => a.nombre.localeCompare(b.nombre))); setClienteId(c.id); setNuevoCliente(false); }} />}
    </div>
  );
}
