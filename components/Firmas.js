'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { FIRMA, FIRMA_EMISOR, NEGOCIO } from '@/lib/config';
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

// Firma de TECNO INFO (Pedro). La primera vez se dibuja y queda guardada en "ajustes";
// después se estampa en cada documento con un solo clic.
export function BloqueFirmaEmisor({ documentoId, casoId, tipo, numero }) {
  const [firma, setFirma] = useState(undefined);
  const [guardada, setGuardada] = useState(null);
  const [abrir, setAbrir] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const rol = FIRMA_EMISOR[tipo] || 'Emite';

  const cargar = () => {
    let qy = supabase.from('firmas').select('*').eq('momento', 'emisor');
    qy = documentoId ? qy.eq('documento_id', documentoId) : qy.eq('caso_id', casoId);
    qy.maybeSingle().then(({ data }) => setFirma(data || null));
    supabase.from('ajustes').select('valor').eq('clave', 'firma_emisor').maybeSingle()
      .then(({ data }) => setGuardada(data?.valor || null));
  };
  useEffect(() => { cargar(); }, [documentoId, casoId]);

  async function estampar(f) {
    setEnviando(true);
    const { error } = await supabase.from('firmas').insert({
      documento_id: documentoId || null, caso_id: casoId || null, momento: 'emisor', nombre: f.nombre,
      firma: f.firma, via: 'presencial', user_agent: navigator.userAgent.slice(0, 300),
    });
    setEnviando(false);
    if (error) return alert(errMsg(error));
    setAbrir(false); cargar();
  }
  async function nuevaFirma({ nombre, firma: img }) {
    const valor = { nombre, firma: img };
    const { error } = await supabase.from('ajustes').upsert({ clave: 'firma_emisor', valor, actualizado: new Date().toISOString() });
    if (error) return alert(errMsg(error));
    estampar(valor);
  }
  async function quitar() {
    if (!confirm('¿Quitar tu firma de este documento?')) return;
    const { error } = await supabase.from('firmas').delete().eq('id', firma.id);
    if (error) return alert(errMsg(error));
    cargar();
  }

  if (firma === undefined) return <div className="h-24" />;

  return (
    <div className="text-center text-xs">
      {firma ? (
        <>
          <img src={firma.firma} alt="Firma" className="h-16 mx-auto object-contain" />
          <div className="border-t border-gray-400 pt-1 text-gray-700"><b>{firma.nombre}</b> · {NEGOCIO.nombre}</div>
          <p className="text-[10px] text-gray-400">
            {rol} · firmado {fechaHora(firma.firmado_en)}
            <button className="no-print ml-2 text-red-500 underline" onClick={quitar}>quitar</button>
          </p>
        </>
      ) : (
        <>
          <div className="h-16 flex items-center justify-center gap-2 no-print">
            {guardada ? (
              <>
                <button className="btn-primary text-xs" disabled={enviando} onClick={() => estampar(guardada)}>
                  {enviando ? 'Firmando…' : 'Firmar (TECNO INFO)'}
                </button>
                <button className="btn-ghost text-xs" onClick={() => setAbrir(true)}>Otra firma</button>
              </>
            ) : (
              <button className="btn-primary text-xs" onClick={() => setAbrir(true)}>Crear mi firma</button>
            )}
          </div>
          <div className="h-16 hidden print:block" />
          <div className="border-t border-gray-400 pt-1 text-gray-500">{rol} · {NEGOCIO.responsable} · {NEGOCIO.nombre}</div>
        </>
      )}
      {abrir && (
        <Modal title={`Mi firma · ${numero}`} onClose={() => setAbrir(false)}>
          <p className="text-xs text-gray-500 mb-2">Queda guardada para firmar los próximos documentos con un clic.</p>
          <FirmaPad leyenda={FIRMA_EMISOR.leyenda} nombreInicial={guardada?.nombre || NEGOCIO.responsable}
            enviando={enviando} onFirmar={nuevaFirma} onCancelar={() => setAbrir(false)} />
        </Modal>
      )}
    </div>
  );
}
