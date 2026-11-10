import './globals.css';
import Shell from '@/components/Shell';

export const metadata = { title: 'TECNO INFO · Ventas', description: 'Sistema de ventas TECNO INFO GT' };
export const viewport = { width: 'device-width', initialScale: 1, themeColor: '#862CA8' };

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className="font-sans antialiased">
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
