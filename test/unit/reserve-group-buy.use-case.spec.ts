import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BuyerRequiredError } from '../../src/shared/errors';
import { ReserveGroupBuyUseCase } from '../../src/group-buying/application/reserve-group-buy.use-case';
import { LotReservations } from '../../src/group-buying/domain/lot-reservations.port';
import { ReserveRequest } from '../../src/group-buying/domain/reservation.model';
import { parseIdempotencyKey } from '../../src/group-buying/adapters/inbound/http/idempotency-key';
import { InvalidIdempotencyKeyError } from '../../src/group-buying/domain/group-buying.errors';

const BUYER_ID = 'c0000000-0000-0000-0000-000000000001';
const LOT_ID = '00000000-0000-0000-0000-000000000010';

function recordingPort(): { port: LotReservations; requests: ReserveRequest[] } {
  const requests: ReserveRequest[] = [];
  const port: LotReservations = {
    reserve: async (request) => {
      requests.push(request);
      return {
        kind: 'created',
        reservation: {
          id: 'r1',
          lotId: request.lotId,
          buyerId: request.buyerId,
          quantity: request.quantity,
          idempotencyKey: request.idempotencyKey,
          createdAt: new Date(0).toISOString(),
        },
      };
    },
  };
  return { port, requests };
}

describe('ReserveGroupBuyUseCase', () => {
  it('a guest cannot reserve, and nothing reaches storage', async () => {
    const { port, requests } = recordingPort();

    await assert.rejects(
      new ReserveGroupBuyUseCase(port).execute(
        { kind: 'guest' },
        { lotId: LOT_ID, quantity: 10, idempotencyKey: 'key-1' },
      ),
      BuyerRequiredError,
    );
    assert.equal(requests.length, 0);
  });

  it('a buyer reserves on his own behalf, using the id from the token', async () => {
    const { port, requests } = recordingPort();

    await new ReserveGroupBuyUseCase(port).execute(
      { kind: 'buyer', buyerId: BUYER_ID, role: 'NIVEL_2_MINORISTA' },
      { lotId: LOT_ID, quantity: 10, idempotencyKey: 'key-1' },
    );

    assert.deepEqual(requests, [
      { lotId: LOT_ID, buyerId: BUYER_ID, quantity: 10, idempotencyKey: 'key-1' },
    ]);
  });
});

describe('parseIdempotencyKey', () => {
  it('accepts a visible-ASCII key of up to 128 characters', () => {
    assert.equal(parseIdempotencyKey('abc-123_XYZ'), 'abc-123_XYZ');
    assert.equal(parseIdempotencyKey('a'.repeat(128)).length, 128);
  });

  it('rejects a missing header', () => {
    assert.throws(() => parseIdempotencyKey(undefined), InvalidIdempotencyKeyError);
  });

  it('rejects an empty key', () => {
    assert.throws(() => parseIdempotencyKey(''), InvalidIdempotencyKeyError);
  });

  it('rejects a key longer than 128 characters', () => {
    assert.throws(() => parseIdempotencyKey('a'.repeat(129)), InvalidIdempotencyKeyError);
  });

  it('rejects spaces and control characters', () => {
    assert.throws(() => parseIdempotencyKey('has space'), InvalidIdempotencyKeyError);
    assert.throws(() => parseIdempotencyKey('tab\there'), InvalidIdempotencyKeyError);
  });
});
