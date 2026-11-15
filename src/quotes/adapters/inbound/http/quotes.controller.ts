import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { CurrentViewer } from '../../../../auth/adapters/inbound/http/current-viewer.decorator';
import { Viewer } from '../../../../shared/viewer';
import { CalculateQuoteUseCase } from '../../../application/calculate-quote.use-case';
import { Quote } from '../../../domain/quote.model';
import { CalculateQuoteDto } from './calculate-quote.dto';

@Controller('quotes')
export class QuotesController {
  constructor(private readonly calculateQuote: CalculateQuoteUseCase) {}

  @Post('calculate')
  @HttpCode(HttpStatus.OK)
  calculate(
    @CurrentViewer() viewer: Viewer,
    @Body() body: CalculateQuoteDto,
  ): Promise<Quote> {
    return this.calculateQuote.execute(viewer, body.items);
  }
}
