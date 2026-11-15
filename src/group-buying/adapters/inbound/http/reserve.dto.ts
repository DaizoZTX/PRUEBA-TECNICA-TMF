import { Type } from 'class-transformer';
import { IsInt, Matches, Max, Min } from 'class-validator';
import { UUID_FORMAT } from '../../../../shared/validation/uuid';

const MAX_QUANTITY_PER_RESERVATION = 100_000;

export class LotParamsDto {
  @Matches(UUID_FORMAT, { message: 'lotId must be a UUID' })
  lotId!: string;
}

export class ReserveBodyDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_QUANTITY_PER_RESERVATION)
  quantity!: number;
}
