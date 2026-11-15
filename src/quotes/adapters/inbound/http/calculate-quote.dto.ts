import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsInt,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

const MAX_ITEMS_PER_QUOTE = 50;
const MAX_QUANTITY_PER_ITEM = 100_000;

export class QuoteItemDto {
  @IsUUID()
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
