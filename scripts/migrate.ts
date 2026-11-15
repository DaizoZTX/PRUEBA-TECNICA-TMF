import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Client } from 'pg';

const MIGRATIONS_DIR = join(__dirname, '..', 'migrations');
const MIGRATIONS_LOCK_ID = 727272;

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

async function listMigrationFiles(): Promise<string[]> {
  const entries = await readdir(MIGRATIONS_DIR);
  return entries.filter((name) => name.endsWith('.sql')).sort();
}

async function applyMigration(client: Client, fileName: string): Promise<void> {
  const sql = await readFile(join(MIGRATIONS_DIR, fileName), 'utf8');

  await client.query('BEGIN');
  try {
    await client.query(sql);
    await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [fileName]);
    await client.query('COMMIT');
    console.log(`applied ${fileName}`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

async function main(): Promise<void> {
  process.loadEnvFile('.env');

  const client = new Client({
    host: requiredEnv('DB_HOST'),
    port: Number(requiredEnv('DB_PORT')),
    user: requiredEnv('POSTGRES_USER'),
    password: requiredEnv('POSTGRES_PASSWORD'),
    database: requiredEnv('POSTGRES_DB'),
  });

  await client.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATIONS_LOCK_ID]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    for (const fileName of await listMigrationFiles()) {
      const { rowCount } = await client.query(
        'SELECT 1 FROM schema_migrations WHERE name = $1',
        [fileName],
      );
      if (rowCount === 0) {
        await applyMigration(client, fileName);
      }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [MIGRATIONS_LOCK_ID]);
    await client.end();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});