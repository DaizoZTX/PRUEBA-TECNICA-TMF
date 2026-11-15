export class DomainError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class InvalidTokenError extends DomainError {
  constructor() {
    super('INVALID_TOKEN', 'Invalid or expired token');
  }
}

/** Shared by every operation that needs a buyer account, not a guest. */
export class BuyerRequiredError extends DomainError {
  constructor() {
    super('BUYER_REQUIRED', 'A buyer account is required for this operation');
  }
}
