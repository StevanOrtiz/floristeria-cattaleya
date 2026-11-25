# Floristería Cattaleya

Astro 7 (server) + Neon Postgres + Netlify. Catálogo sin carrito: el cliente pide por WhatsApp.

## Puesta en marcha

1. Crea un proyecto en Neon (región UE) y copia la cadena de conexión.
2. `copy .env.example .env` y rellena `DATABASE_URL`.
3. `npm install`
4. `npm run db:seed` — crea tablas, categorías y 8 productos de ejemplo con fotos de relleno.
   Sobrescribe productos con el mismo slug: úsalo solo en una BD nueva.
5. Crear administrador (PowerShell):
   ```powershell
   $env:ADMIN_EMAIL="tu@correo.com"; $env:ADMIN_PASSWORD="minimo-12-caracteres"; npm run admin:create
   ```
   Cambiar contraseña: añade `-- --reset` (cierra todas las sesiones).
6. `npm run dev` → http://localhost:4321 y `/admin`.
7. `npm run db:keywords` (vista previa) → `npm run db:keywords -- --apply`.

## Qué personalizar

- `src/data/business.json`: teléfono, WhatsApp (sin +), dirección, horario, redes, datos legales.
- `src/data/reviews.ts`: solo reseñas reales con permiso.
- `src/lib/site.ts`: `SITE_URL` (+ `site` en `astro.config.mjs` y `public/robots.txt`), menú.
- `db/seed/catalog.json`: categorías (id solo letras minúsculas).
- Fotos reales: sube desde `/admin` y borra las de relleno.
- Mapa: `mapsEmbed` y `mapsLink` en `business.json`.
- Legal: sustituye los `[Pendiente: …]` y haz revisar los 3 textos.

## Despliegue (Netlify)

- Variables: `DATABASE_URL` (y opcionales `TURNSTILE_SECRET_KEY`, `PUBLIC_TURNSTILE_SITE_KEY`, `PUBLIC_GSC_VERIFICATION`). Redespliega tras cambiarlas.
- Verifica `/api/health`, `/sitemap.xml`, login y CRUD.
- Search Console: verifica dominio y envía `/sitemap.xml`.

## Notas

- Las cabeceras de seguridad se añaden en `src/middleware.ts` (las funciones no reciben las de `netlify.toml`). No hay scripts en línea, así que la CSP no necesita hash.
- Si la BD cae, las páginas públicas muestran un 503 con teléfono/WhatsApp.
- Los mensajes de contacto se leen en Neon (tabla `contact_messages`).
