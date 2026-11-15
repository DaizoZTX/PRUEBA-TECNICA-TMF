import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { Pool } from 'pg';
import { PgCatalogReader } from '../../src/catalog/adapters/outbound/persistence/pg-catalog-reader';
import { createTestPool, prepareTestDatabase } from '../helpers/test-database';

// Uses the seeded data (see scripts/seed.ts). TOR-001 prices:
//   NIVEL_2_MINORISTA: 850 / 720 cents   NIVEL_0_FABRICANTE: 600 / 540 cents
const TOR_001 = 'TOR-001';
const FORBIDDEN_PUBLIC_KEYS = ['stock', 'moq', 'tiers', 'unitPriceCents'];

describe('Catalog privacy wall (integration)', () => {
  let pool: Pool;
  let reader: PgCatalogReader;

  before(async () => {
    await prepareTestDatabase();
    pool = createTestPool();
    reader = new PgCatalogReader(pool);
  });

  after(async () => {
    await pool.end();
  });

  it('public items never expose stock, moq, tiers or prices', async () => {
    const items = await reader.searchPublic({ limit: 100, offset: 0 });

    assert.ok(items.length > 0);
    for (const item of items) {
      for (const key of FORBIDDEN_PUBLIC_KEYS) {
        assert.equal(key in item, false, `public item must not expose "${key}"`);
      }
    }
  });

  it('each level receives only its own prices', async () => {
    const [minorista] = await reader.searchPriced('NIVEL_2_MINORISTA', {
      text: TOR_001,
      limit: 10,
      offset: 0,
    });
    const [fabricante] = await reader.searchPriced('NIVEL_0_FABRICANTE', {
      text: TOR_001,
      limit: 10,
      offset: 0,
    });

    assert.deepEqual(
      minorista.tiers.map((tier) => tier.unitPriceCents),
      [850, 720],
    );
    assert.deepEqual(
      fabricante.tiers.map((tier) => tier.unitPriceCents),
      [600, 540],
    );
  });

  it('a price range only considers tiers of the requested level', async () => {
    // 600 cents exists only for NIVEL_0_FABRICANTE; the minorista's lowest price is 720.
    const range = { text: TOR_001, minPriceCents: 600, maxPriceCents: 600, limit: 10, offset: 0 };

    const minorista = await reader.searchPriced('NIVEL_2_MINORISTA', range);
    const fabricante = await reader.searchPriced('NIVEL_0_FABRICANTE', range);

    assert.equal(minorista.length, 0);
    assert.equal(fabricante.length, 1);
  });
});
