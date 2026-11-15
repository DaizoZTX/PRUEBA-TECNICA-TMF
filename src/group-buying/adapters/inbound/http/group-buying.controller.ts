import {
  Body,
  Controller,
  Headers,
  HttpStatus,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { CurrentViewer } from '../../../../auth/adapters/inbound/http/current-viewer.decorator';
import { Viewer } from '../../../../shared/viewer';
import { ReserveGroupBuyUseCase } from '../../../application/reserve-group-buy.use-case';
import { Reservation } from '../../../domain/reservation.model';
import { parseIdempotencyKey } from './idempotency-key';
import { LotParamsDto, ReserveBodyDto } from './reserve.dto';

export interface ReservationResponse {
  readonly replayed: boolean;
  readonly reservation: Reservation;
}

@Controller('group-buying')
export class GroupBuyingController {
  constructor(private readonly reserveGroupBuy: ReserveGroupBuyUseCase) {}

  /** 201 when the reservation consumed capacity; 200 when it is a retry of an earlier request. */
  @Post(':lotId/reserve')
  async reserve(
    @CurrentViewer() viewer: Viewer,
    @Param() params: LotParamsDto,
    @Body() body: ReserveBodyDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ReservationResponse> {
    const outcome = await this.reserveGroupBuy.execute(viewer, {
      lotId: params.lotId,
      quantity: body.quantity,
      idempotencyKey: parseIdempotencyKey(idempotencyKey),
    });

    response.status(outcome.kind === 'created' ? HttpStatus.CREATED : HttpStatus.OK);
    return { replayed: outcome.kind === 'replayed', reservation: outcome.reservation };
  }
}
