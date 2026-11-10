'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { q, fecha } from '@/lib/format';
import { PageHeader, Table, Badge } from '@/components/ui';

const mesActual = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Guatemala' }).slice(0, 7);

export default function ListaDocumentos({ tipo }) {
  const router = useRouter();
  const esCot = tipo === 'COT';
  const [mes, setMes] = useState(mesActual());
  const [estado, setEstado] = useState('');
  const [buscar, setBuscar] = useState('');
  const [lista, setLista] = useState([]);

  useEffect(() => {
    let qy = supabase.from('documentos').select('id,numero,fecha,total,estado,metodo_pago,valida_hasta,clientes(nombre,nit)').eq('tipo', tipo).order('fecha', { ascending: false });
    if (mes) {
      const [y, m] = mes.split('-').map(Number);
      const fin = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
      qy = qy.gte('fecha', `${mes}-01T00:00:00-06:00`).lt('fecha', `${fin}-01T00:00:00-06:00`);
    }
    if (estado) qy = qy.eq('estado', estado);
    qy.then(({ data }) => setLista(data || []));
  }, [tipo, mes, estado]);

  const filtrados = lista.filter((d) => `${d.numero} ${d.clientes?.nombre || ''} ${d.clientes?.nit || ''}`.toLowerCase().includes(buscar.toLowerCase()));
  const totalValido = filtrados.filter((d) => d.estado !== 'anulada' && d.estado !== 'rechazada').reduce((s, d) => s + Number(d.total), 0);

  function exportar() {
    const filas = [['Numero', 'Fecha', 'Cliente', 'NIT', 'Estado', 'Pago', 'Total']]
      .concat(filtrados.map((d) => [d.numero, fecha(d.fecha), d.clientes?.nombre || 'Consumidor Final', d.clientes?.nit || 'CF', d.estado, d.metodo_pago || '', d.total]));
    const csv = '﻿' + filas.map((f) => f.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `${esCot ? 'cotizaciones' : 'ventas'}-${mes || 'todo'}.csv`;
    a.click();
  }

  const estados = esCot ? ['pendiente', 'aceptada', 'rechazada'] : ['pagada', 'anulada'];

  return (
    <>
      <PageHeader title={esCot ? 'Cotizaciones' : 'Ventas'}>
        <button className="btn-ghost" onClick={exportar}>Exportar Excel</button>
        <Link href={`/nuevo?tipo=${tipo}`} className="btn-primary">+ {esCot ? 'Nueva cotización' : 'Nueva venta'}</Link>
      </PageHeader>
      <div className="flex flex-wrap gap-2 mb-4">
        <input type="month" className="input w-auto" value={mes} onChange={(e) => setMes(e.target.value)} />
        <button className="btn-ghost" onClick={() => setMes('')}>Todo</button>
        <select className="input w-auto" value={estado} onChange={(e) => setEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          {estados.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
        <input className="input flex-1 min-w-[180px]" placeholder="Buscar número, cliente o NIT…" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
      </div>
      <p className="text-sm text-gray-600 mb-2">{filtrados.length} documentos · {esCot ? 'Monto cotizado' : 'Total vendido'}: <b>{q(totalValido)}</b></p>
      <Table head={['Número', 'Fecha', 'Cliente', 'Estado', 'Total']} empty={!filtrados.length && 'Sin documentos en este período'}>
        {filtrados.map((d) => (
          <tr key={d.id} className="cursor-pointer hover:bg-brand-soft" onClick={() => router.push(`/documento/${d.id}`)}>
            <td className="td font-medium whitespace-nowrap">{d.numero}</td>
            <td className="td whitespace-nowrap">{fecha(d.fecha)}</td>
            <td className="td">{d.clientes?.nombre || 'Consumidor Final'}</td>
            <td className="td">
              <Badge estado={d.estado} />
              {esCot && d.estado === 'pendiente' && d.valida_hasta < new Date().toISOString().slice(0, 10) && <span className="badge bg-gray-100 text-gray-500 ml-1">vencida</span>}
            </td>
            <td className="td text-right font-semibold whitespace-nowrap">{q(d.total)}</td>
          </tr>
        ))}
      </Table>
    </>
  );
}
