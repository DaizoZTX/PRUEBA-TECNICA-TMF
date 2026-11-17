import {
  BelowMoqError,
  DuplicateProductError,
  NoPriceForLevelError,
  ProductNotFoundError,
} from './quote.errors';
import { BuyerRequiredError } from '../../shared/errors';
import { Quote, QuotableProduct, QuoteItemInput, QuoteLine, TierPrice } from './quote.model';
import { Viewer } from '../../shared/viewer';

/**
 * Picks the tier whose range contains the quantity.
 * A null maxQty means "no upper bound" (for example, 50 units and up).
 */
export function selectTier(tiers: readonly TierPrice[], quantity: number): TierPrice {
  const tier = tiers.find(
    (candidate) =>
      quantity >= candidate.minQty &&
      (candidate.maxQty === null || quantity <= candidate.maxQty),
  );

  if (!tier) {
    throw new NoPriceForLevelError();
  }
  return tier;
}

/** Prices one product line. All amounts are integer cents. */
export function priceLine(product: QuotableProduct, role: string, quantity: number): QuoteLine {
  if (quantity < product.moq) {
    throw new BelowMoqError(product.sku, product.moq);
  }

  const tier = selectTier(product.tiers, quantity);
  const discount_percent = 5;
  let price = tier.unitPriceCents;
  let discount = 0;

  if (quantity >= 3 && role === 'NIVEL_1_MAYORISTA') {
    price = price *  (1 - discount_percent / 100);
    discount = 5;
  }

  return {
    productId: product.id,
    sku: product.sku,
    technicalName: product.technicalName,
    quantity,
    tier,
    unitPriceCents: tier.unitPriceCents,
    subtotalCents: quantity * price,
    discount_percent: discount,
  };
}

/** Builds the full proforma. Rejects duplicates and products that do not exist. */
export function buildQuote(
  products: readonly QuotableProduct[],
  items: readonly QuoteItemInput[],
  viewer: Viewer
): Quote {
  if (viewer.kind === 'guest') {
    throw new BuyerRequiredError();
  }

  const productsById = new Map(products.map((product) => [product.id, product]));
  const seenProductIds = new Set<string>()
  const role = viewer.role;

  const lines = items.map((item) => {
    if (seenProductIds.has(item.productId)) {
      throw new DuplicateProductError();
    }
    seenProductIds.add(item.productId);

    const product = productsById.get(item.productId);
    if (!product) {
      throw new ProductNotFoundError(item.productId);
    }

    return priceLine(product, role, item.quantity);
  });

  const totalCents = lines.reduce((sum, line) => sum + line.subtotalCents, 0);
  return { lines, totalCents };
}
