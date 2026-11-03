// Usage: npm run admin:create -- "Full Name" admin@example.com "StrongPassword123" [admin|viewer]
// role "viewer" = client account (read-only + downloads). Default: admin.
// Creates an admin, or resets the password if the email already exists.
import bcrypt from "bcryptjs";
import pg from "pg";
import { loadEnv } from "./env.mjs";

loadEnv();
const [name, email, password, role = "admin"] = process.argv.slice(2);
if (!["admin", "viewer"].includes(role)) { console.error('Role must be "admin" or "viewer"'); process.exit(1); }
if (!name || !email || !password) {
  console.error('Usage: npm run admin:create -- "Full Name" email@example.com "password"');
  process.exit(1);
}
if (password.length < 10) { console.error("Password must be at least 10 characters"); process.exit(1); }
const url = process.env.DATABASE_URL;
const ssl = /localhost|127\.0\.0\.1/.test(url) || process.env.DATABASE_SSL === "false" ? undefined : { rejectUnauthorized: false };
const client = new pg.Client({ connectionString: url, ssl });
await client.connect();
const hash = await bcrypt.hash(password, 12);
const { rows } = await client.query(
  `INSERT INTO admins (name, email, password_hash, role) VALUES ($1, lower($2), $3, $4)
   ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, password_hash = EXCLUDED.password_hash, role = EXCLUDED.role
   RETURNING id, email, role`,
  [name, email, hash, role],
);
await client.end();
console.log(`✓ ${rows[0].role} ready: ${rows[0].email}`);
