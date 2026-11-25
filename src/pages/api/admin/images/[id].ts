import type { APIRoute } from 'astro';
import { query } from '../../../../lib/db';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const json = (status: number, body: object) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export const PATCH: APIRoute = async ({ request, params }) => {
  const id = params.id ?? '';
  if (!UUID.test(id)) return json(404, { error: 'No encontrado' });
  let body: any;
  try { body = JSON.parse(await request.text()); } catch { return json(400, { error: 'Formato no válido' }); }

  if (typeof body.alt === 'string') {
    await query('UPDATE product_images SET alt = $2 WHERE id = $1', [id, body.alt.replace(/[\u0000-\u001F]/g, '').trim().slice(0, 200)]);
  }
  if (body.move === 'up' || body.move === 'down') {
    const [img] = await query<{ product_id: string }>('SELECT product_id FROM product_images WHERE id = $1', [id]);
    if (!img) return json(404, { error: 'No encontrado' });
    const all = await query<{ id: string }>('SELECT id FROM product_images WHERE product_id = $1 ORDER BY position, created_at', [img.product_id]);
    const ids = all.map((r) => r.id);
    const i = ids.indexOf(id);
    const j = body.move === 'up' ? i - 1 : i + 1;
    if (j >= 0 && j < ids.length) {
      [ids[i], ids[j]] = [ids[j], ids[i]];
      await query(
        `UPDATE product_images AS pi SET position = v.pos FROM (SELECT unnest($1::uuid[]) AS id, generate_series(0, $2) AS pos) v WHERE pi.id = v.id`,
        [ids, ids.length - 1],
      );
    }
  }
  return json(200, { ok: true });
};

export const DELETE: APIRoute = async ({ params }) => {
  const id = params.id ?? '';
  if (!UUID.test(id)) return json(404, { error: 'No encontrado' });
  await query('DELETE FROM product_images WHERE id = $1', [id]);
  return json(200, { ok: true });
};
