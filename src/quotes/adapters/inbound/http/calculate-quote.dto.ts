import { Type } from 'class-transformer';
import { UUID_FORMAT } from '../../../../shared/validation/uuid';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsInt,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

const MAX_ITEMS_PER_QUOTE = 50;
const MAX_QUANTITY_PER_ITEM = 100_000;

export class QuoteItemDto {
  @Matches(UUID_FORMAT, { message: 'productId must be a UUID' })
  productId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_QUANTITY_PER_ITEM)
  quantity!: number;
}

export class CalculateQuoteDto {
  @ValidateNested({ each: true })
  @Type(() => QuoteItemDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_ITEMS_PER_QUOTE)
  items!: QuoteItemDto[];
}
