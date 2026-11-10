'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { NEGOCIO } from '@/lib/config';
import { q, fecha } from '@/lib/format';
import { Badge } from '@/components/ui';

export default function Dashboard() {
  const [r, setR] = useState(null);
  const [ultimas, setUltimas] = useState([]);

  useEffect(() => {
    supabase.rpc('resumen_dashboard').then(({ data }) => setR(data));
    supabase.from('documentos').select('id,tipo,numero,fecha,total,estado,clientes(nombre)')
      .order('fecha', { ascending: false }).limit(8).then(({ data }) => setUltimas(data || []));
  }, []);

  if (!r) return <p className="text-gray-400">Cargando…</p>;
  const pct = Math.min(100, (r.ventas_anio / NEGOCIO.limiteAnual) * 100);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Link href="/nuevo?tipo=VTA" className="btn-primary">+ Nueva venta</Link>
        <Link href="/nuevo?tipo=COT" className="btn-ghost">+ Nueva cotización</Link>
        <Link href="/garantias?nuevo=1" className="btn-ghost">+ Garantía / devolución</Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Vendido hoy" valor={q(r.ventas_hoy)} />
        <Kpi label={`Vendido este mes (${r.num_ventas_mes})`} valor={q(r.ventas_mes)} />
        <Kpi label="Ganancia estimada del mes" valor={q(r.ganancia_mes)} nota="precio sin IVA − costo" />
        <Kpi label="Pendientes" valor={`${r.cotizaciones_pendientes} cot · ${r.casos_abiertos} gar`} />
      </div>

      <div className="card">
        <div className="flex justify-between text-sm mb-2">
          <span className="font-medium">Facturado {new Date().getFullYear()} · límite {NEGOCIO.regimen}</span>
          <span>{q(r.ventas_anio)} / {q(NEGOCIO.limiteAnual)}</span>
        </div>
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-full ${pct > 85 ? 'bg-red-500' : pct > 65 ? 'bg-amber-500' : 'bg-brand'}`} style={{ width: `${pct}%` }} />
        </div>
        <p className="text-xs text-gray-500 mt-1">Te quedan {q(NEGOCIO.limiteAnual - r.ventas_anio)} disponibles este año ({pct.toFixed(1)}% usado).</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card">
          <h2 className="font-semibold mb-3">Últimos movimientos</h2>
          {ultimas.map((d) => (
            <Link key={d.id} href={`/documento/${d.id}`} className="flex justify-between items-center py-2 border-t first:border-0 text-sm hover:bg-brand-soft -mx-2 px-2 rounded">
              <div>
                <div className="font-medium">{d.numero} <Badge estado={d.estado} /></div>
                <div className="text-xs text-gray-500">{d.clientes?.nombre || '—'} · {fecha(d.fecha)}</div>
              </div>
              <span className="font-semibold">{q(d.total)}</span>
            </Link>
          ))}
          {!ultimas.length && <p className="text-sm text-gray-400">Aún no hay documentos.</p>}
        </div>
        <div className="card">
          <h2 className="font-semibold mb-3">Stock bajo</h2>
          {r.stock_bajo.map((p) => (
            <div key={p.id} className="flex justify-between py-2 border-t first:border-0 text-sm">
              <span>{p.nombre}</span>
              <span className={p.stock <= 0 ? 'text-red-600 font-semibold' : 'text-amber-600'}>{p.stock} (mín. {p.minimo})</span>
            </div>
          ))}
          {!r.stock_bajo.length && <p className="text-sm text-gray-400">Todo en orden.</p>}
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, valor, nota }) {
  return (
    <div className="card">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-lg font-semibold mt-1">{valor}</p>
      {nota && <p className="text-[10px] text-gray-400">{nota}</p>}
    </div>
  );
}
