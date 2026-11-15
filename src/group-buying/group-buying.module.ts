import { Module } from '@nestjs/common';
import { GroupBuyingController } from './adapters/inbound/http/group-buying.controller';
import { PgLotReservations } from './adapters/outbound/persistence/pg-lot-reservations';
import { ReserveGroupBuyUseCase } from './application/reserve-group-buy.use-case';
import { LOT_RESERVATIONS } from './domain/lot-reservations.port';

@Module({
  controllers: [GroupBuyingController],
  providers: [
    ReserveGroupBuyUseCase,
    { provide: LOT_RESERVATIONS, useClass: PgLotReservations },
  ],
})
export class GroupBuyingModule {}
