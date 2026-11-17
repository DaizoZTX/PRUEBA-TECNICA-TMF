export interface TierPrice {
  readonly minQty: number;
  readonly maxQty: number | null;
  readonly unitPriceCents: number;
}

/** A product as seen by a quote: only the tiers of the buyer's own level are present. */
export interface QuotableProduct {
  readonly id: string;
  readonly sku: string;
  readonly technicalName: string;
  readonly moq: number;
  readonly tiers: readonly TierPrice[];
}

export interface QuoteItemInput {
  readonly productId: string;
  readonly quantity: number;
}

export interface QuoteLine {
  readonly productId: string;
  readonly sku: string;
  readonly technicalName: string;
  readonly quantity: number;
  readonly tier: TierPrice;
  readonly unitPriceCents: number;
  readonly subtotalCents: number;
  readonly discount_percent: number;
}

export interface Quote {
  readonly lines: readonly QuoteLine[];
  readonly totalCents: number;
}
