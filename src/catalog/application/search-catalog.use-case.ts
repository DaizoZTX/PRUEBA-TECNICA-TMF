import { Inject, Injectable } from '@nestjs/common';
import { Viewer } from '../../shared/viewer';
import { PriceFilterNotAllowedError } from '../domain/catalog.errors';
import {
  CatalogFilters,
  PriceRangeFilter,
  PricedCatalogItem,
  PublicCatalogItem,
} from '../domain/catalog.model';
import { CATALOG_READER, CatalogReader } from '../domain/catalog-reader.port';

export interface CatalogQuery extends CatalogFilters, PriceRangeFilter {}

export interface CatalogResponse {
  readonly items: readonly (PublicCatalogItem | PricedCatalogItem)[];
}

@Injectable()
export class SearchCatalogUseCase {
  constructor(@Inject(CATALOG_READER) private readonly reader: CatalogReader) {}

  async execute(viewer: Viewer, query: CatalogQuery): Promise<CatalogResponse> {
    const filters: CatalogFilters = {
      text: query.text,
      limit: query.limit,
      offset: query.offset,
    };

    if (viewer.kind === 'guest') {
      if (query.minPriceCents !== undefined || query.maxPriceCents !== undefined) {
        throw new PriceFilterNotAllowedError();
      }
      return { items: await this.reader.searchPublic(filters) };
    }

    return {
      items: await this.reader.searchPriced(viewer.role, {
        ...filters,
        minPriceCents: query.minPriceCents,
        maxPriceCents: query.maxPriceCents,
      }),
    };
  }
}
