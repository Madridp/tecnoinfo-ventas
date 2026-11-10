'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { q, fechaHora } from '@/lib/format';
import { PageHeader, Table, Badge } from '@/components/ui';

const ETIQUETA = { entrada: 'Entrada', salida: 'Venta', ajuste: 'Ajuste', anulacion: 'Anulación', devolucion: 'Devolución', reemplazo: 'Reemplazo' };

export default function Inventario() {
  const [productos, setProductos] = useState([]);
  const [movs, setMovs] = useState([]);
  const [prod, setProd] = useState('');

  useEffect(() => {
    supabase.from('productos').select('id,nombre,stock,costo,precio').eq('controla_stock', true).order('nombre').then(({ data }) => setProductos(data || []));
  }, []);
  useEffect(() => {
    let qy = supabase.from('movimientos_inventario').select('*, productos(nombre)').order('created_at', { ascending: false }).limit(200);
    if (prod) qy = qy.eq('producto_id', prod);
    qy.then(({ data }) => setMovs(data || []));
  }, [prod]);

  const valorCosto = productos.reduce((s, p) => s + p.stock * p.costo, 0);
  const valorVenta = productos.reduce((s, p) => s + p.stock * p.precio, 0);
  const unidades = productos.reduce((s, p) => s + p.stock, 0);

  return (
    <>
      <PageHeader title="Inventario" />
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="card"><p className="text-xs text-gray-500">Unidades en bodega</p><p className="text-lg font-semibold">{unidades}</p></div>
        <div className="card"><p className="text-xs text-gray-500">Valor al costo</p><p className="text-lg font-semibold">{q(valorCosto)}</p></div>
        <div className="card"><p className="text-xs text-gray-500">Valor a precio venta</p><p className="text-lg font-semibold">{q(valorVenta)}</p></div>
      </div>
      <div className="flex gap-2 items-center mb-3">
        <h2 className="font-semibold">Kardex</h2>
        <select className="input w-auto ml-auto" value={prod} onChange={(e) => setProd(e.target.value)}>
          <option value="">Todos los productos</option>
          {productos.map((p) => <option key={p.id} value={p.id}>{p.nombre} ({p.stock})</option>)}
        </select>
      </div>
      <Table head={['Fecha', 'Producto', 'Movimiento', 'Cant.', 'Queda', 'Referencia']} empty={!movs.length && 'Sin movimientos'}>
        {movs.map((m) => (
          <tr key={m.id}>
            <td className="td whitespace-nowrap text-xs">{fechaHora(m.created_at)}</td>
            <td className="td">{m.productos?.nombre}</td>
            <td className="td"><Badge estado={m.cantidad > 0 ? 'aceptada' : 'pendiente'}>{ETIQUETA[m.tipo]}</Badge></td>
            <td className={`td font-semibold ${m.cantidad > 0 ? 'text-green-700' : 'text-red-600'}`}>{m.cantidad > 0 ? '+' : ''}{m.cantidad}</td>
            <td className="td">{m.stock_resultante}</td>
            <td className="td text-xs text-gray-600">{[m.referencia, m.nota].filter(Boolean).join(' · ')}</td>
          </tr>
        ))}
      </Table>
    </>
  );
}
