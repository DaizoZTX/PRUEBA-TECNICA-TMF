import { Inject, Injectable } from '@nestjs/common';
import { BuyerRequiredError } from '../../shared/errors';
import { Viewer } from '../../shared/viewer';
import { LOT_RESERVATIONS, LotReservations } from '../domain/lot-reservations.port';
import { ReservationOutcome } from '../domain/reservation.model';

export interface ReserveGroupBuyInput {
  readonly lotId: string;
  readonly quantity: number;
  readonly idempotencyKey: string;
}

@Injectable()
export class ReserveGroupBuyUseCase {
  constructor(@Inject(LOT_RESERVATIONS) private readonly reservations: LotReservations) {}

  async execute(viewer: Viewer, input: ReserveGroupBuyInput): Promise<ReservationOutcome> {
    if (viewer.kind === 'guest') {
      throw new BuyerRequiredError();
    }

    return this.reservations.reserve({
      lotId: input.lotId,
      buyerId: viewer.buyerId,
      quantity: input.quantity,
      idempotencyKey: input.idempotencyKey,
    });
  }
}
