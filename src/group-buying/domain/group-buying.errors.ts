import { DomainError } from '../../shared/errors';

export class LotNotFoundError extends DomainError {
  constructor() {
    super('LOT_NOT_FOUND', 'The group-buying lot does not exist');
  }
}

export class LotNotActiveError extends DomainError {
  constructor() {
    super('LOT_NOT_ACTIVE', 'The group-buying lot is not open for reservations');
  }
}

export class CapacityExceededError extends DomainError {
  constructor() {
    super('CAPACITY_EXCEEDED', 'Not enough capacity left in this lot for the requested quantity');
  }
}

export class IdempotencyKeyReusedError extends DomainError {
  constructor() {
    super(
      'IDEMPOTENCY_KEY_REUSED',
      'This Idempotency-Key was already used with a different quantity',
    );
  }
}

export class InvalidIdempotencyKeyError extends DomainError {
  constructor() {
    super('INVALID_IDEMPOTENCY_KEY', 'Idempotency-Key header is required (1 to 128 visible characters)');
  }
}
