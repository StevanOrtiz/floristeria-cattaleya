export interface ProductInput {
  slug: string; categoryId: string; subcategory: string | null; name: string; description: string;
  composition: string[]; dimensions: string | null; care: string[]; watering: string | null;
  occasions: string[]; keywords: string[]; price: number | null; published: boolean; featured: boolean;
}

const stripControl = (s: string) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
const str = (v: unknown, max: number) => (typeof v === 'string' ? stripControl(v).trim().slice(0, max) : '');
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function list(v: unknown, maxItems: number, maxLen: number): string[] {
  const items = Array.isArray(v) ? v : typeof v === 'string' ? v.split(/\r?\n/) : [];
  return items.map((x) => str(x, maxLen)).filter(Boolean).slice(0, maxItems);
}
function csv(v: unknown, maxItems: number, maxLen: number): string[] {
  const items = Array.isArray(v) ? v : typeof v === 'string' ? v.split(',') : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of items) {
    const t = str(x, maxLen);
    const k = norm(t);
    if (t && !seen.has(k)) { seen.add(k); out.push(t); }
  }
  return out.slice(0, maxItems);
}

export function slugify(s: string): string {
  return norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80).replace(/-+$/g, '');
}

export function parseProduct(body: any, categoryIds: string[]): { ok: true; value: ProductInput } | { ok: false; error: string } {
  const name = str(body?.name, 120);
  if (name.length < 2) return { ok: false, error: 'El nombre debe tener al menos 2 caracteres.' };
  const slug = str(body?.slug, 80) || slugify(name);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return { ok: false, error: 'El slug solo admite minúsculas, números y guiones.' };
  const categoryId = str(body?.categoryId, 20);
  if (!categoryIds.includes(categoryId)) return { ok: false, error: 'Categoría no válida.' };

  let price: number | null = null;
  if (body?.price !== null && body?.price !== undefined && String(body.price).trim() !== '') {
    price = Number(String(body.price).replace(',', '.'));
    if (!Number.isFinite(price) || price < 0 || price > 99999.99) return { ok: false, error: 'Precio no válido (0 a 99999,99).' };
    price = Math.round(price * 100) / 100;
  }
  const description = typeof body?.description === 'string' ? stripControl(body.description).trim().slice(0, 2000) : '';

  return {
    ok: true,
    value: {
      slug, categoryId, name, description, price,
      subcategory: str(body?.subcategory, 40) || null,
      composition: list(body?.composition, 30, 120),
      dimensions: str(body?.dimensions, 120) || null,
      care: list(body?.care, 30, 200),
      watering: str(body?.watering, 120) || null,
      occasions: csv(body?.occasions, 20, 40),
      keywords: csv(body?.keywords, 30, 40),
      published: body?.published !== false,
      featured: body?.featured === true,
    },
  };
}
