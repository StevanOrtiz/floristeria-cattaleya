import type { APIRoute } from 'astro';
import { query } from '../../lib/db';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Driver may return a Buffer/Uint8Array or a hex string ("\x...").
function toBytes(v: unknown): Uint8Array {
  if (typeof v === 'string') return Buffer.from(v.startsWith('\\x') ? v.slice(2) : v, 'hex');
  return new Uint8Array(v as ArrayBufferLike);
}

export const GET: APIRoute = async ({ params, url, request }) => {
  const id = params.id ?? '';
  if (!UUID.test(id)) return new Response('Not found', { status: 404 });
  const thumb = url.searchParams.get('s') === 'thumb';
  const etag = `"${id}${thumb ? '-t' : ''}"`;
  const headers = {
    'Cache-Control': 'public, max-age=31536000, immutable',
    ETag: etag,
  };
  if (request.headers.get('if-none-match') === etag) return new Response(null, { status: 304, headers });

  const rows = await query(`SELECT ${thumb ? 'data_thumb' : 'data_full'} AS d, mime FROM product_images WHERE id = $1`, [id]);
  if (!rows[0]) return new Response('Not found', { status: 404 });
  return new Response(toBytes(rows[0].d) as unknown as BodyInit, { headers: { ...headers, 'Content-Type': rows[0].mime || 'image/webp' } });
};
