import { Module } from '@nestjs/common';

// Modulos
import { DatabaseModule } from './database/database.module';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { CatalogModule } from './catalog/catalog.module';
import { QuotesModule } from './quotes/quotes.module';
import { HttpErrorFilter } from './shared/http/http-error.filter';
import { APP_FILTER } from '@nestjs/core';


@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    DatabaseModule,
    AuthModule,
    CatalogModule,
    QuotesModule,
  ],
  providers: [{ provide: APP_FILTER, useClass: HttpErrorFilter }],
})

export class AppModule {}
