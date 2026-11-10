'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const NAV = [
  ['/', 'Inicio'],
  ['/ventas', 'Ventas'],
  ['/cotizaciones', 'Cotizaciones'],
  ['/productos', 'Productos'],
  ['/inventario', 'Inventario'],
  ['/clientes', 'Clientes'],
  ['/garantias', 'Garantías'],
];

export default function Shell({ children }) {
  const path = usePathname();
  const router = useRouter();
  const [session, setSession] = useState(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const publica = path === '/login' || path.startsWith('/firmar/');

  useEffect(() => {
    if (session === null && !publica) router.replace('/login');
  }, [session, publica, router]);

  if (publica) return children;
  if (!session) return <div className="p-10 text-center text-gray-400">Cargando…</div>;

  const activo = (href) => (href === '/' ? path === '/' : path.startsWith(href));

  return (
    <>
      <header className="no-print bg-brand-dark text-white sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-4">
          <Link href="/" className="font-bold tracking-wide whitespace-nowrap">
            TECNO <span className="text-brand-accent">INFO</span>
          </Link>
          <nav className="flex gap-1 overflow-x-auto flex-1 scrollbar-none">
            {NAV.map(([href, label]) => (
              <Link key={href} href={href}
                className={`px-3 py-1.5 rounded-md text-sm whitespace-nowrap ${activo(href) ? 'bg-brand text-white' : 'text-white/70 hover:text-white'}`}>
                {label}
              </Link>
            ))}
          </nav>
          <button onClick={() => supabase.auth.signOut()} className="text-xs text-white/60 hover:text-white whitespace-nowrap">Salir</button>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6 print:p-0 print:max-w-none">{children}</main>
    </>
  );
}
