import { query } from './db';
import { toProduct, type Product } from './catalog';

const STOPWORDS = new Set(['de', 'la', 'el', 'los', 'las', 'un', 'una', 'para', 'con', 'en', 'y', 'o', 'por', 'del', 'al', 'a']);

/** Editable synonym groups (normalised, singular). */
export const SYNONYMS: string[][] = [
  ['cumple', 'cumpleanos', 'cumpleano'],
  ['novia', 'boda', 'nupcial'],
  ['amor', 'romantico', 'san valentin', 'enamorados'],
  ['orquidea', 'phalaenopsis'],
  ['girasol', 'sunflower'],
  ['lirio', 'lilium', 'azucena'],
  ['regalo', 'detalle', 'pack'],
  ['planta', 'verde', 'interior'],
];

export const normalize = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const stem = (w: string) => (w.length > 4 && w.endsWith('es') ? w.slice(0, -2) : w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w);

export function parseQuery(q: string): string[] {
  return normalize(q)
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2 && w.length <= 30 && !STOPWORDS.has(w))
    .slice(0, 6)
    .map(stem);
}

function alternatives(word: string): string[] {
  const alts = new Set([word]);
  for (const g of SYNONYMS) if (g.includes(word)) g.forEach((x) => alts.add(x));
  return [...alts];
}

const similarityThreshold = (w: string) => (w.length >= 6 ? 0.42 : w.length === 5 ? 0.5 : 0.6);

export interface SearchOptions { category?: string; limit?: number }

export async function searchProducts(q: string, opts: SearchOptions = {}): Promise<Product[]> {
  const words = parseQuery(q);
  if (!words.length) return [];
  const params: unknown[] = [];
  const p = (v: unknown) => (params.push(v), `$${params.length}`);

  const perWord: string[] = [];
  const scores: string[] = [];
  for (const w of words) {
    const alts = alternatives(w);
    const parts: string[] = [];
    for (const alt of alts) {
      const like = `${p(`%${alt.replace(/[%_\\]/g, '\\$&')}%`)}::text`;
      parts.push(
        `(CASE WHEN s.nm LIKE ${like} THEN 10 ELSE 0 END)`,
        `(CASE WHEN s.kw LIKE ${like} THEN 7 ELSE 0 END)`,
        `(CASE WHEN s.tg LIKE ${like} THEN 5 ELSE 0 END)`,
        `(CASE WHEN s.cp LIKE ${like} THEN 4 ELSE 0 END)`,
        `(CASE WHEN s.ds LIKE ${like} THEN 2 ELSE 0 END)`,
      );
    }
    // fuzzy only on what the user typed, not on synonyms
    const raw = `${p(w)}::text`;
    parts.push(`(CASE WHEN word_similarity(${raw}, s.nm) >= ${similarityThreshold(w)} THEN 6 ELSE 0 END)`);
    const expr = `GREATEST(${parts.join(', ')})`;
    perWord.push(`${expr} > 0`);
    scores.push(expr);
  }

  let where = `p.published AND ${perWord.join(' AND ')}`;
  if (opts.category) where += ` AND p.category_id = ${p(opts.category)}`;
  const limit = p(Math.min(Math.max(opts.limit ?? 6, 1), 100));

  const text = `
    SELECT p.*, c.path AS category_path, c.short AS category_short,
      COALESCE((SELECT json_agg(json_build_object('id', i.id, 'alt', i.alt) ORDER BY i.position, i.created_at)
                FROM product_images i WHERE i.product_id = p.id), '[]'::json) AS images,
      (${scores.join(' + ')}) AS score
    FROM products p
    JOIN categories c ON c.id = p.category_id
    CROSS JOIN LATERAL (SELECT
      f_unaccent(lower(p.name)) AS nm,
      f_unaccent(lower(array_to_string(p.keywords, ' '))) AS kw,
      f_unaccent(lower(concat_ws(' ', p.subcategory, c.short, array_to_string(p.occasions, ' ')))) AS tg,
      f_unaccent(lower(array_to_string(p.composition, ' '))) AS cp,
      f_unaccent(lower(p.description)) AS ds) s
    WHERE ${where}
    ORDER BY score DESC, c.sort_order, p.sort_order, p.name
    LIMIT ${limit}`;
  return (await query(text, params)).map(toProduct);
}
