'use client';
import { useEffect, useRef, useState } from 'react';

// Lienzo para firmar con el dedo, mouse o lápiz. Llama onFirmar({ nombre, dpi, firma })
export default function FirmaPad({ leyenda, nombreInicial = '', onFirmar, onCancelar, enviando }) {
  const canvas = useRef(null);
  const dibujando = useRef(false);
  const [vacio, setVacio] = useState(true);
  const [nombre, setNombre] = useState(nombreInicial);
  const [dpi, setDpi] = useState('');
  const [acepto, setAcepto] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    const c = canvas.current;
    const ratio = window.devicePixelRatio || 1;
    c.width = c.offsetWidth * ratio;
    c.height = c.offsetHeight * ratio;
    const ctx = c.getContext('2d');
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1a1a40';
  }, []);

  const punto = (e) => {
    const r = canvas.current.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  const inicio = (e) => {
    e.preventDefault();
    canvas.current.setPointerCapture(e.pointerId);
    dibujando.current = true;
    const ctx = canvas.current.getContext('2d');
    const [x, y] = punto(e);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 0.1, y + 0.1); ctx.stroke();
    setVacio(false);
  };
  const mover = (e) => {
    if (!dibujando.current) return;
    const ctx = canvas.current.getContext('2d');
    const [x, y] = punto(e);
    ctx.lineTo(x, y); ctx.stroke();
  };
  const fin = () => { dibujando.current = false; };
  const limpiar = () => {
    const c = canvas.current;
    c.getContext('2d').clearRect(0, 0, c.width, c.height);
    setVacio(true);
  };

  // Recorta a la zona firmada y reduce tamaño para guardar liviano
  function exportar() {
    const c = canvas.current;
    const { width: w, height: h } = c;
    const data = c.getContext('2d').getImageData(0, 0, w, h).data;
    let x0 = w, y0 = h, x1 = 0, y1 = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 0) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    const pad = 10;
    x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(w, x1 + pad); y1 = Math.min(h, y1 + pad);
    const escala = Math.min(1, 500 / (x1 - x0));
    const out = document.createElement('canvas');
    out.width = Math.round((x1 - x0) * escala); out.height = Math.round((y1 - y0) * escala);
    out.getContext('2d').drawImage(c, x0, y0, x1 - x0, y1 - y0, 0, 0, out.width, out.height);
    return out.toDataURL('image/png');
  }

  function confirmar() {
    if (vacio) return setErr('Falta la firma');
    if (!nombre.trim()) return setErr('Escribe el nombre de quien firma');
    if (!acepto) return setErr('Marca la casilla de conformidad');
    setErr('');
    onFirmar({ nombre: nombre.trim(), dpi: dpi.trim(), firma: exportar() });
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <canvas ref={canvas} className="w-full h-48 sm:h-56 rounded-xl border-2 border-dashed border-brand-line bg-white touch-none"
          onPointerDown={inicio} onPointerMove={mover} onPointerUp={fin} onPointerCancel={fin} onPointerLeave={fin} />
        {vacio && <span className="absolute inset-0 flex items-center justify-center text-gray-300 pointer-events-none">Firme aquí</span>}
        <div className="absolute left-6 right-6 bottom-10 border-b border-gray-300 pointer-events-none" />
        <button type="button" onClick={limpiar} className="absolute top-2 right-2 text-xs text-brand bg-white/90 px-2 py-1 rounded">Borrar</button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <input className="input col-span-2" placeholder="Nombre completo" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <input className="input" placeholder="DPI (opcional)" inputMode="numeric" value={dpi} onChange={(e) => setDpi(e.target.value)} />
      </div>
      <label className="flex gap-2 text-sm items-start">
        <input type="checkbox" className="mt-1" checked={acepto} onChange={(e) => setAcepto(e.target.checked)} />
        <span>{leyenda}</span>
      </label>
      {err && <p className="text-sm text-red-600">{err}</p>}
      <div className="flex gap-2">
        {onCancelar && <button type="button" className="btn-ghost flex-1" onClick={onCancelar}>Cancelar</button>}
        <button type="button" className="btn-primary flex-1 py-3" disabled={enviando} onClick={confirmar}>{enviando ? 'Guardando…' : 'Firmar'}</button>
      </div>
    </div>
  );
}
