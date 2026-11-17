import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  BelowMoqError,
  DuplicateProductError,
  NoPriceForLevelError,
  ProductNotFoundError,
} from '../../src/quotes/domain/quote.errors';
import { QuotableProduct, TierPrice } from '../../src/quotes/domain/quote.model';
import { buildQuote, selectTier } from '../../src/quotes/domain/quote-pricing';
import { Viewer } from '../../src/shared/viewer';

// Two tiers, as in the PDF example: 10-49 at 850 cents, 50 and up at 720 cents.
const TIERS: readonly TierPrice[] = [
  { minQty: 10, maxQty: 49, unitPriceCents: 850 },
  { minQty: 50, maxQty: null, unitPriceCents: 720 },
];

const WHOLESALE_DISCOUNT_PERCENT = 5;
const WHOLESALE_MIN_QTY = 3;

const TOR: QuotableProduct = {
  id: '00000000-0000-0000-0000-000000000001',
  sku: 'TOR-001',
  technicalName: 'Tornillo autorroscante 6x1 in',
  moq: 10,
  tiers: TIERS,
};

const TAL: QuotableProduct = {
  id: '00000000-0000-0000-0000-000000000002',
  sku: 'TAL-002',
  technicalName: 'Taladro percutor 13 mm 600 W',
  moq: 2,
  tiers: [{ minQty: 2, maxQty: null, unitPriceCents: 9500 }],
};

// Single open-ended tier at 1000 cents, so discount math is easy to check by hand.
const CINTA: QuotableProduct = {
  id: '00000000-0000-0000-0000-000000000003',
  sku: 'CIN-003',
  technicalName: 'Cinta aislante 18 mm',
  moq: 1,
  tiers: [{ minQty: 1, maxQty: null, unitPriceCents: 1000 }],
};

const MAYORISTA: Viewer = {
  kind: 'buyer',
  buyerId: 'c0000000-0000-0000-0000-000000000000',
  role: 'NIVEL_1_MAYORISTA',
};

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

describe('selectTier', () => {
  it('uses the first tier at its lower bound and upper bound', () => {
    assert.equal(selectTier(TIERS, 10).unitPriceCents, 850);
    assert.equal(selectTier(TIERS, 49).unitPriceCents, 850);
  });

  it('switches to the second tier exactly at 50 units', () => {
    assert.equal(selectTier(TIERS, 50).unitPriceCents, 720);
  });

  it('keeps the open-ended tier for very large quantities', () => {
    assert.equal(selectTier(TIERS, 100_000).unitPriceCents, 720);
  });

  it('throws when the level has no tiers', () => {
    assert.throws(() => selectTier([], 10), NoPriceForLevelError);
  });
});

describe('buildQuote', () => {
  it('prices each line and sums the total in cents', () => {
    const quote = buildQuote(
      [TOR, TAL],
      [
        { productId: TOR.id, quantity: 50 },
        { productId: TAL.id, quantity: 2 },
      ],
      MAYORISTA,
    );

    assert.equal(quote.lines[0].unitPriceCents, 720);
    assert.equal(quote.lines[0].subtotalCents, 34200);
    assert.equal(quote.lines[1].subtotalCents, 19000);
    assert.equal(quote.totalCents, 53200);
  });

  it('accepts a quantity exactly at the MOQ', () => {
    const quote = buildQuote([TOR], [{ productId: TOR.id, quantity: 10 }], MAYORISTA);
    assert.equal(quote.lines[0].tier.unitPriceCents, 850);
  });

  it('rejects a quantity below the MOQ', () => {
    assert.throws(
      () => buildQuote([TOR], [{ productId: TOR.id, quantity: 9 }], MAYORISTA),
      BelowMoqError,
    );
  });

  it('rejects the same product twice', () => {
    assert.throws(
      () =>
        buildQuote(
          [TOR],
          [
            { productId: TOR.id, quantity: 10 },
            { productId: TOR.id, quantity: 20 },
          ],
          MAYORISTA,
        ),
      DuplicateProductError,
    );
  });

  it('rejects a product that does not exist', () => {
    assert.throws(
      () => buildQuote([TOR], [{ productId: TAL.id, quantity: 2 }], MAYORISTA),
      ProductNotFoundError,
    );
  });
});
