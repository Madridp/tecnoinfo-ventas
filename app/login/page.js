'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  async function entrar(e) {
    e.preventDefault();
    setCargando(true); setError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setCargando(false);
    if (error) return setError('Correo o contraseña incorrectos');
    router.replace('/');
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-brand-dark to-brand">
      <form onSubmit={entrar} className="bg-white rounded-2xl p-8 w-full max-w-sm shadow-xl space-y-4">
        <img src="/logo.png" alt="TECNO INFO" className="h-20 mx-auto object-contain" />
        <p className="text-center text-sm text-gray-500">Sistema de ventas</p>
        <input className="input" type="email" placeholder="Correo" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input className="input" type="password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="btn-primary w-full" disabled={cargando}>{cargando ? 'Entrando…' : 'Entrar'}</button>
      </form>
    </div>
  );
}
