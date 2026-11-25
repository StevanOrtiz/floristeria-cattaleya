import type { APIRoute } from 'astro';
import { query } from '../../../../lib/db';
import { getCategories } from '../../../../lib/catalog';
import { parseProduct } from '../../../../lib/validate';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const json = (status: number, body: object) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export const PUT: APIRoute = async ({ request, params }) => {
  const id = params.id ?? '';
  if (!UUID.test(id)) return json(404, { error: 'No encontrado' });
  const raw = await request.text();
  if (raw.length > 50_000) return json(413, { error: 'Petición demasiado grande' });
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return json(400, { error: 'Formato no válido' }); }

  const cats = await getCategories();
  const parsed = parseProduct(body, cats.map((c) => c.id));
  if (!parsed.ok) return json(400, { error: parsed.error });
  const p = parsed.value;

  const dup = await query('SELECT 1 FROM products WHERE slug = $1 AND id <> $2', [p.slug, id]);
  if (dup.length) return json(409, { error: 'Ya existe un producto con ese slug.' });

  const rows = await query(
    `UPDATE products SET slug=$2, category_id=$3, subcategory=$4, name=$5, description=$6, composition=$7, dimensions=$8,
       care=$9, watering=$10, occasions=$11, keywords=$12, price=$13, published=$14, featured=$15, updated_at=now()
     WHERE id=$1 RETURNING id`,
    [id, p.slug, p.categoryId, p.subcategory, p.name, p.description, p.composition, p.dimensions, p.care, p.watering, p.occasions, p.keywords, p.price, p.published, p.featured],
  );
  return rows.length ? json(200, { ok: true }) : json(404, { error: 'No encontrado' });
};

export const DELETE: APIRoute = async ({ params }) => {
  const id = params.id ?? '';
  if (!UUID.test(id)) return json(404, { error: 'No encontrado' });
  await query('DELETE FROM products WHERE id = $1', [id]);   // images go with ON DELETE CASCADE
  return json(200, { ok: true });
};
