// Proposes keywords from what each product already says. Preview by default; --apply fills only empty lists.
import { getSql } from './_db.mjs';

const apply = process.argv.includes('--apply');
const sql = getSql();
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const rows = await sql.query(
  `SELECT p.id, p.name, p.occasions, p.composition, p.keywords, c.short FROM products p JOIN categories c ON c.id=p.category_id`,
);
for (const r of rows) {
  if (r.keywords.length) continue;
  const set = new Map();
  for (const w of [r.short, ...r.occasions, ...r.composition, ...r.name.split(/\s+/)]) {
    const t = w.trim();
    if (t.length >= 4 && !set.has(norm(t))) set.set(norm(t), t.toLowerCase());
  }
  const kws = [...set.values()].slice(0, 30);
  console.log(r.name, '->', kws.join(', '));
  if (apply) await sql.query('UPDATE products SET keywords=$2 WHERE id=$1', [r.id, kws]);
}
console.log(apply ? 'Applied.' : 'Preview only. Re-run with -- --apply');
