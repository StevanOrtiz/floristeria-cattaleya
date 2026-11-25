import type { APIRoute } from 'astro';
import { dbHealthy } from '../../lib/db';

export const GET: APIRoute = async () => {
  const ok = await dbHealthy();
  return new Response(JSON.stringify({ ok }), {
    status: ok ? 200 : 503,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
};
