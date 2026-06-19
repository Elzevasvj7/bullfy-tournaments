import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { Client } from "pg";

const root = process.cwd();
const target = process.argv[2];

if (target !== "migrations" && target !== "seeds") {
  console.error("Usage: node scripts/db-apply.mjs <migrations|seeds>");
  process.exit(1);
}

async function readEnvFile() {
  const envPath = path.join(root, ".env");

  try {
    const env = await fs.readFile(envPath, "utf8");

    for (const line of env.split(/\r?\n/)) {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
        continue;
      }

      const [name, ...valueParts] = trimmed.split("=");
      const value = valueParts.join("=").trim().replace(/^["']|["']$/g, "");

      if (!process.env[name]) {
        process.env[name] = value;
      }
    }
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
}

function shouldUseSsl(databaseUrl) {
  const url = new URL(databaseUrl);
  const host = url.hostname.toLowerCase();

  return !["localhost", "127.0.0.1", "::1"].includes(host);
}

function formatTarget(databaseUrl) {
  const url = new URL(databaseUrl);

  return `${url.username}@${url.hostname}:${url.port || "5432"}${url.pathname}`;
}

await readEnvFile();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL is required for remote DB apply.");
  process.exit(1);
}

const client = new Client({
  connectionString: databaseUrl,
  ssl: shouldUseSsl(databaseUrl) ? { rejectUnauthorized: false } : undefined,
});

const folder = path.join(root, "db", target);
const files = (await fs.readdir(folder))
  .filter((file) => file.endsWith(".sql"))
  .sort();

console.log(`Connecting to ${formatTarget(databaseUrl)}`);

try {
  await client.connect();

  for (const file of files) {
    const filePath = path.join(folder, file);
    const sql = await fs.readFile(filePath, "utf8");

    console.log(`Applying ${target.slice(0, -1)} ${file}`);
    await client.query(sql);
  }

  console.log(`${target} applied.`);
} finally {
  await client.end();
}
