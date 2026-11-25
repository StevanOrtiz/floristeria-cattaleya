// ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run admin:create [-- --reset]
import { getSql, applySchema, hashPassword } from './_db.mjs';

const email = (process.env.ADMIN_EMAIL ?? '').trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD ?? '';
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { console.error('Invalid ADMIN_EMAIL'); process.exit(1); }
if (password.length < 12) { console.error('ADMIN_PASSWORD must be at least 12 characters'); process.exit(1); }

const sql = getSql();
await applySchema(sql);
const hash = await hashPassword(password);
const existing = await sql.query('SELECT 1 FROM admin_users');
if (existing.length && !process.argv.includes('--reset')) {
  console.error('Admin already exists. Use -- --reset to replace it.');
  process.exit(1);
}
await sql.query(
  `INSERT INTO admin_users (id,email,password_hash) VALUES (true,$1,$2)
   ON CONFLICT (id) DO UPDATE SET email=$1, password_hash=$2`,
  [email, hash],
);
if (existing.length) await sql.query('DELETE FROM admin_sessions');
console.log('Admin saved:', email);
