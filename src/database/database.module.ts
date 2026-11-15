import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { DB_POOL_MAX_CONNECTIONS, PG_POOL } from './database.constants';
import { PgPoolLifecycle } from './pg-pool.lifecycle';

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Pool =>
        new Pool({
          host: config.getOrThrow<string>('DB_HOST'),
          port: Number(config.getOrThrow<string>('DB_PORT')),
          user: config.getOrThrow<string>('POSTGRES_USER'),
          password: config.getOrThrow<string>('POSTGRES_PASSWORD'),
          database: config.getOrThrow<string>('POSTGRES_DB'),
          max: DB_POOL_MAX_CONNECTIONS,
        }),
    }, PgPoolLifecycle
  ],
  exports: [PG_POOL],
})

export class DatabaseModule {}
