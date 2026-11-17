import { Inject, Injectable } from '@nestjs/common';
import { BuyerRequiredError } from '../../shared/errors';
import { Viewer } from '../../shared/viewer';
import { Quote, QuoteItemInput } from '../domain/quote.model';
import { QUOTE_PRICE_SOURCE, QuotePriceSource } from '../domain/quote-price-source.port';
import { buildQuote } from '../domain/quote-pricing';

@Injectable()
export class CalculateQuoteUseCase {
  constructor(@Inject(QUOTE_PRICE_SOURCE) private readonly priceSource: QuotePriceSource) {}

  async execute(viewer: Viewer, items: readonly QuoteItemInput[]): Promise<Quote> {
    if (viewer.kind === 'guest') {
      throw new BuyerRequiredError();
    }

    const products = await this.priceSource.findForLevel(
      items.map((item) => item.productId),
      viewer.role,
    );
    return buildQuote(products, items, viewer);
  }
}


