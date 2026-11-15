export interface Reservation {
  readonly id: string;
  readonly lotId: string;
  readonly buyerId: string;
  readonly quantity: number;
  readonly idempotencyKey: string;
  readonly createdAt: string;
}

export interface ReserveRequest {
  readonly lotId: string;
  readonly buyerId: string;
  readonly quantity: number;
  readonly idempotencyKey: string;
}

/**
 * "created": this request consumed capacity.
 * "replayed": the same key was already processed; nothing was consumed again.
 */
export interface ReservationOutcome {
  readonly kind: 'created' | 'replayed';
  readonly reservation: Reservation;
}
