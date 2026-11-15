import { Controller, Get, Query } from '@nestjs/common';
import { CurrentViewer } from '../../../../auth/adapters/inbound/http/current-viewer.decorator';
import { Viewer } from '../../../../shared/viewer';
import { CatalogResponse, CatalogQuery, SearchCatalogUseCase } from '../../../application/search-catalog.use-case';
import { SearchCatalogQueryDto } from './search-catalog.query.dto';

function dollarsToCents(dollars: number | undefined): number | undefined {
  return dollars === undefined ? undefined : Math.round(dollars * 100);
}

function toCatalogQuery(dto: SearchCatalogQueryDto): CatalogQuery {
  return {
    text: dto.text,
    limit: dto.limit,
    offset: dto.offset,
    minPriceCents: dollarsToCents(dto.minPrice),
    maxPriceCents: dollarsToCents(dto.maxPrice),
  };
}

@Controller('catalog')
export class CatalogController {
  constructor(private readonly searchCatalog: SearchCatalogUseCase) {}

  @Get('products')
  search(
    @CurrentViewer() viewer: Viewer,
    @Query() query: SearchCatalogQueryDto,
  ): Promise<CatalogResponse> {
    return this.searchCatalog.execute(viewer, toCatalogQuery(query));
  }
}
