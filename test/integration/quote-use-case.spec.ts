import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { Pool } from 'pg';
import { BuyerRequiredError } from '../../src/shared/errors';
import { Viewer } from '../../src/shared/viewer';
import { PgQuotePriceSource } from '../../src/quotes/adapters/outbound/persistence/pg-quote-price-source';
import { CalculateQuoteUseCase } from '../../src/quotes/application/calculate-quote.use-case';
import { BelowMoqError, ProductNotFoundError } from '../../src/quotes/domain/quote.errors';
import { createTestPool, prepareTestDatabase } from '../helpers/test-database';

// Seed products: TOR-001 (moq 10) and TAL-002 (moq 2).
const TOR_ID = '00000000-0000-0000-0000-000000000001';
const TAL_ID = '00000000-0000-0000-0000-000000000002';

const MINORISTA: Viewer = {
  kind: 'buyer',
  buyerId: 'c0000000-0000-0000-0000-000000000001',
  role: 'NIVEL_2_MINORISTA',
};
const FABRICANTE: Viewer = {
  kind: 'buyer',
  buyerId: 'c0000000-0000-0000-0000-000000000002',
  role: 'NIVEL_0_FABRICANTE',
};

describe('CalculateQuoteUseCase against the database (integration)', () => {
  let pool: Pool;
  let useCase: CalculateQuoteUseCase;

  before(async () => {
    await prepareTestDatabase();
    pool = createTestPool();
    useCase = new CalculateQuoteUseCase(new PgQuotePriceSource(pool));
  });

  after(async () => {
    await pool.end();
  });

  it('a guest cannot calculate a quote', async () => {
    await assert.rejects(
      useCase.execute({ kind: 'guest' }, [{ productId: TOR_ID, quantity: 10 }]),
      BuyerRequiredError,
    );
  });

  it('prices 60 units of TOR-001 with the minorista tier (720 cents): total 43200', async () => {
    const quote = await useCase.execute(MINORISTA, [{ productId: TOR_ID, quantity: 60 }]);

    assert.equal(quote.lines[0].unitPriceCents, 720);
    assert.equal(quote.totalCents, 43200);
  });

  it('prices the same quantity for a fabricante with its own tier (540 cents): total 32400', async () => {
    const quote = await useCase.execute(FABRICANTE, [{ productId: TOR_ID, quantity: 60 }]);

    assert.equal(quote.lines[0].unitPriceCents, 540);
    assert.equal(quote.totalCents, 32400);
  });

  it('sums two products in one quote: 43200 + 19000 = 62200', async () => {
    const quote = await useCase.execute(MINORISTA, [
      { productId: TOR_ID, quantity: 60 },
      { productId: TAL_ID, quantity: 2 },
    ]);

    assert.equal(quote.totalCents, 62200);
  });

  it('rejects a quantity below the MOQ of the real product', async () => {
    await assert.rejects(
      useCase.execute(MINORISTA, [{ productId: TOR_ID, quantity: 9 }]),
      BelowMoqError,
    );
  });

  it('rejects a product that does not exist', async () => {
    await assert.rejects(
      useCase.execute(MINORISTA, [{ productId: randomUUID(), quantity: 10 }]),
      ProductNotFoundError,
    );
  });
});
