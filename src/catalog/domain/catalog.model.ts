/** What any viewer, including guests, may see about a product. No price, no stock. */
export interface PublicCatalogItem {
  readonly id: string;
  readonly sku: string;
  readonly technicalName: string;
  readonly brand: string;
  readonly specs: Readonly<Record<string, string>>;
}

export interface PriceTier {
  readonly minQty: number;
  readonly maxQty: number | null;
  readonly unitPriceCents: number;
}

/** Only ever built for an authenticated buyer, and only with tiers of that buyer's level. */
export interface PricedCatalogItem extends PublicCatalogItem {
  readonly moq: number;
  readonly stock: number;
  readonly tiers: readonly PriceTier[];
}

export interface CatalogFilters {
  readonly text?: string;
  readonly limit: number;
  readonly offset: number;
}

export interface PriceRangeFilter {
  readonly minPriceCents?: number;
  readonly maxPriceCents?: number;
}
