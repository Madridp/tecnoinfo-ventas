'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { NEGOCIO, ESTADOS_CASO } from '@/lib/config';
import { q, fecha, fechaHora, sumarDias, textoGarantia, errMsg } from '@/lib/format';
import { Field, Badge } from '@/components/ui';
import { BloqueFirma, BloqueFirmaEmisor } from '@/components/Firmas';

export default function Caso() {
  const { id } = useParams();
  const [c, setC] = useState(null);
  const [f, setF] = useState({ estado: '', resolucion: '', monto: 0, reintegrar: false });
  const [msg, setMsg] = useState('');

  const cargar = () => supabase.from('casos')
    .select('*, clientes(*), venta:venta_id(numero,fecha), item:item_id(descripcion,detalle,precio_unitario,garantia_dias,producto_id)')
    .eq('id', id).single().then(({ data }) => {
      setC(data);
      if (data) setF({ estado: data.estado, resolucion: data.resolucion || '', monto: data.monto_reembolso, reintegrar: data.stock_reintegrado });
    });
  useEffect(() => { cargar(); }, [id]);

  if (!c) return <p className="text-gray-400">Cargando…</p>;
  const etiqueta = (e) => ESTADOS_CASO.find(([v]) => v === e)?.[1];
  const vence = sumarDias(c.venta.fecha, c.item.garantia_dias);

  async function actualizar(e) {
    e.preventDefault(); setMsg('');
    const { error } = await supabase.rpc('actualizar_caso', {
      p_id: c.id, p_estado: f.estado, p_resolucion: f.resolucion || null, p_monto: Number(f.monto || 0), p_reintegrar: f.reintegrar,
    });
    if (error) return setMsg(errMsg(error));
    setMsg('Guardado ✓'); cargar();
  }
  function whatsapp() {
    const tel = (c.clientes?.telefono || '').replace(/\D/g, '').slice(-8);
    const txt = `Hola ${c.clientes?.nombre || ''}, le saluda ${NEGOCIO.nombre}. Su caso ${c.numero} (${c.item.descripcion}) está: ${etiqueta(c.estado)}.${c.resolucion ? ' ' + c.resolucion : ''}`;
    window.open(`https://wa.me/${tel ? '502' + tel : ''}?text=${encodeURIComponent(txt)}`, '_blank');
  }

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-5">
      <div>
        <div className="no-print flex flex-wrap gap-2 items-center mb-4">
          <Link href="/garantias" className="text-sm text-brand mr-2">← Volver</Link>
          <Badge estado={c.estado}>{etiqueta(c.estado)}</Badge>
          <div className="flex-1" />
          <button className="btn-primary" onClick={() => window.print()}>Imprimir comprobante</button>
          <button className="btn-ghost" onClick={whatsapp}>Avisar por WhatsApp</button>
        </div>

        {/* ======= Comprobante imprimible ======= */}
        <div className="bg-white max-w-[820px] p-8 shadow-sm print:shadow-none print:p-0 text-[13px]">
          <div className="flex justify-between items-start">
            <img src="/logo.png" alt={NEGOCIO.nombre} className="h-16 object-contain" />
            <div className="text-right">
              <p className="text-xl font-bold text-brand">{c.tipo === 'garantia' ? 'RECEPCIÓN POR GARANTÍA' : 'SOLICITUD DE DEVOLUCIÓN'}</p>
              <p className="font-semibold">No. {c.numero}</p>
              <p className="text-gray-600">Recibido: {fechaHora(c.fecha_recepcion)}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-5">
            <div className="rounded-lg p-3 bg-brand-soft border border-brand-line">
              <p className="text-[10px] font-semibold text-brand uppercase mb-1">Cliente</p>
              <p className="font-semibold">{c.clientes?.nombre || 'Consumidor Final'}</p>
              {c.clientes?.telefono && <p>Tel: {c.clientes.telefono}</p>}
            </div>
            <div className="rounded-lg p-3 bg-brand-soft border border-brand-line">
              <p className="text-[10px] font-semibold text-brand uppercase mb-1">Compra</p>
              <p>Recibo: <b>{c.venta.numero}</b> del {fecha(c.venta.fecha)}</p>
              <p>Garantía: {textoGarantia(c.item.garantia_dias)} · vence {fecha(vence.toISOString())}</p>
              <p className={c.en_garantia ? 'text-green-700 font-semibold' : 'text-red-600 font-semibold'}>
                {c.en_garantia ? 'Dentro del plazo de garantía' : 'FUERA del plazo de garantía'}
              </p>
            </div>
          </div>
          <table className="w-full mt-5 text-left">
            <tbody>
              <Fila k="Producto" v={<><b>{c.item.descripcion}</b> × {c.cantidad}{c.item.detalle && <span className="block text-xs text-gray-500">{c.item.detalle}</span>}</>} />
              <Fila k="Falla / motivo" v={c.motivo} />
              <Fila k="Estado en que se recibe" v={c.estado_equipo || '—'} />
              <Fila k="Estado del caso" v={etiqueta(c.estado)} />
              {c.resolucion && <Fila k="Resolución" v={c.resolucion} />}
              {c.monto_reembolso > 0 && <Fila k="Reembolso" v={q(c.monto_reembolso)} />}
            </tbody>
          </table>
          <div className="mt-5 border-l-4 border-brand-accent bg-brand-soft p-3 text-xs text-gray-700">
            El equipo queda en revisión técnica. La garantía cubre únicamente defectos de fábrica; no cubre golpes, humedad,
            variaciones de voltaje, manipulación por terceros ni pérdida de información (respalde sus datos). Si la falla no es
            cubierta se le informará el costo antes de cualquier reparación. Equipos no retirados 60 días después de notificado
            se consideran abandonados. Presente este comprobante para retirar el equipo.
          </div>
          <div className="grid grid-cols-3 gap-6 mt-10 items-end">
            <BloqueFirmaEmisor casoId={c.id} tipo="CASO" numero={c.numero} />
            <BloqueFirma casoId={c.id} momento="recepcion" cliente={c.clientes} numero={c.numero} />
            <BloqueFirma casoId={c.id} momento="retiro" cliente={c.clientes} numero={c.numero} />
          </div>
          <p className="text-center text-xs text-gray-500 mt-6 pt-3 border-t border-brand-line">{NEGOCIO.nombre} · {NEGOCIO.telefono} · {NEGOCIO.web}</p>
        </div>
      </div>

      <form onSubmit={actualizar} className="card space-y-3 h-fit no-print">
        <h2 className="font-semibold">Seguimiento</h2>
        <Field label="Estado">
          <select className="input" value={f.estado} onChange={(e) => setF({ ...f, estado: e.target.value })}>
            {ESTADOS_CASO.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Field>
        <Field label="Resolución / diagnóstico"><textarea className="input" rows={3} value={f.resolucion} onChange={(e) => setF({ ...f, resolucion: e.target.value })} /></Field>
        {(c.tipo === 'devolucion' || f.estado === 'reembolsado') && (
          <Field label="Monto reembolsado (Q)"><input className="input" type="number" step="0.01" value={f.monto} onChange={(e) => setF({ ...f, monto: e.target.value })} /></Field>
        )}
        {c.item.producto_id && (
          <label className="flex gap-2 text-sm items-start">
            <input type="checkbox" className="mt-1" checked={f.reintegrar} disabled={c.stock_reintegrado} onChange={(e) => setF({ ...f, reintegrar: e.target.checked })} />
            <span>Regresar el producto al inventario (está en buen estado para revender)
              {c.stock_reintegrado && <span className="block text-xs text-green-700">Ya reintegrado</span>}</span>
          </label>
        )}
        {f.estado === 'reemplazado' && !c.reemplazo_descontado && c.item.producto_id &&
          <p className="text-xs text-amber-700 bg-amber-50 rounded p-2">Al guardar se descontará {c.cantidad} unidad(es) del inventario por el reemplazo entregado.</p>}
        {msg && <p className={`text-sm ${msg.includes('✓') ? 'text-green-700' : 'text-red-600'}`}>{msg}</p>}
        <button className="btn-primary w-full">Guardar seguimiento</button>
        <p className="text-xs text-gray-400">El caso se cierra al marcarlo como Reembolsado, Rechazado o Entregado.</p>
      </form>
    </div>
  );
}

function Fila({ k, v }) {
  return (
    <tr className="border-b border-brand-line align-top">
      <th className="py-2 pr-4 text-xs text-gray-500 font-medium w-44">{k}</th>
      <td className="py-2">{v}</td>
    </tr>
  );
}
