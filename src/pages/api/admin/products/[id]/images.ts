import type { APIRoute } from 'astro';
import { query } from '../../../../../lib/db';
import { MAX_IMAGES_PER_PRODUCT, MAX_IMAGE_BYTES, processImage } from '../../../../../lib/images';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const json = (status: number, body: object) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export const POST: APIRoute = async ({ request, params }) => {
  const id = params.id ?? '';
  if (!UUID.test(id)) return json(404, { error: 'No encontrado' });

  const exists = await query('SELECT 1 FROM products WHERE id = $1', [id]);
  if (!exists.length) return json(404, { error: 'Producto no encontrado' });

  let form: FormData;
  try { form = await request.formData(); } catch { return json(400, { error: 'Formulario no válido' }); }
  const files = form.getAll('file').filter((f): f is File => f instanceof File);
  if (!files.length) return json(400, { error: 'No se recibió ninguna foto.' });

  const [{ n }] = await query<{ n: number }>('SELECT count(*)::int AS n FROM product_images WHERE product_id = $1', [id]);
  if (n + files.length > MAX_IMAGES_PER_PRODUCT) return json(400, { error: `Máximo ${MAX_IMAGES_PER_PRODUCT} fotos por producto.` });

  const created: string[] = [];
  let pos = n;
  for (const file of files) {
    if (file.size > MAX_IMAGE_BYTES) return json(413, { error: `${file.name}: supera 4 MB.` });
    try {
      const { full, thumb } = await processImage(Buffer.from(await file.arrayBuffer()));
      const alt = String(form.get('alt') ?? '').slice(0, 200);
      const rows = await query<{ id: string }>(
        `INSERT INTO product_images (product_id, position, alt, data_full, data_thumb) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [id, pos++, alt, full, thumb],
      );
      created.push(rows[0].id);
    } catch (e) {
      return json(400, { error: e instanceof Error ? e.message : 'Imagen no válida.' });
    }
  }
  return json(201, { ids: created });
};
