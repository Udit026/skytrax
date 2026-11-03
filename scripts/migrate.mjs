// Usage: npm run db:migrate   (reads DATABASE_URL from .env.local / env)
import fs from "fs";
import path from "path";
import pg from "pg";
import { loadEnv } from "./env.mjs";

loadEnv();
const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL not set"); process.exit(1); }
const ssl = /localhost|127\.0\.0\.1/.test(url) || process.env.DATABASE_SSL === "false" ? undefined : { rejectUnauthorized: false };
const client = new pg.Client({ connectionString: url, ssl });
await client.connect();
await client.query(fs.readFileSync(path.resolve("db/schema.sql"), "utf8"));
await client.end();
console.log("✓ Schema applied");
