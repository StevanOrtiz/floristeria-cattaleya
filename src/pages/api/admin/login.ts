import type { APIRoute } from 'astro';
import { query } from '../../../lib/db';
import {
  SESSION_COOKIE, clearLoginFailures, createSession, dummyVerify, globalBrake,
  loginLockedFor, recordLoginFailure, sessionCookieOptions, verifyPassword,
} from '../../../lib/auth';

const json = (status: number, body: object, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

export const POST: APIRoute = async ({ request, cookies, clientAddress }) => {
  const raw = await request.text();
  if (raw.length > 2048) return json(413, { error: 'Petición demasiado grande' });
  let body: any;
  try { body = JSON.parse(raw); } catch { return json(400, { error: 'Formato no válido' }); }

  const ip = (clientAddress || request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown').trim();
  const locked = await loginLockedFor(ip);
  if (locked > 0) return json(429, { error: 'Demasiados intentos. Espera un rato.' }, { 'Retry-After': String(locked) });

  await globalBrake();

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 160) : '';
  const password = typeof body.password === 'string' ? body.password.slice(0, 200) : '';
  const rows = await query<{ email: string; password_hash: string }>('SELECT email, password_hash FROM admin_users');
  const user = rows[0] && rows[0].email === email ? rows[0] : null;

  // always run one scrypt, real or dummy, so timing does not reveal whether the email exists
  let ok = false;
  if (user) ok = await verifyPassword(password, user.password_hash);
  else await dummyVerify(password);

  if (!ok) {
    await recordLoginFailure(ip);
    return json(401, { error: 'Correo o contraseña incorrectos.' });
  }
  await clearLoginFailures(ip);
  const token = await createSession(ip, request.headers.get('user-agent') ?? '');
  cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
  return json(200, { ok: true });
};
