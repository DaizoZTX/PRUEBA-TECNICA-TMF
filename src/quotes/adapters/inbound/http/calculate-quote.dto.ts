import { Type } from 'class-transformer';
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
// Any 8-4-4-4-12 hexadecimal id, as PostgreSQL's uuid type accepts it.
// Stricter RFC 4122 checks would reject the fixed seed ids (see BORRADOR_DECISIONES.md, 0.4).
const UUID_FORMAT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
