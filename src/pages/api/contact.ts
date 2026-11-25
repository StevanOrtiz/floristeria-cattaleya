import type { APIRoute } from 'astro';
import { TURNSTILE_SECRET_KEY } from 'astro:env/server';
import { query } from '../../lib/db';
import { hit, sameOrigin } from '../../lib/auth';

const json = (status: number, body: object) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

// strip tags + control chars
const clean = (v: unknown, max: number) =>
  typeof v === 'string' ? v.replace(/<[^>]*>/g, '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max) : '';

export const POST: APIRoute = async ({ request, clientAddress }) => {
  if (!sameOrigin(request)) return json(403, { error: 'Petición no válida' });
  if (!(request.headers.get('content-type') ?? '').includes('application/json')) return json(415, { error: 'Formato no válido' });
  const raw = await request.text();
  if (raw.length > 20_000) return json(413, { error: 'Mensaje demasiado grande' });

  let b: Record<string, unknown>;
  try { b = JSON.parse(raw); } catch { return json(400, { error: 'Formato no válido' }); }

  // honeypot + minimum fill time: pretend success so bots learn nothing
  const filledMs = Date.now() - Number(b.ts);
  if (clean(b.website, 50) || !Number.isFinite(filledMs) || filledMs < 3000) return json(200, { ok: true });

  const ip = (clientAddress || request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown').trim();
  if (!(await hit(`contact:${ip}`, 5, 600))) return json(429, { error: 'Demasiados envíos. Inténtalo más tarde.' });

  if (TURNSTILE_SECRET_KEY) {
    const token = clean(b['cf-turnstile-response'], 2048);
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: new URLSearchParams({ secret: TURNSTILE_SECRET_KEY, response: token, remoteip: ip }),
    }).then((r) => r.json()).catch(() => ({ success: false }));
    if (!res.success) return json(400, { error: 'No hemos podido verificar que eres una persona.' });
  }

  const kind = b.kind === 'evento' ? 'evento' : 'contacto';
  const d = {
    nombre: clean(b.nombre, 100),
    email: clean(b.email, 160),
    telefono: clean(b.telefono, 30),
    asunto: clean(b.asunto, 120),
    tipo_evento: clean(b.tipo_evento, 80),
    fecha_evento: clean(b.fecha_evento, 40),
    lugar: clean(b.lugar, 120),
    mensaje: clean(b.mensaje, 3000),
  };
  if (d.nombre.length < 2) return json(400, { error: 'Indica tu nombre.' });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email)) return json(400, { error: 'Email no válido.' });
  if (d.telefono && !/^[+\d\s().-]{6,30}$/.test(d.telefono)) return json(400, { error: 'Teléfono no válido.' });
  if (kind === 'contacto' && !d.asunto) return json(400, { error: 'Indica el asunto.' });
  if (kind === 'evento' && !d.tipo_evento) return json(400, { error: 'Indica el tipo de evento.' });
  if (d.mensaje.length < 10) return json(400, { error: 'El mensaje es demasiado corto.' });
  if (b.consentimiento !== true) return json(400, { error: 'Debes aceptar la política de privacidad.' });

  await query(
    `INSERT INTO contact_messages (kind,nombre,email,telefono,asunto,tipo_evento,fecha_evento,lugar,mensaje,consentimiento)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true)`,
    [kind, d.nombre, d.email, d.telefono || null, d.asunto || null, d.tipo_evento || null, d.fecha_evento || null, d.lugar || null, d.mensaje],
  );
  return json(200, { ok: true });
};
