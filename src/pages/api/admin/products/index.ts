import type { APIRoute } from 'astro';
import { query } from '../../../../lib/db';
import { getCategories } from '../../../../lib/catalog';
import { parseProduct } from '../../../../lib/validate';

const json = (status: number, body: object) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export const POST: APIRoute = async ({ request }) => {
  const raw = await request.text();
  if (raw.length > 50_000) return json(413, { error: 'Petición demasiado grande' });
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return json(400, { error: 'Formato no válido' }); }

  const cats = await getCategories();
  const parsed = parseProduct(body, cats.map((c) => c.id));
  if (!parsed.ok) return json(400, { error: parsed.error });
  const p = parsed.value;

  const dup = await query('SELECT 1 FROM products WHERE slug = $1', [p.slug]);
  if (dup.length) return json(409, { error: 'Ya existe un producto con ese slug.' });

  const rows = await query<{ id: string }>(
    `INSERT INTO products (slug,category_id,subcategory,name,description,composition,dimensions,care,watering,occasions,keywords,price,published,featured,sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,
       COALESCE((SELECT max(sort_order) FROM products WHERE category_id = $2), 0) + 1)
     RETURNING id`,
    [p.slug, p.categoryId, p.subcategory, p.name, p.description, p.composition, p.dimensions, p.care, p.watering, p.occasions, p.keywords, p.price, p.published, p.featured],
  );
  return json(201, { id: rows[0].id });
};
