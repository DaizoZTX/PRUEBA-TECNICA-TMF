import { Module } from '@nestjs/common';
import { QuotesController } from './adapters/inbound/http/quotes.controller';
import { PgQuotePriceSource } from './adapters/outbound/persistence/pg-quote-price-source';
import { CalculateQuoteUseCase } from './application/calculate-quote.use-case';
import { QUOTE_PRICE_SOURCE } from './domain/quote-price-source.port';

@Module({
  controllers: [QuotesController],
  providers: [
    CalculateQuoteUseCase,
    { provide: QUOTE_PRICE_SOURCE, useClass: PgQuotePriceSource },
  ],
})
export class QuotesModule {}
