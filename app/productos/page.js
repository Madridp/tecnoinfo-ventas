'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { q, textoGarantia, errMsg } from '@/lib/format';
import { Modal, PageHeader, Field, Table } from '@/components/ui';

const VACIO = { sku: '', nombre: '', descripcion: '', categoria: 'General', proveedor: '', costo: 0, precio: 0,
  stock: 0, stock_minimo: 0, controla_stock: true, garantia_dias: 0, activo: true };

export default function Productos() {
  const [lista, setLista] = useState([]);
  const [buscar, setBuscar] = useState('');
  const [edit, setEdit] = useState(null);
  const [ajuste, setAjuste] = useState(null);

  const cargar = () => supabase.from('productos').select('*').order('nombre').then(({ data }) => setLista(data || []));
  useEffect(() => { cargar(); }, []);

  const filtrados = lista.filter((p) =>
    `${p.nombre} ${p.sku || ''} ${p.categoria || ''} ${p.proveedor || ''}`.toLowerCase().includes(buscar.toLowerCase()));

  return (
    <>
      <PageHeader title="Productos y servicios">
        <button className="btn-primary" onClick={() => setEdit(VACIO)}>+ Nuevo</button>
      </PageHeader>
      <input className="input mb-4" placeholder="Buscar por nombre, SKU, categoría o proveedor…" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
      <Table head={['Producto', 'Precio', 'Costo', 'Stock', 'Garantía', '']} empty={!filtrados.length && 'Sin productos'}>
        {filtrados.map((p) => (
          <tr key={p.id} className={p.activo ? '' : 'opacity-50'}>
            <td className="td">
              <div className="font-medium">{p.nombre}</div>
              <div className="text-xs text-gray-500">{[p.sku, p.categoria, p.proveedor].filter(Boolean).join(' · ')}</div>
            </td>
            <td className="td whitespace-nowrap">{q(p.precio)}</td>
            <td className="td whitespace-nowrap text-gray-500">{q(p.costo)}</td>
            <td className="td">
              {p.controla_stock
                ? <span className={p.stock <= p.stock_minimo ? 'text-red-600 font-semibold' : ''}>{p.stock}</span>
                : <span className="text-xs text-gray-400">Bajo pedido</span>}
            </td>
            <td className="td text-xs whitespace-nowrap">{textoGarantia(p.garantia_dias)}</td>
            <td className="td text-right whitespace-nowrap">
              {p.controla_stock && <button className="text-brand text-xs mr-3" onClick={() => setAjuste(p)}>Stock</button>}
              <button className="text-brand text-xs" onClick={() => setEdit(p)}>Editar</button>
            </td>
          </tr>
        ))}
      </Table>
      {edit && <FormProducto inicial={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); cargar(); }} />}
      {ajuste && <AjusteStock producto={ajuste} onClose={() => setAjuste(null)} onSaved={() => { setAjuste(null); cargar(); }} />}
    </>
  );
}

function FormProducto({ inicial, onClose, onSaved }) {
  const [f, setF] = useState(inicial);
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const margen = f.precio > 0 ? (((f.precio * 0.95) - f.costo) / (f.precio * 0.95)) * 100 : 0;

  async function guardar(e) {
    e.preventDefault();
    const { id, created_at, ...datos } = f;
    datos.sku = datos.sku || null;
    // El stock solo se fija al crear; luego se mueve con entradas/ajustes para que el kardex cuadre
    if (id) delete datos.stock;
    const { error } = id ? await supabase.from('productos').update(datos).eq('id', id)
      : await supabase.from('productos').insert(datos);
    if (error) return setErr(errMsg(error));
    onSaved();
  }

  return (
    <Modal title={f.id ? 'Editar producto' : 'Nuevo producto'} onClose={onClose}>
      <form onSubmit={guardar} className="grid grid-cols-2 gap-3">
        <Field label="Nombre" className="col-span-2"><input className="input" value={f.nombre} onChange={set('nombre')} required /></Field>
        <Field label="Descripción / especificaciones" className="col-span-2"><input className="input" value={f.descripcion || ''} onChange={set('descripcion')} /></Field>
        <Field label="SKU / código"><input className="input" value={f.sku || ''} onChange={set('sku')} /></Field>
        <Field label="Categoría"><input className="input" value={f.categoria || ''} onChange={set('categoria')} list="cats" /></Field>
        <datalist id="cats">{['Laptops', 'Computadoras', 'Accesorios', 'Licencias', 'CCTV', 'Redes', 'Servicios', 'Desarrollo web'].map((c) => <option key={c} value={c} />)}</datalist>
        <Field label="Proveedor" className="col-span-2"><input className="input" value={f.proveedor || ''} onChange={set('proveedor')} /></Field>
        <Field label="Costo (Q)"><input className="input" type="number" step="0.01" value={f.costo} onChange={set('costo')} /></Field>
        <Field label="Precio de venta sin IVA (Q)"><input className="input" type="number" step="0.01" value={f.precio} onChange={set('precio')} /></Field>
        <p className="col-span-2 text-xs text-gray-500 -mt-1">
          Con IVA 5%: <b>{q(f.precio / 0.95)}</b> · Margen: <b className={margen < 10 ? 'text-red-600' : 'text-green-700'}>{margen.toFixed(1)}%</b>
        </p>
        <Field label="Garantía (días)">
          <select className="input" value={f.garantia_dias} onChange={set('garantia_dias')}>
            {[0, 7, 30, 90, 180, 365, 730, 1095].map((d) => <option key={d} value={d}>{textoGarantia(d)}</option>)}
          </select>
        </Field>
        <Field label="Stock mínimo"><input className="input" type="number" value={f.stock_minimo} onChange={set('stock_minimo')} /></Field>
        <label className="col-span-2 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={f.controla_stock} onChange={set('controla_stock')} />
          Controlar existencias (desmarcar para servicios, licencias o productos bajo pedido)
        </label>
        {f.controla_stock && !f.id && <Field label="Existencia inicial"><input className="input" type="number" value={f.stock} onChange={set('stock')} /></Field>}
        {f.id && <label className="col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={f.activo} onChange={set('activo')} /> Activo (visible al vender)</label>}
        {err && <p className="col-span-2 text-sm text-red-600">{err}</p>}
        <button className="btn-primary col-span-2">Guardar</button>
      </form>
    </Modal>
  );
}

function AjusteStock({ producto, onClose, onSaved }) {
  const [tipo, setTipo] = useState('entrada');
  const [cant, setCant] = useState(1);
  const [nota, setNota] = useState('');
  const [err, setErr] = useState('');

  async function guardar(e) {
    e.preventDefault();
    const { error } = await supabase.rpc('ajustar_stock', { p_producto: producto.id, p_tipo: tipo, p_cantidad: Number(cant), p_nota: nota || null });
    if (error) return setErr(errMsg(error));
    onSaved();
  }

  return (
    <Modal title={`Stock · ${producto.nombre}`} onClose={onClose}>
      <form onSubmit={guardar} className="space-y-3">
        <p className="text-sm">Existencia actual: <b>{producto.stock}</b></p>
        <Field label="Tipo de movimiento">
          <select className="input" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="entrada">Entrada (compra a proveedor)</option>
            <option value="ajuste">Ajuste (+ suma / − resta por conteo, daño, etc.)</option>
          </select>
        </Field>
        <Field label="Cantidad"><input className="input" type="number" value={cant} onChange={(e) => setCant(e.target.value)} required /></Field>
        <Field label="Nota (proveedor, factura, motivo…)"><input className="input" value={nota} onChange={(e) => setNota(e.target.value)} /></Field>
        <p className="text-xs text-gray-500">Quedará en: <b>{producto.stock + Number(cant || 0)}</b></p>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button className="btn-primary w-full">Registrar</button>
      </form>
    </Modal>
  );
}
