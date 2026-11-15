import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';

const API_GLOBAL_PREFIX = 'api';
const DEFAULT_PORT = 3000;
const JSON_BODY_LIMIT = '10kb';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });

  app.useBodyParser('json', { limit: JSON_BODY_LIMIT });
  app.use(helmet());

  app.setGlobalPrefix(API_GLOBAL_PREFIX);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableShutdownHooks();

  const config = app.get(ConfigService);
  const port = Number(config.get<string>('PORT', String(DEFAULT_PORT)));

  await app.listen(port);
}

void bootstrap();
