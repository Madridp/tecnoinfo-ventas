# TECNO INFO · Sistema de Ventas

Cotizaciones, ventas con recibo, inventario con kardex, clientes, y garantías/devoluciones.
Next.js 14 + Supabase (Auth + RLS) · listo para Vercel.

## Instalación (≈15 min)

### 1. Supabase
1. Crea un proyecto nuevo en supabase.com.
2. **SQL Editor → New query** → pega todo `supabase/schema.sql` → **Run**. Luego, en otra query, pega `supabase/02_firmas.sql` → **Run**.
   (Si ya habías corrido `schema.sql`, solo corre `02_firmas.sql`. Si alguna vez vuelves a correr `schema.sql`, corre `02_firmas.sql` después.)
3. **Authentication → Users → Add user** → crea tu usuario (correo + contraseña, marca *Auto confirm*).
4. **Authentication → Sign In / Providers** → desactiva *Allow new users to sign up* (así nadie más puede crear cuenta).
5. **Project Settings → API** → copia `Project URL` y la `anon public key`.

### 2. GitHub + Vercel
1. Sube esta carpeta a un repo nuevo en GitHub.
2. En Vercel: **Add New → Project** → importa el repo.
3. En *Environment Variables* agrega:
   - `NEXT_PUBLIC_SUPABASE_URL` = tu Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = tu anon key
4. **Deploy**. Opcional: conecta un subdominio (ej. `ventas.tecnoinfo.info`).

Para probar en tu compu: copia `.env.example` a `.env.local`, pon tus llaves, `npm install` y `npm run dev`.

## Personalizar
- **Logo:** reemplaza `public/logo.png` con tu logo oficial.
- **Datos del negocio, condiciones impresas, límite anual:** `lib/config.js`.
- **Correlativos:** formato `COT-AAAA-MM-NNN`, `REC-…` (ventas), `GAR-…` y `DEV-…`. Se reinician cada mes. El script deja las cotizaciones de nov-2026 continuando después de la 004.

## Cómo funciona
| Acción | Qué pasa |
|---|---|
| Producto con *Controlar existencias* | La venta descuenta stock; si no hay, no deja vender. |
| Producto sin control (servicios, licencias, bajo pedido) | Se vende sin tocar inventario. |
| Línea libre | Para cosas puntuales; no mueve inventario. |
| Precios | Se ingresan **sin IVA**; total = subtotal ÷ 0.95 (5 % Pequeño Contribuyente). Se puede apagar por documento. |
| Cotización → *Convertir en venta* | Crea el recibo con las mismas líneas y marca la cotización como aceptada. |
| Anular venta | Regresa el stock y deja la venta marcada (no se borra). |
| Garantía / devolución | Se busca por No. de recibo; el sistema indica si está dentro del plazo, genera comprobante de recepción y lleva el seguimiento. Puedes reintegrar el producto al stock o descontar la unidad de reemplazo. |
| Inicio | Ventas del día/mes, ganancia estimada, stock bajo y barra del límite anual del régimen. |

## Firmas sin papel
Recibos (entrega), cotizaciones (aceptación) y garantías (recepción y retiro) traen un espacio para la firma del cliente:
- **Firmar aquí:** el cliente firma con el dedo en tu celular o tablet.
- **Pedir por WhatsApp:** genera un enlace de un solo uso que vence en 7 días. El cliente lo abre sin cuenta, revisa el detalle y firma. Cuando regresas a la pestaña, la firma ya aparece.
- Se guarda la imagen de la firma, el nombre, el DPI (opcional), la fecha y hora, si fue en persona o por enlace, y el dispositivo usado. Al imprimir o guardar en PDF, la firma sale en el documento.

El recibo es un comprobante interno; la factura FEL se sigue emitiendo en la SAT.
