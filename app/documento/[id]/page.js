'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { NEGOCIO, METODOS_PAGO } from '@/lib/config';
import { q, fecha, sumarDias, textoGarantia, errMsg } from '@/lib/format';
import { Badge } from '@/components/ui';
import { BloqueFirma } from '@/components/Firmas';

export default function Documento() {
  const { id } = useParams();
  const router = useRouter();
  const [d, setD] = useState(null);

  const cargar = () => supabase.from('documentos')
    .select('*, clientes(*), documento_items(*), origen:origen_id(numero)')
    .eq('id', id).single().then(({ data }) => setD(data));
  useEffect(() => { cargar(); }, [id]);

  if (!d) return <p className="text-gray-400">Cargando…</p>;
  const esCot = d.tipo === 'COT';
  const items = [...d.documento_items].sort((a, b) => a.orden - b.orden);
  const c = d.clientes;

  async function anular() {
    const motivo = prompt('Motivo de la anulación (el inventario regresa automáticamente):');
    if (!motivo) return;
    const { error } = await supabase.rpc('anular_venta', { p_id: d.id, p_motivo: motivo });
    if (error) return alert(errMsg(error));
    cargar();
  }
  async function rechazar() {
    if (!confirm('¿Marcar la cotización como rechazada?')) return;
    await supabase.from('documentos').update({ estado: 'rechazada' }).eq('id', d.id);
    cargar();
  }
  function whatsapp() {
    const tel = (c?.telefono || '').replace(/\D/g, '').slice(-8);
    const txt = `Hola ${c?.nombre || ''}, le saluda ${NEGOCIO.nombre}. Le comparto su ${esCot ? 'cotización' : 'recibo'} No. ${d.numero} por un total de ${q(d.total)}.${esCot ? ` Válida hasta el ${fecha(d.valida_hasta)}.` : ' ¡Gracias por su compra!'}`;
    window.open(`https://wa.me/${tel ? '502' + tel : ''}?text=${encodeURIComponent(txt)}`, '_blank');
  }
  function imprimir() {
    const t = document.title;
    document.title = `${d.numero}${c ? ' - ' + c.nombre : ''}`;   // nombre del PDF al guardar
    window.print();
    document.title = t;
  }

  return (
    <>
      <div className="no-print flex flex-wrap items-center gap-2 mb-4">
        <Link href={esCot ? '/cotizaciones' : '/ventas'} className="text-sm text-brand mr-2">← Volver</Link>
        <Badge estado={d.estado} />
        <div className="flex-1" />
        <button className="btn-primary" onClick={imprimir}>Imprimir / PDF</button>
        <button className="btn-ghost" onClick={whatsapp}>WhatsApp</button>
        {esCot && d.estado === 'pendiente' && <>
          <Link className="btn-ghost" href={`/nuevo?tipo=COT&id=${d.id}`}>Editar</Link>
          <Link className="btn-primary bg-green-700 hover:bg-green-800" href={`/nuevo?tipo=VTA&desde=${d.id}`}>Convertir en venta</Link>
          <button className="btn-danger" onClick={rechazar}>Rechazada</button>
        </>}
        <Link className="btn-ghost" href={`/nuevo?tipo=COT&desde=${d.id}`}>Duplicar como cotización</Link>
        {!esCot && d.estado !== 'anulada' && <>
          <Link className="btn-ghost" href={`/garantias?nuevo=1&venta=${d.numero}`}>Garantía / devolución</Link>
          <button className="btn-danger" onClick={anular}>Anular</button>
        </>}
      </div>
      {d.estado === 'anulada' && <p className="no-print mb-3 text-sm bg-red-50 text-red-700 rounded-lg px-3 py-2">Venta anulada: {d.motivo_anulacion}</p>}

      {/* ======= Hoja imprimible ======= */}
      <div className="bg-white max-w-[820px] mx-auto p-8 sm:p-10 shadow-sm print:shadow-none print:p-0 text-[13px] relative">
        {d.estado === 'anulada' && <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-red-500/20 text-8xl font-bold -rotate-12">ANULADA</div>}
        <div className="flex justify-between items-start gap-6">
          <img src="/logo.png" alt={NEGOCIO.nombre} className="h-20 object-contain" />
          <div className="text-right">
            <p className="text-2xl font-bold text-brand tracking-wide">{esCot ? 'COTIZACIÓN' : 'RECIBO DE VENTA'}</p>
            <p className="font-semibold mt-1">No. {d.numero}</p>
            <p className="text-gray-600">Fecha: {fecha(d.fecha)}</p>
            {esCot && <p className="text-gray-600">Válida hasta: {fecha(d.valida_hasta)}</p>}
            {!esCot && d.origen && <p className="text-gray-500 text-xs">Ref. {d.origen.numero}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-6">
          <div className="rounded-lg p-3 bg-brand-soft border border-brand-line">
            <p className="text-[10px] font-semibold text-brand uppercase tracking-wider mb-1">Cliente</p>
            <p className="font-semibold">{c?.nombre || 'Consumidor Final'}</p>
            <p>NIT: {c?.nit || 'CF'}</p>
            {c?.telefono && <p>Tel: {c.telefono}</p>}
            {c?.direccion && <p className="text-gray-600">{c.direccion}</p>}
          </div>
          <div className="rounded-lg p-3 bg-brand-soft border border-brand-line">
            <p className="text-[10px] font-semibold text-brand uppercase tracking-wider mb-1">Proveedor</p>
            <p className="font-semibold">{NEGOCIO.nombre}</p>
            <p>{NEGOCIO.responsable}</p>
            <p>Tel / WhatsApp: {NEGOCIO.telefono}</p>
            {!esCot && <p>Pago: {METODOS_PAGO.find(([v]) => v === d.metodo_pago)?.[1]}</p>}
          </div>
        </div>

        <table className="w-full mt-6 border-collapse">
          <thead>
            <tr className="bg-brand text-white text-xs [-webkit-print-color-adjust:exact] [print-color-adjust:exact]">
              <th className="p-2 text-left w-8">#</th>
              <th className="p-2 text-left">Descripción</th>
              <th className="p-2 text-center w-14">Cant.</th>
              <th className="p-2 text-right w-24">P. Unitario</th>
              <th className="p-2 text-right w-24">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i, n) => (
              <tr key={i.id} className="border-b border-brand-line align-top">
                <td className="p-2 text-gray-500">{n + 1}</td>
                <td className="p-2">
                  <p className="font-semibold">{i.descripcion}</p>
                  {i.detalle && <p className="text-gray-500 text-xs">{i.detalle}</p>}
                  {i.garantia_dias > 0 && (
                    <p className="text-xs text-brand">
                      Garantía: {textoGarantia(i.garantia_dias)}{!esCot && ` · vence ${fecha(sumarDias(d.fecha, i.garantia_dias).toISOString())}`}
                    </p>
                  )}
                </td>
                <td className="p-2 text-center">{Number(i.cantidad)}</td>
                <td className="p-2 text-right">{q(i.precio_unitario)}</td>
                <td className="p-2 text-right">{q(i.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end mt-4">
          <div className="w-64 space-y-1">
            {d.descuento > 0 && <div className="flex justify-between"><span>Descuento</span><span>-{q(d.descuento)}</span></div>}
            <div className="flex justify-between"><span>Subtotal</span><span>{q(d.subtotal)}</span></div>
            {d.aplicar_iva && <div className="flex justify-between"><span>IVA (5%)</span><span>{q(d.iva)}</span></div>}
            <div className="flex justify-between bg-brand text-white font-bold rounded px-2 py-1.5 text-base [-webkit-print-color-adjust:exact] [print-color-adjust:exact]">
              <span>TOTAL</span><span>{q(d.total)}</span>
            </div>
          </div>
        </div>

        {d.notas && <p className="mt-4 text-gray-700"><b>Notas:</b> {d.notas}</p>}
        {d.condiciones && (
          <div className="mt-5 border-l-4 border-brand-accent bg-brand-soft p-3 text-xs text-gray-700">
            <p className="font-semibold text-brand-dark mb-1">Condiciones</p>
            {d.condiciones}
          </div>
        )}
        {d.estado !== 'anulada' && d.estado !== 'rechazada' && (
          <div className="grid grid-cols-2 gap-10 mt-10 items-end">
            <div className="text-center text-xs text-gray-500">
              <div className="h-16" />
              <div className="border-t border-gray-400 pt-1">{esCot ? `${NEGOCIO.responsable} · ${NEGOCIO.nombre}` : `Entregado por ${NEGOCIO.nombre}`}</div>
            </div>
            <BloqueFirma documentoId={d.id} momento={esCot ? 'aceptacion' : 'entrega'} cliente={c} numero={d.numero} />
          </div>
        )}
        <div className="flex justify-between items-center mt-8 pt-3 border-t border-brand-line text-xs">
          <span className="font-semibold text-brand">¡Gracias por su preferencia!</span>
          <span className="text-gray-500">{NEGOCIO.nombre} · {NEGOCIO.telefono} · {NEGOCIO.web}</span>
        </div>
        {!esCot && <p className="text-[10px] text-gray-400 mt-2 text-center">Este recibo es un comprobante interno de venta y garantía; no sustituye la factura electrónica (FEL).</p>}
      </div>
    </>
  );
}
