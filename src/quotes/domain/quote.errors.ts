import { DomainError } from '../../shared/errors';

export class DuplicateProductError extends DomainError {
  constructor() {
    super('DUPLICATE_PRODUCT', 'Each product may appear only once in a quote');
  }
}

export class ProductNotFoundError extends DomainError {
  constructor(productId: string) {
    super('PRODUCT_NOT_FOUND', `Product ${productId} does not exist`);
  }
}

export class BelowMoqError extends DomainError {
  constructor(sku: string, moq: number) {
    super('BELOW_MOQ', `Product ${sku} requires a minimum order of ${moq} units`);
  }
}

export class NoPriceForLevelError extends DomainError {
  constructor() {
    super('NO_PRICE_FOR_LEVEL', 'No price is available for this quantity and buyer level');
  }
}
