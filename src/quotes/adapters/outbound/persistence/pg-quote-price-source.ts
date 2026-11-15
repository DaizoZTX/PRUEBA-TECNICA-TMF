import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../../../../database/database.constants';
import { AuthenticatedRole } from '../../../../shared/viewer';
import { QuotableProduct, TierPrice } from '../../../domain/quote.model';
import { QuotePriceSource } from '../../../domain/quote-price-source.port';

interface TierRow {
  minQty: number;
  maxQty: number | null;
  unitPriceCents: number;
}

interface QuotableRow {
  id: string;
  sku: string;
  technical_name: string;
  moq: number;
  tiers: TierRow[];
}

function toTierPrice(row: TierRow): TierPrice {
  return {
    minQty: row.minQty,
    maxQty: row.maxQty,
    unitPriceCents: row.unitPriceCents,
  };
}

function toQuotableProduct(row: QuotableRow): QuotableProduct {
  return {
    id: row.id,
    sku: row.sku,
    technicalName: row.technical_name,
    moq: row.moq,
    tiers: row.tiers.map(toTierPrice),
  };
}

@Injectable()
export class PgQuotePriceSource implements QuotePriceSource {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  /** Joins only the tiers of the requested level ($2). Products without tiers come back with an empty list. */
  async findForLevel(
    productIds: readonly string[],
    level: AuthenticatedRole,
  ): Promise<QuotableProduct[]> {
    const { rows } = await this.pool.query<QuotableRow>(
      `SELECT p.id, p.sku, p.technical_name, p.moq,
              COALESCE(
                json_agg(
                  json_build_object(
                    'minQty', pt.min_qty,
                    'maxQty', pt.max_qty,
                    'unitPriceCents', ROUND(pt.unit_price * 100)::int
                  ) ORDER BY pt.min_qty
                ) FILTER (WHERE pt.id IS NOT NULL),
                '[]'::json
              ) AS tiers
         FROM products p
         LEFT JOIN price_tiers pt
                ON pt.product_id = p.id AND pt.level = $2
        WHERE p.id = ANY($1::uuid[])
        GROUP BY p.id`,
      [productIds, level],
    );
    return rows.map(toQuotableProduct);
  }
}
