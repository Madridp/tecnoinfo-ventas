'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ESTADOS_CASO } from '@/lib/config';
import { fecha, sumarDias, textoGarantia, errMsg } from '@/lib/format';
import { Modal, PageHeader, Field, Table, Badge } from '@/components/ui';

export default function Page() {
  return <Suspense fallback={<p className="text-gray-400">Cargando…</p>}><Garantias /></Suspense>;
}

function Garantias() {
  const router = useRouter();
  const sp = useSearchParams();
  const [lista, setLista] = useState([]);
  const [soloAbiertos, setSoloAbiertos] = useState(true);
  const [buscar, setBuscar] = useState('');
  const [nuevo, setNuevo] = useState(sp.get('nuevo') === '1');

  useEffect(() => {
    let qy = supabase.from('casos').select('*, clientes(nombre), venta:venta_id(numero), item:item_id(descripcion)').order('fecha_recepcion', { ascending: false });
    if (soloAbiertos) qy = qy.is('fecha_cierre', null);
    qy.then(({ data }) => setLista(data || []));
  }, [soloAbiertos]);

  const filtrados = lista.filter((c) => `${c.numero} ${c.venta?.numero} ${c.clientes?.nombre || ''} ${c.item?.descripcion}`.toLowerCase().includes(buscar.toLowerCase()));

  return (
    <>
      <PageHeader title="Garantías y devoluciones">
        <button className="btn-primary" onClick={() => setNuevo(true)}>+ Nuevo caso</button>
      </PageHeader>
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={soloAbiertos} onChange={(e) => setSoloAbiertos(e.target.checked)} /> Solo abiertos</label>
        <input className="input flex-1 min-w-[200px]" placeholder="Buscar caso, recibo, cliente o producto…" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
      </div>
      <Table head={['Caso', 'Recibido', 'Cliente / producto', 'Tipo', 'Estado']} empty={!filtrados.length && 'Sin casos'}>
        {filtrados.map((c) => (
          <tr key={c.id} className="cursor-pointer hover:bg-brand-soft" onClick={() => router.push(`/garantias/${c.id}`)}>
            <td className="td font-medium whitespace-nowrap">{c.numero}<div className="text-xs text-gray-400">{c.venta?.numero}</div></td>
            <td className="td whitespace-nowrap">{fecha(c.fecha_recepcion)}</td>
            <td className="td">{c.clientes?.nombre || 'Consumidor Final'}<div className="text-xs text-gray-500">{c.item?.descripcion}</div></td>
            <td className="td">
              {c.tipo === 'garantia' ? 'Garantía' : 'Devolución'}
              {!c.en_garantia && <span className="badge bg-red-100 text-red-700 ml-1">fuera de plazo</span>}
            </td>
            <td className="td"><Badge estado={c.estado}>{ESTADOS_CASO.find(([v]) => v === c.estado)?.[1]}</Badge></td>
          </tr>
        ))}
      </Table>
      {nuevo && <NuevoCaso reciboInicial={sp.get('venta') || ''} onClose={() => setNuevo(false)} onSaved={(id) => router.push(`/garantias/${id}`)} />}
    </>
  );
}

function NuevoCaso({ reciboInicial, onClose, onSaved }) {
  const [recibo, setRecibo] = useState(reciboInicial);
  const [venta, setVenta] = useState(null);
  const [itemId, setItemId] = useState('');
  const [tipo, setTipo] = useState('garantia');
  const [cantidad, setCantidad] = useState(1);
  const [motivo, setMotivo] = useState('');
  const [estadoEquipo, setEstadoEquipo] = useState('');
  const [err, setErr] = useState('');

  async function buscarVenta(num = recibo) {
    setErr(''); setVenta(null);
    const { data } = await supabase.from('documentos').select('*, clientes(nombre), documento_items(*)')
      .eq('tipo', 'VTA').ilike('numero', `%${num.trim()}%`).neq('estado', 'anulada').limit(1).maybeSingle();
    if (!data) return setErr('No se encontró una venta vigente con ese número');
    setVenta(data);
    setItemId(data.documento_items[0]?.id || '');
  }
  useEffect(() => { if (reciboInicial) buscarVenta(reciboInicial); }, []);

  async function guardar(e) {
    e.preventDefault();
    const { data, error } = await supabase.rpc('registrar_caso', {
      p_tipo: tipo, p_item_id: itemId, p_cantidad: Number(cantidad), p_motivo: motivo, p_estado_equipo: estadoEquipo || null,
    });
    if (error) return setErr(errMsg(error));
    onSaved(data);
  }

  const hoy = new Date();
  return (
    <Modal title="Nuevo caso de garantía / devolución" onClose={onClose}>
      <div className="flex gap-2 mb-4">
        <input className="input" placeholder="No. de recibo (ej. REC-2026-11-001)" value={recibo} onChange={(e) => setRecibo(e.target.value)} />
        <button className="btn-ghost" onClick={() => buscarVenta()}>Buscar</button>
      </div>
      {venta && (
        <form onSubmit={guardar} className="space-y-3">
          <p className="text-sm">{venta.numero} · {fecha(venta.fecha)} · <b>{venta.clientes?.nombre || 'Consumidor Final'}</b></p>
          <div className="space-y-2">
            {venta.documento_items.sort((a, b) => a.orden - b.orden).map((i) => {
              const vence = sumarDias(venta.fecha, i.garantia_dias);
              const vigente = i.garantia_dias > 0 && vence >= hoy;
              return (
                <label key={i.id} className={`flex gap-3 items-start border rounded-lg p-2 text-sm cursor-pointer ${itemId === i.id ? 'border-brand bg-brand-soft' : ''}`}>
                  <input type="radio" name="item" checked={itemId === i.id} onChange={() => setItemId(i.id)} className="mt-1" />
                  <span className="flex-1">
                    <b>{i.descripcion}</b> × {Number(i.cantidad)}
                    {i.detalle && <span className="block text-xs text-gray-500">{i.detalle}</span>}
                    <span className={`block text-xs ${vigente ? 'text-green-700' : 'text-red-600'}`}>
                      {i.garantia_dias ? `${textoGarantia(i.garantia_dias)} · ${vigente ? 'vigente' : 'vencida'} (vence ${fecha(vence.toISOString())})` : 'Sin garantía'}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo">
              <select className="input" value={tipo} onChange={(e) => setTipo(e.target.value)}>
                <option value="garantia">Garantía (reparar / cambiar)</option>
                <option value="devolucion">Devolución (reembolso)</option>
              </select>
            </Field>
            <Field label="Cantidad"><input className="input" type="number" min="1" value={cantidad} onChange={(e) => setCantidad(e.target.value)} /></Field>
          </div>
          <Field label="Falla o motivo reportado por el cliente"><textarea className="input" rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} required /></Field>
          <Field label="Cómo se recibe el equipo (accesorios, golpes, serie…)"><textarea className="input" rows={2} value={estadoEquipo} onChange={(e) => setEstadoEquipo(e.target.value)} /></Field>
          {err && <p className="text-sm text-red-600">{err}</p>}
          <button className="btn-primary w-full">Registrar y generar comprobante</button>
        </form>
      )}
      {!venta && err && <p className="text-sm text-red-600">{err}</p>}
    </Modal>
  );
}
