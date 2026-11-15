import { Module } from '@nestjs/common';
import { CatalogController } from './adapters/inbound/http/catalog.controller';
import { PgCatalogReader } from './adapters/outbound/persistence/pg-catalog-reader';
import { SearchCatalogUseCase } from './application/search-catalog.use-case';
import { CATALOG_READER } from './domain/catalog-reader.port';

@Module({
  controllers: [CatalogController],
  providers: [
    SearchCatalogUseCase,
    { provide: CATALOG_READER, useClass: PgCatalogReader },
  ],
})
export class CatalogModule {}
