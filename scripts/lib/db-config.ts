import { ClientConfig } from 'pg';

/** Database used only by the automated tests. The development database is never touched by them. */
export const TEST_DATABASE_NAME = 'tmf_test';

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

/**
 * Builds the connection settings from .env (loaded by the caller).
 * Pass a database name to override POSTGRES_DB, for example for tests.
 */
export function loadDbConfig(database?: string): ClientConfig {
  return {
    host: requiredEnv('DB_HOST'),
    port: Number(requiredEnv('DB_PORT')),
    user: requiredEnv('POSTGRES_USER'),
    password: requiredEnv('POSTGRES_PASSWORD'),
    database: database ?? requiredEnv('POSTGRES_DB'),
  };
}
