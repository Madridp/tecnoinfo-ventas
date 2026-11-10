'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { FIRMA, NEGOCIO } from '@/lib/config';
import { fechaHora, errMsg } from '@/lib/format';
import { Modal } from '@/components/ui';
import FirmaPad from '@/components/FirmaPad';

// Bloque de firma del cliente: muestra la firma guardada o permite firmar aquí / pedirla por WhatsApp
export function BloqueFirma({ documentoId, casoId, momento, cliente, numero }) {
  const [firma, setFirma] = useState(undefined);
  const [abrir, setAbrir] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const cfg = FIRMA[momento];

  const cargar = () => {
    let qy = supabase.from('firmas').select('*').eq('momento', momento);
    qy = documentoId ? qy.eq('documento_id', documentoId) : qy.eq('caso_id', casoId);
    qy.maybeSingle().then(({ data }) => setFirma(data || null));
  };
  useEffect(() => {
    cargar();
    window.addEventListener('focus', cargar);   // al volver de WhatsApp se actualiza solo
    return () => window.removeEventListener('focus', cargar);
  }, [documentoId, casoId, momento]);

  async function guardar({ nombre, dpi, firma: img }) {
    setEnviando(true);
    const { error } = await supabase.from('firmas').insert({
      documento_id: documentoId || null, caso_id: casoId || null, momento, nombre, dpi: dpi || null,
      firma: img, via: 'presencial', user_agent: navigator.userAgent.slice(0, 300),
    });
    setEnviando(false);
    if (error) return alert(errMsg(error));
    setAbrir(false); cargar();
  }

  async function pedirPorWhatsapp() {
    const { data: token, error } = await supabase.rpc('solicitar_firma', { p_documento: documentoId || null, p_caso: casoId || null, p_momento: momento });
    if (error) return alert(errMsg(error));
    const url = `${window.location.origin}/firmar/${token}`;
    const tel = (cliente?.telefono || '').replace(/\D/g, '').slice(-8);
    const txt = `Hola ${cliente?.nombre || ''}, le saluda ${NEGOCIO.nombre}. Por favor revise y firme el documento ${numero} en este enlace (vence en 7 días): ${url}`;
    window.open(`https://wa.me/${tel ? '502' + tel : ''}?text=${encodeURIComponent(txt)}`, '_blank');
  }

  if (firma === undefined) return <div className="h-24" />;

  return (
    <div className="text-center text-xs">
      {firma ? (
        <>
          <img src={firma.firma} alt="Firma" className="h-16 mx-auto object-contain" />
          <div className="border-t border-gray-400 pt-1 text-gray-700">
            <b>{firma.nombre}</b>{firma.dpi && ` · DPI ${firma.dpi}`}
          </div>
          <p className="text-[10px] text-gray-400">{cfg.titulo} · firmado {fechaHora(firma.firmado_en)} · {firma.via === 'enlace' ? 'por enlace' : 'en persona'}</p>
        </>
      ) : (
        <>
          <div className="h-16 flex items-center justify-center gap-2 no-print">
            <button className="btn-primary text-xs" onClick={() => setAbrir(true)}>Firmar aquí</button>
            <button className="btn-ghost text-xs" onClick={pedirPorWhatsapp}>Pedir por WhatsApp</button>
          </div>
          <div className="h-16 hidden print:block" />
          <div className="border-t border-gray-400 pt-1 text-gray-500">{cfg.titulo}</div>
        </>
      )}
      {abrir && (
        <Modal title={`Firma · ${numero}`} onClose={() => setAbrir(false)}>
          <FirmaPad leyenda={cfg.leyenda} nombreInicial={cliente?.nombre && cliente.nombre !== 'Consumidor Final' ? cliente.nombre : ''}
            enviando={enviando} onFirmar={guardar} onCancelar={() => setAbrir(false)} />
        </Modal>
      )}
    </div>
  );
}
