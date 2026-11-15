import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../../../../database/database.constants';
import { AuthenticatedRole } from '../../../../shared/viewer';
import {
  CatalogFilters,
  PriceRangeFilter,
  PricedCatalogItem,
  PriceTier,
  PublicCatalogItem,
} from '../../../domain/catalog.model';
import { CatalogReader } from '../../../domain/catalog-reader.port';

interface PublicRow {
  id: string;
  sku: string;
  technical_name: string;
  brand: string;
  specs: Record<string, string>;
}

interface PricedRow extends PublicRow {
  moq: number;
  stock: number;
  tiers: PriceTierRow[];
}

interface PriceTierRow {
  minQty: number;
  maxQty: number | null;
  unitPriceCents: number;
}

/** Escapes LIKE wildcards so user text is matched literally. */
function toLikePattern(text: string | undefined): string | null {
  const trimmed = text?.trim();
  if (!trimmed) {
    return null;
  }
  return `%${trimmed.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

function toPublicItem(row: PublicRow): PublicCatalogItem {
  return {
    id: row.id,
    sku: row.sku,
    technicalName: row.technical_name,
    brand: row.brand,
    specs: row.specs,
  };
}

function toPriceTier(row: PriceTierRow): PriceTier {
  return {
    minQty: row.minQty,
    maxQty: row.maxQty,
    unitPriceCents: row.unitPriceCents,
  };
}

function toPricedItem(row: PricedRow): PricedCatalogItem {
  return {
    ...toPublicItem(row),
    moq: row.moq,
    stock: row.stock,
    tiers: row.tiers.map(toPriceTier),
  };
}

@Injectable()
export class PgCatalogReader implements CatalogReader {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  /**
   * Public query: no price_tiers join and no stock column.
   * A guest cannot receive prices or stock from this method, by construction.
   */
  async searchPublic(filters: CatalogFilters): Promise<PublicCatalogItem[]> {
    const { rows } = await this.pool.query<PublicRow>(
      `SELECT id, sku, technical_name, brand, specs
         FROM products
        WHERE ($1::text IS NULL
               OR technical_name ILIKE $1
               OR brand ILIKE $1
               OR sku ILIKE $1)
        ORDER BY sku
        LIMIT $2 OFFSET $3`,
      [toLikePattern(filters.text), filters.limit, filters.offset],
    );
    return rows.map(toPublicItem);
  }

  /**
   * Priced query: the only price data joined is the tiers of the given level.
   * Price range filters apply to tiers of that level, never to other levels.
   */
  async searchPriced(
    level: AuthenticatedRole,
    filters: CatalogFilters & PriceRangeFilter,
  ): Promise<PricedCatalogItem[]> {
    const { rows } = await this.pool.query<PricedRow>(
      `SELECT p.id, p.sku, p.technical_name, p.brand, p.specs, p.moq, p.stock,
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
                ON pt.product_id = p.id AND pt.level = $1
        WHERE ($2::text IS NULL
               OR p.technical_name ILIKE $2
               OR p.brand ILIKE $2
               OR p.sku ILIKE $2)
          AND ($3::int IS NULL OR EXISTS (
                SELECT 1 FROM price_tiers f
                 WHERE f.product_id = p.id AND f.level = $1
                   AND ROUND(f.unit_price * 100) >= $3))
          AND ($4::int IS NULL OR EXISTS (
                SELECT 1 FROM price_tiers f
                 WHERE f.product_id = p.id AND f.level = $1
                   AND ROUND(f.unit_price * 100) <= $4))
        GROUP BY p.id
        ORDER BY p.sku
        LIMIT $5 OFFSET $6`,
      [
        level,
        toLikePattern(filters.text),
        filters.minPriceCents ?? null,
        filters.maxPriceCents ?? null,
        filters.limit,
        filters.offset,
      ],
    );
    return rows.map(toPricedItem);
  }
}
