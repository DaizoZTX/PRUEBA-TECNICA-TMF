import {
  BelowMoqError,
  DuplicateProductError,
  NoPriceForLevelError,
  ProductNotFoundError,
} from './quote.errors';
import { Quote, QuotableProduct, QuoteItemInput, QuoteLine, TierPrice } from './quote.model';

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
export function priceLine(product: QuotableProduct, quantity: number): QuoteLine {
  if (quantity < product.moq) {
    throw new BelowMoqError(product.sku, product.moq);
  }

  const tier = selectTier(product.tiers, quantity);
  return {
    productId: product.id,
    sku: product.sku,
    technicalName: product.technicalName,
    quantity,
    tier,
    unitPriceCents: tier.unitPriceCents,
    subtotalCents: quantity * tier.unitPriceCents,
  };
}

/** Builds the full proforma. Rejects duplicates and products that do not exist. */
export function buildQuote(
  products: readonly QuotableProduct[],
  items: readonly QuoteItemInput[],
): Quote {
  const productsById = new Map(products.map((product) => [product.id, product]));
  const seenProductIds = new Set<string>();

  const lines = items.map((item) => {
    if (seenProductIds.has(item.productId)) {
      throw new DuplicateProductError();
    }
    seenProductIds.add(item.productId);

    const product = productsById.get(item.productId);
    if (!product) {
      throw new ProductNotFoundError(item.productId);
    }
    return priceLine(product, item.quantity);
  });

  const totalCents = lines.reduce((sum, line) => sum + line.subtotalCents, 0);
  return { lines, totalCents };
}
