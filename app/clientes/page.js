'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { PageHeader, Table } from '@/components/ui';
import { FormCliente, VACIO_CLIENTE } from '@/components/FormCliente';

export default function Clientes() {
  const [lista, setLista] = useState([]);
  const [buscar, setBuscar] = useState('');
  const [edit, setEdit] = useState(null);

  const cargar = () => supabase.from('clientes').select('*').order('nombre').then(({ data }) => setLista(data || []));
  useEffect(() => { cargar(); }, []);

  const filtrados = lista.filter((c) => `${c.nombre} ${c.nit} ${c.telefono || ''}`.toLowerCase().includes(buscar.toLowerCase()));

  return (
    <>
      <PageHeader title="Clientes">
        <button className="btn-primary" onClick={() => setEdit(VACIO_CLIENTE)}>+ Nuevo</button>
      </PageHeader>
      <input className="input mb-4" placeholder="Buscar por nombre, NIT o teléfono…" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
      <Table head={['Cliente', 'NIT', 'Teléfono', '']} empty={!filtrados.length && 'Sin clientes'}>
        {filtrados.map((c) => (
          <tr key={c.id}>
            <td className="td"><div className="font-medium">{c.nombre}</div><div className="text-xs text-gray-500">{c.direccion}</div></td>
            <td className="td">{c.nit}</td>
            <td className="td">
              {c.telefono && <a className="text-brand" href={`https://wa.me/502${c.telefono.replace(/\D/g, '').slice(-8)}`} target="_blank">{c.telefono}</a>}
            </td>
            <td className="td text-right"><button className="text-brand text-xs" onClick={() => setEdit(c)}>Editar</button></td>
          </tr>
        ))}
      </Table>
      {edit && <FormCliente inicial={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); cargar(); }} />}
    </>
  );
}

