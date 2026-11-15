import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { Pool } from 'pg';
import { createTestPool, prepareTestDatabase } from '../helpers/test-database';

const TOR_ID = '00000000-0000-0000-0000-000000000001';
const EXCLUSION_VIOLATION = '23P01';

describe('price tier overlap rule (integration)', () => {
  let pool: Pool;

  before(async () => {
    await prepareTestDatabase();
    pool = createTestPool();
  });

  after(async () => {
    await pool.end();
  });

  it('rejects a tier that overlaps an existing one for the same product and level', async () => {
    // The seed already has 10-49 and 50-null for TOR-001 minorista; 40-60 overlaps both.
    await assert.rejects(
      pool.query(
        `INSERT INTO price_tiers (id, product_id, level, min_qty, max_qty, unit_price)
         VALUES (gen_random_uuid(), $1, 'NIVEL_2_MINORISTA', 40, 60, 1.00)`,
        [TOR_ID],
      ),
      (error: unknown) => (error as { code?: string }).code === EXCLUSION_VIOLATION,
    );
  });

  it('accepts adjacent tiers that do not overlap (50-99 then 100 and up)', async () => {
    // Runs in a transaction that is rolled back, so the seed data is left untouched.
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `DELETE FROM price_tiers WHERE product_id = $1 AND level = 'NIVEL_0_FABRICANTE' AND min_qty = 50`,
        [TOR_ID],
      );
      await client.query(
        `INSERT INTO price_tiers (id, product_id, level, min_qty, max_qty, unit_price)
         VALUES (gen_random_uuid(), $1, 'NIVEL_0_FABRICANTE', 50, 99, 5.40)`,
        [TOR_ID],
      );
      await client.query(
        `INSERT INTO price_tiers (id, product_id, level, min_qty, max_qty, unit_price)
         VALUES (gen_random_uuid(), $1, 'NIVEL_0_FABRICANTE', 100, null, 5.00)`,
        [TOR_ID],
      );
      await client.query('ROLLBACK');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });
});
