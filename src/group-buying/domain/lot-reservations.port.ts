import { ReservationOutcome, ReserveRequest } from './reservation.model';

export const LOT_RESERVATIONS = Symbol('LOT_RESERVATIONS');

/**
 * Reserves units of a lot atomically and idempotently.
 * Implementations must guarantee, in storage, that:
 * - reserved never exceeds total_capacity, even under concurrent requests;
 * - a repeated (lot, buyer, idempotency key) never consumes capacity twice.
 */
export interface LotReservations {
  reserve(request: ReserveRequest): Promise<ReservationOutcome>;
}
