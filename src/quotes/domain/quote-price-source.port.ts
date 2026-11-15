import { AuthenticatedRole } from '../../shared/viewer';
import { QuotableProduct } from './quote.model';

export const QUOTE_PRICE_SOURCE = Symbol('QUOTE_PRICE_SOURCE');

/**
 * Returns the products with ONLY the tiers of the given level.
 * Like the catalog port, it has no way to read prices for other levels.
 */
export interface QuotePriceSource {
  findForLevel(
    productIds: readonly string[],
    level: AuthenticatedRole,
  ): Promise<QuotableProduct[]>;
}
