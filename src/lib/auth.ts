import { createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { query } from './db';

export const SESSION_COOKIE = '__Host-cat_admin';
const SESSION_IDLE_HOURS = 8;
const SESSION_MAX_HOURS = 24;

// ---------- passwords (scrypt; params travel with the hash) ----------
function scryptAsync(pw: string, salt: Buffer, len: number, N: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(pw.normalize('NFKC'), salt, len, { N, r, p, maxmem: 128 * N * r * 2 }, (e, k) => (e ? reject(e) : resolve(k))),
  );
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [alg, N, r, p, salt, hash] = stored.split('$');
  if (alg !== 'scrypt' || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  const got = await scryptAsync(password, Buffer.from(salt, 'base64'), expected.length, +N, +r, +p);
  return got.length === expected.length && timingSafeEqual(got, expected);
}

/** Verified when the user does not exist, to keep response time equal. */
let dummy: string | undefined;
export async function dummyVerify(password: string) {
  dummy ??= `scrypt$32768$8$1$${randomBytes(16).toString('base64')}$${randomBytes(64).toString('base64')}`;
  await verifyPassword(password, dummy);
}

// ---------- sessions (only sha256(token) is stored) ----------
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

export async function createSession(ip: string, userAgent: string): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  await query(
    `INSERT INTO admin_sessions (token_hash, expires_at, ip, user_agent)
     VALUES ($1, now() + make_interval(hours => $2), $3, $4)`,
    [sha256(token), SESSION_IDLE_HOURS, ip.slice(0, 64), userAgent.slice(0, 200)],
  );
  query('DELETE FROM admin_sessions WHERE expires_at < now()').catch(() => {});
  return token;
}

/** Validates and renews (sliding 8h, max 24h from creation). */
export async function validateSession(token: string | undefined): Promise<boolean> {
  if (!token || token.length > 100) return false;
  const rows = await query(
    `UPDATE admin_sessions
       SET expires_at = least(created_at + make_interval(hours => $2), now() + make_interval(hours => $3))
     WHERE token_hash = $1 AND expires_at > now() AND created_at + make_interval(hours => $2) > now()
     RETURNING 1`,
    [sha256(token), SESSION_MAX_HOURS, SESSION_IDLE_HOURS],
  );
  return rows.length > 0;
}

export async function destroySession(token: string) {
  await query('DELETE FROM admin_sessions WHERE token_hash = $1', [sha256(token)]);
}

export const sessionCookieOptions = {
  httpOnly: true, secure: true, sameSite: 'strict' as const, path: '/', maxAge: SESSION_IDLE_HOURS * 3600,
};

// ---------- CSRF ----------
export const csrfToken = (session: string) => createHmac('sha256', session).update('cat-csrf').digest('hex');

export function csrfValid(session: string, header: string | null): boolean {
  if (!header) return false;
  const a = Buffer.from(csrfToken(session));
  const b = Buffer.from(header);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

// ---------- rate limiting ----------
export async function hit(key: string, max: number, windowSec: number): Promise<boolean> {
  const rows = await query<{ count: number }>(
    `INSERT INTO rate_limits (key, window_start, count) VALUES ($1, now(), 1)
     ON CONFLICT (key) DO UPDATE SET
       count = CASE WHEN rate_limits.window_start < now() - make_interval(secs => $2) THEN 1 ELSE rate_limits.count + 1 END,
       window_start = CASE WHEN rate_limits.window_start < now() - make_interval(secs => $2) THEN now() ELSE rate_limits.window_start END
     RETURNING count`,
    [key, windowSec],
  );
  return rows[0].count <= max;
}

/** Seconds left of an active login lock for this IP (0 if none). */
export async function loginLockedFor(ip: string): Promise<number> {
  const rows = await query<{ s: number }>(
    `SELECT ceil(extract(epoch FROM (locked_until - now())))::int AS s FROM rate_limits
     WHERE key = $1 AND locked_until > now()`,
    [`login:${ip}`],
  );
  return rows[0]?.s ?? 0;
}

const LOCK_MINUTES = [15, 30, 60];

export async function recordLoginFailure(ip: string): Promise<void> {
  const key = `login:${ip}`;
  const rows = await query<{ count: number }>(
    `INSERT INTO rate_limits (key, window_start, count) VALUES ($1, now(), 1)
     ON CONFLICT (key) DO UPDATE SET
       count = CASE WHEN rate_limits.window_start < now() - interval '15 minutes' THEN 1 ELSE rate_limits.count + 1 END,
       window_start = CASE WHEN rate_limits.window_start < now() - interval '15 minutes' THEN now() ELSE rate_limits.window_start END
     RETURNING count`,
    [key],
  );
  if (rows[0].count >= 5) {
    const lvlRows = await query<{ count: number }>(
      `INSERT INTO rate_limits (key, count) VALUES ($1, 1)
       ON CONFLICT (key) DO UPDATE SET count = rate_limits.count + 1 RETURNING count`,
      [`lvl:${ip}`],
    );
    const mins = LOCK_MINUTES[Math.min(lvlRows[0].count, LOCK_MINUTES.length) - 1];
    await query(
      `UPDATE rate_limits SET locked_until = now() + make_interval(mins => $2), count = 0 WHERE key = $1`,
      [key, mins],
    );
  }
}

export async function clearLoginFailures(ip: string) {
  await query('DELETE FROM rate_limits WHERE key = ANY($1)', [[`login:${ip}`, `lvl:${ip}`]]);
}

/** Global brake: >20 failures/hour adds a delay to every login attempt. */
export async function globalBrake(): Promise<void> {
  const ok = await hit('login:global', 20, 3600);
  if (!ok) await new Promise((r) => setTimeout(r, 2500));
}
