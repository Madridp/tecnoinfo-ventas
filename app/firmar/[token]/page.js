'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { FIRMA, NEGOCIO } from '@/lib/config';
import { q, fecha, textoGarantia, errMsg } from '@/lib/format';
import FirmaPad from '@/components/FirmaPad';

// Página que abre el cliente desde el enlace de WhatsApp. No requiere cuenta.
export default function Firmar() {
  const { token } = useParams();
  const [info, setInfo] = useState(null);
  const [listo, setListo] = useState(false);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    supabase.rpc('info_firma', { p_token: token }).then(({ data, error }) =>
      setInfo(error ? { error: 'Enlace no válido' } : data || { error: 'Enlace no válido' }));
  }, [token]);

  async function firmar({ nombre, dpi, firma }) {
    setEnviando(true);
    const { error } = await supabase.rpc('firmar_con_token', {
      p_token: token, p_nombre: nombre, p_dpi: dpi, p_firma: firma, p_user_agent: navigator.userAgent,
    });
    setEnviando(false);
    if (error) return alert(errMsg(error));
    setListo(true);
  }


  if (!info) return <Marco><p className="text-center text-gray-400">Cargando…</p></Marco>;
  if (info.error) return <Marco><p className="text-center py-6">{info.error}</p></Marco>;
  if (listo) return (
    <Marco>
      <div className="text-center py-6 space-y-2">
        <div className="text-5xl">✓</div>
        <p className="font-semibold text-lg">¡Firma recibida!</p>
        <p className="text-sm text-gray-600">Gracias, {info.cliente || ''}. Ya puedes cerrar esta página.</p>
      </div>
    </Marco>
  );

  const cfg = FIRMA[info.momento];
  const titulos = { COT: 'Cotización', VTA: 'Recibo de venta', CASO: info.subtipo === 'garantia' ? 'Garantía' : 'Devolución' };

  return (
    <Marco>
      <div className="text-center">
        <p className="text-xs uppercase tracking-wider text-brand font-semibold">{titulos[info.tipo]}</p>
        <p className="text-xl font-bold">{info.numero}</p>
        <p className="text-sm text-gray-500">{fecha(info.fecha)}{info.cliente && ` · ${info.cliente}`}</p>
      </div>

      {info.tipo !== 'CASO' ? (
        <div className="border border-brand-line rounded-xl divide-y divide-brand-line text-sm">
          {(info.items || []).map((i, n) => (
            <div key={n} className="p-3 flex justify-between gap-3">
              <div>
                <p className="font-medium">{Number(i.cantidad)} × {i.descripcion}</p>
                {i.detalle && <p className="text-xs text-gray-500">{i.detalle}</p>}
                {i.garantia_dias > 0 && <p className="text-xs text-brand">Garantía: {textoGarantia(i.garantia_dias)}</p>}
              </div>
              <span className="whitespace-nowrap">{q(i.total)}</span>
            </div>
          ))}
          <div className="p-3 flex justify-between font-bold bg-brand text-white rounded-b-xl"><span>TOTAL</span><span>{q(info.total)}</span></div>
        </div>
      ) : (
        <div className="border border-brand-line rounded-xl p-3 text-sm space-y-1">
          <p><b>{info.producto}</b> × {info.cantidad}</p>
          {info.detalle && <p className="text-xs text-gray-500">{info.detalle}</p>}
          <p><span className="text-gray-500">Recibo de compra:</span> {info.recibo}</p>
          <p><span className="text-gray-500">Falla reportada:</span> {info.motivo}</p>
          {info.estado_equipo && <p><span className="text-gray-500">Se recibe:</span> {info.estado_equipo}</p>}
          {info.resolucion && <p><span className="text-gray-500">Resolución:</span> {info.resolucion}</p>}
          {info.monto_reembolso > 0 && <p><span className="text-gray-500">Reembolso:</span> {q(info.monto_reembolso)}</p>}
        </div>
      )}

      {info.condiciones && <details className="text-xs text-gray-600 bg-brand-soft rounded-lg p-3"><summary className="font-medium cursor-pointer">Ver condiciones</summary><p className="mt-2">{info.condiciones}</p></details>}

      <FirmaPad leyenda={cfg.leyenda} nombreInicial={info.cliente && info.cliente !== 'Consumidor Final' ? info.cliente : ''} enviando={enviando} onFirmar={firmar} />
    </Marco>
  );
}

function Marco({ children }) {
  return (
    <div className="min-h-screen bg-brand-soft py-6 px-4">
      <div className="max-w-lg mx-auto bg-white rounded-2xl shadow-sm p-5 space-y-4">
        <img src="/logo.png" alt={NEGOCIO.nombre} className="h-14 mx-auto object-contain" />
        {children}
        <p className="text-center text-xs text-gray-400 pt-2 border-t">{NEGOCIO.nombre} · {NEGOCIO.telefono} · {NEGOCIO.web}</p>
      </div>
    </div>
  );
}
