import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { Pool } from 'pg';
import { createTestPool, prepareTestDatabase } from '../helpers/test-database';
import { PgLotReservations } from '../../src/group-buying/adapters/outbound/persistence/pg-lot-reservations';
import {
  CapacityExceededError,
  IdempotencyKeyReusedError,
} from '../../src/group-buying/domain/group-buying.errors';
import { ReservationOutcome } from '../../src/group-buying/domain/reservation.model';

// TOR-001 comes from the seed. Each test creates its own lot and removes it afterwards.
const SEED_PRODUCT_ID = '00000000-0000-0000-0000-000000000001';
const LOT_CAPACITY = 100;

async function settle<T>(promise: Promise<T>): Promise<{ ok: T } | { error: unknown }> {
  try {
    return { ok: await promise };
  } catch (error) {
    return { error };
  }
}

describe('Group-buying reservations under concurrency (integration)', () => {
  let pool: Pool;
  let reservations: PgLotReservations;
  let lotId: string;

  before(async () => {
    await prepareTestDatabase();
    pool = createTestPool();
    reservations = new PgLotReservations(pool);
  });

  // Each test starts with a fresh lot of 100 units.
  async function createLot(): Promise<void> {
    lotId = randomUUID();
    await pool.query(
      `INSERT INTO group_buy_lots (id, product_id, total_capacity, reserved, status)
       VALUES ($1, $2, $3, 0, 'ACTIVE')`,
      [lotId, SEED_PRODUCT_ID, LOT_CAPACITY],
    );
  }

  async function lotState(): Promise<{ reserved: number; reservations: number }> {
    const { rows } = await pool.query<{ reserved: number; reservations: string }>(
      `SELECT l.reserved,
              (SELECT count(*) FROM reservations r WHERE r.lot_id = l.id) AS reservations
         FROM group_buy_lots l
        WHERE l.id = $1`,
      [lotId],
    );
    return { reserved: rows[0].reserved, reservations: Number(rows[0].reservations) };
  }

  async function dropLot(): Promise<void> {
    await pool.query('DELETE FROM reservations WHERE lot_id = $1', [lotId]);
    await pool.query('DELETE FROM group_buy_lots WHERE id = $1', [lotId]);
  }

  after(async () => {
    await pool.end();
  });

  it('never oversells: 30 buyers racing for 100 units with 10 each get exactly 10 reservations', async () => {
    await createLot();
    try {
      const attempts = Array.from({ length: 30 }, () =>
        settle(
          reservations.reserve({
            lotId,
            buyerId: randomUUID(),
            quantity: 10,
            idempotencyKey: randomUUID(),
          }),
        ),
      );
      const results = await Promise.all(attempts);

      const created = results.filter((r): r is { ok: ReservationOutcome } => 'ok' in r);
      const rejected = results.filter((r) => 'error' in r);

      assert.equal(created.length, 10);
      assert.equal(rejected.length, 20);
      assert.ok(rejected.every((r) => 'error' in r && r.error instanceof CapacityExceededError));

      const state = await lotState();
      assert.equal(state.reserved, LOT_CAPACITY);
      assert.equal(state.reservations, 10);
    } finally {
      await dropLot();
    }
  });

  it('is idempotent: 5 concurrent retries with the same key create one reservation and consume once', async () => {
    await createLot();
    try {
      const buyerId = randomUUID();
      const idempotencyKey = randomUUID();
      const attempts = Array.from({ length: 5 }, () =>
        reservations.reserve({ lotId, buyerId, quantity: 10, idempotencyKey }),
      );
      const outcomes = await Promise.all(attempts);

      assert.equal(outcomes.filter((o) => o.kind === 'created').length, 1);
      assert.equal(outcomes.filter((o) => o.kind === 'replayed').length, 4);

      const state = await lotState();
      assert.equal(state.reserved, 10);
      assert.equal(state.reservations, 1);
    } finally {
      await dropLot();
    }
  });

  it('a retry after the lot is full returns the stored reservation, not an error', async () => {
    await createLot();
    try {
      const buyerId = randomUUID();
      const idempotencyKey = randomUUID();
      await reservations.reserve({ lotId, buyerId, quantity: LOT_CAPACITY, idempotencyKey });

      const retry = await reservations.reserve({ lotId, buyerId, quantity: LOT_CAPACITY, idempotencyKey });

      assert.equal(retry.kind, 'replayed');
      assert.equal((await lotState()).reserved, LOT_CAPACITY);
    } finally {
      await dropLot();
    }
  });

  it('rejects reusing a key with a different quantity, without consuming capacity', async () => {
    await createLot();
    try {
      const buyerId = randomUUID();
      const idempotencyKey = randomUUID();
      await reservations.reserve({ lotId, buyerId, quantity: 10, idempotencyKey });

      await assert.rejects(
        reservations.reserve({ lotId, buyerId, quantity: 20, idempotencyKey }),
        IdempotencyKeyReusedError,
      );
      assert.equal((await lotState()).reserved, 10);
    } finally {
      await dropLot();
    }
  });
});
