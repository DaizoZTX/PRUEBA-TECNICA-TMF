import { DomainError } from '../../shared/errors';

export class PriceFilterNotAllowedError extends DomainError {
  constructor() {
    super('PRICE_FILTER_NOT_ALLOWED', 'Price filters require an authenticated buyer');
  }
}
