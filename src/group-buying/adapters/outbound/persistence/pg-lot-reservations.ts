import { Inject, Injectable } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { PG_POOL } from '../../../../database/database.constants';
import {
  CapacityExceededError,
  IdempotencyKeyReusedError,
  LotNotActiveError,
  LotNotFoundError,
} from '../../../domain/group-buying.errors';
import { LotReservations } from '../../../domain/lot-reservations.port';
import { Reservation, ReservationOutcome, ReserveRequest } from '../../../domain/reservation.model';

interface ReservationRow {
  id: string;
  lot_id: string;
  buyer_id: string;
  quantity: number;
  idempotency_key: string;
  created_at: Date;
}

interface LotStateRow {
  status: 'ACTIVE' | 'CLOSED';
}

const RESERVATION_COLUMNS = 'id, lot_id, buyer_id, quantity, idempotency_key, created_at';

function toReservation(row: ReservationRow): Reservation {
  return {
    id: row.id,
    lotId: row.lot_id,
    buyerId: row.buyer_id,
    quantity: row.quantity,
    idempotencyKey: row.idempotency_key,
    createdAt: row.created_at.toISOString(),
  };
}

@Injectable()
export class PgLotReservations implements LotReservations {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  /**
   * Runs the whole reservation in ONE transaction, so it either happens completely or not at all.
   * Any thrown error rolls back the insert and the capacity change together.
   */
  async reserve(request: ReserveRequest): Promise<ReservationOutcome> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const outcome = await this.reserveInTransaction(client, request);
      await client.query('COMMIT');
      return outcome;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private async reserveInTransaction(
    client: PoolClient,
    request: ReserveRequest,
  ): Promise<ReservationOutcome> {
    await this.assertLotExists(client, request.lotId);

    // Step 1: claim the idempotency key. The UNIQUE constraint makes a concurrent
    // retry with the same key wait here until the first request commits or rolls back.
    const inserted = await client.query<ReservationRow>(
      `INSERT INTO reservations (id, lot_id, buyer_id, quantity, idempotency_key)
       VALUES (gen_random_uuid(), $1, $2, $3, $4)
       ON CONFLICT (lot_id, buyer_id, idempotency_key) DO NOTHING
       RETURNING ${RESERVATION_COLUMNS}`,
      [request.lotId, request.buyerId, request.quantity, request.idempotencyKey],
    );

    if (inserted.rowCount === 0) {
      return this.replay(client, request);
    }

    // Step 2: consume capacity only if it still fits. The WHERE clause is checked
    // under the row lock taken by UPDATE, so two requests for the last units are serialized.
    const consumed = await client.query(
      `UPDATE group_buy_lots
          SET reserved = reserved + $2
        WHERE id = $1
          AND status = 'ACTIVE'
          AND reserved + $2 <= total_capacity
        RETURNING id`,
      [request.lotId, request.quantity],
    );

    if (consumed.rowCount === 0) {
      await this.throwWhyNotConsumed(client, request.lotId);
    }

    return { kind: 'created', reservation: toReservation(inserted.rows[0]) };
  }

  /** A retry of an already-processed key returns the stored reservation, even if the lot is now full. */
  private async replay(client: PoolClient, request: ReserveRequest): Promise<ReservationOutcome> {
    const { rows } = await client.query<ReservationRow>(
      `SELECT ${RESERVATION_COLUMNS}
         FROM reservations
        WHERE lot_id = $1 AND buyer_id = $2 AND idempotency_key = $3`,
      [request.lotId, request.buyerId, request.idempotencyKey],
    );

    const existing = rows[0];
    if (existing.quantity !== request.quantity) {
      throw new IdempotencyKeyReusedError();
    }
    return { kind: 'replayed', reservation: toReservation(existing) };
  }

  private async assertLotExists(client: PoolClient, lotId: string): Promise<void> {
    const { rowCount } = await client.query('SELECT 1 FROM group_buy_lots WHERE id = $1', [lotId]);
    if (rowCount === 0) {
      throw new LotNotFoundError();
    }
  }

  /** Called only after the conditional UPDATE matched no row, to report the real reason. */
  private async throwWhyNotConsumed(client: PoolClient, lotId: string): Promise<never> {
    const { rows } = await client.query<LotStateRow>(
      'SELECT status FROM group_buy_lots WHERE id = $1',
      [lotId],
    );
    if (rows[0].status !== 'ACTIVE') {
      throw new LotNotActiveError();
    }
    throw new CapacityExceededError();
  }
}
