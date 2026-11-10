'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { errMsg } from '@/lib/format';
import { Modal, Field } from '@/components/ui';

export const VACIO_CLIENTE = { nombre: '', nit: 'CF', telefono: '', email: '', direccion: '', notas: '' };

export function FormCliente({ inicial, onClose, onSaved }) {
  const [f, setF] = useState(inicial);
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function guardar(e) {
    e.preventDefault();
    const { id, created_at, ...datos } = f;
    const res = id ? await supabase.from('clientes').update(datos).eq('id', id).select().single()
      : await supabase.from('clientes').insert(datos).select().single();
    if (res.error) return setErr(errMsg(res.error));
    onSaved(res.data);
  }

  return (
    <Modal title={f.id ? 'Editar cliente' : 'Nuevo cliente'} onClose={onClose}>
      <form onSubmit={guardar} className="grid grid-cols-2 gap-3">
        <Field label="Nombre o empresa" className="col-span-2"><input className="input" value={f.nombre} onChange={set('nombre')} required autoFocus /></Field>
        <Field label="NIT"><input className="input" value={f.nit} onChange={set('nit')} required /></Field>
        <Field label="Teléfono / WhatsApp"><input className="input" value={f.telefono || ''} onChange={set('telefono')} /></Field>
        <Field label="Correo" className="col-span-2"><input className="input" type="email" value={f.email || ''} onChange={set('email')} /></Field>
        <Field label="Dirección" className="col-span-2"><input className="input" value={f.direccion || ''} onChange={set('direccion')} /></Field>
        <Field label="Notas" className="col-span-2"><input className="input" value={f.notas || ''} onChange={set('notas')} /></Field>
        {err && <p className="col-span-2 text-sm text-red-600">{err}</p>}
        <button className="btn-primary col-span-2">Guardar</button>
      </form>
    </Modal>
  );
}
