import { Client, Pool } from 'pg';
import { loadDbConfig, TEST_DATABASE_NAME } from '../../scripts/lib/db-config';
import { runMigrations } from '../../scripts/migrate';
import { runSeed } from '../../scripts/seed';

/** Creates tmf_test if needed, then migrates and seeds it. Idempotent: safe to call in every test file. */
export async function prepareTestDatabase(): Promise<void> {
  process.loadEnvFile('.env');
  await createTestDatabaseIfMissing();

  const config = loadDbConfig(TEST_DATABASE_NAME);
  await runMigrations(config);
  await runSeed(config);
}

/** Pool bound to tmf_test. Call prepareTestDatabase() first. */
export function createTestPool(): Pool {
  process.loadEnvFile('.env');
  return new Pool(loadDbConfig(TEST_DATABASE_NAME));
}

async function createTestDatabaseIfMissing(): Promise<void> {
  // CREATE DATABASE cannot run inside a transaction and cannot use parameters,
  // so the name is a fixed constant from this file, never user input.
  const admin = new Client(loadDbConfig('postgres'));
  await admin.connect();
  try {
    const { rowCount } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [
      TEST_DATABASE_NAME,
    ]);
    if (rowCount === 0) {
      await admin.query(`CREATE DATABASE ${TEST_DATABASE_NAME}`);
    }
  } finally {
    await admin.end();
  }
}
