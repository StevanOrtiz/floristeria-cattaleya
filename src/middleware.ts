import { defineMiddleware } from 'astro:middleware';
import { SESSION_COOKIE, csrfToken, csrfValid, sameOrigin, validateSession } from './lib/auth';
import { withSecurityHeaders } from './lib/security-headers';
import { business } from './lib/site';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function unavailable(): Response {
  const wa = `https://wa.me/${business.whatsappNumber}`;
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>Volvemos enseguida | ${business.name}</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#fbf3f2;color:#4a1f33;font-family:Georgia,serif;text-align:center;padding:24px}
main{max-width:460px}h1{font-size:2rem;margin:0 0 12px}p{line-height:1.6}a{display:inline-block;margin:6px;padding:12px 22px;border-radius:999px;background:#b5487a;color:#fff;text-decoration:none;font-family:system-ui,sans-serif}
a.wa{background:#1f7a4a}</style></head><body><main><h1>Estamos haciendo un ajuste</h1>
<p>La web no está disponible un momento, pero seguimos atendiendo. Escríbenos o llámanos y te ayudamos con tu pedido.</p>
<a class="wa" href="${wa}">WhatsApp</a><a href="tel:${business.phoneHref}">Llamar ${business.phone}</a></main></body></html>`;
  return new Response(html, {
    status: 503,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Retry-After': '60', 'Cache-Control': 'no-store' },
  });
}

const json = (status: number, error: string) =>
  new Response(JSON.stringify({ error }), { status, headers: { 'Content-Type': 'application/json' } });

export const onRequest = defineMiddleware(async (ctx, next) => {
  const { pathname } = ctx.url;
  const isAdminPage = pathname === '/admin' || pathname.startsWith('/admin/');
  const isAdminApi = pathname.startsWith('/api/admin/');
  const isLogin = pathname === '/admin/login' || pathname === '/api/admin/login';
  const isAdminArea = isAdminPage || isAdminApi;

  try {
    if (isAdminArea) {
      const token = ctx.cookies.get(SESSION_COOKIE)?.value;
      const authed = await validateSession(token);

      if (!isLogin) {
        if (!authed || !token) {
          const res = isAdminApi ? json(401, 'No autorizado') : ctx.redirect('/admin/login');
          return withSecurityHeaders(res);
        }
        if (MUTATING.has(ctx.request.method)) {
          if (!sameOrigin(ctx.request) || !csrfValid(token, ctx.request.headers.get('x-csrf-token'))) {
            return withSecurityHeaders(json(403, 'Petición no válida'));
          }
        }
        ctx.locals.csrf = csrfToken(token);
      } else if (MUTATING.has(ctx.request.method) && !sameOrigin(ctx.request)) {
        return withSecurityHeaders(json(403, 'Petición no válida'));
      }
    } else if (pathname === '/api/contact' && MUTATING.has(ctx.request.method) && !sameOrigin(ctx.request)) {
      return withSecurityHeaders(json(403, 'Petición no válida'));
    }

    const res = await next();

    if (isAdminArea) {
      res.headers.set('Cache-Control', 'no-store');
      res.headers.set('X-Robots-Tag', 'noindex, nofollow');
      res.headers.set('X-Frame-Options', 'DENY');
    }
    // A failing DB on a public page becomes a friendly 503 instead of a raw 500.
    if (res.status === 500 && !isAdminArea && !pathname.startsWith('/api/') && !pathname.startsWith('/media/')) {
      return withSecurityHeaders(unavailable());
    }
    return withSecurityHeaders(res);
  } catch (err) {
    console.error('request failed', pathname, err);
    if (isAdminApi || pathname.startsWith('/api/')) return withSecurityHeaders(json(503, 'Servicio no disponible'));
    return withSecurityHeaders(unavailable());
  }
});
