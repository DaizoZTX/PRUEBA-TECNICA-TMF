import { AuthenticatedRole } from '../../shared/viewer';
import {
  CatalogFilters,
  PriceRangeFilter,
  PricedCatalogItem,
  PublicCatalogItem,
} from './catalog.model';

export const CATALOG_READER = Symbol('CATALOG_READER');

/**
 * The privacy wall lives in this port's shape:
 * - searchPublic takes no level and returns no price data.
 * - searchPriced requires a level, so prices can only be read for one level at a time.
 * There is no method that returns prices for all levels.
 */
export interface CatalogReader {
  searchPublic(filters: CatalogFilters): Promise<PublicCatalogItem[]>;
  searchPriced(
    level: AuthenticatedRole,
    filters: CatalogFilters & PriceRangeFilter,
  ): Promise<PricedCatalogItem[]>;
}
