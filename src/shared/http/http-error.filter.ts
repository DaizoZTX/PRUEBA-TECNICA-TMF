import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { DomainError } from '../errors';

const STATUS_BY_DOMAIN_CODE: Readonly<Record<string, HttpStatus>> = {
  INVALID_TOKEN: HttpStatus.UNAUTHORIZED,
  PRICE_FILTER_NOT_ALLOWED: HttpStatus.BAD_REQUEST,
  BUYER_REQUIRED: HttpStatus.FORBIDDEN,
  DUPLICATE_PRODUCT: HttpStatus.BAD_REQUEST,
  PRODUCT_NOT_FOUND: HttpStatus.NOT_FOUND,
  BELOW_MOQ: HttpStatus.UNPROCESSABLE_ENTITY,
  NO_PRICE_FOR_LEVEL: HttpStatus.UNPROCESSABLE_ENTITY,
  LOT_NOT_FOUND: HttpStatus.NOT_FOUND,
  LOT_NOT_ACTIVE: HttpStatus.CONFLICT,
  CAPACITY_EXCEEDED: HttpStatus.CONFLICT,
  IDEMPOTENCY_KEY_REUSED: HttpStatus.UNPROCESSABLE_ENTITY,
  INVALID_IDEMPOTENCY_KEY: HttpStatus.BAD_REQUEST,
};

const INTERNAL_ERROR_BODY = { code: 'INTERNAL_ERROR', message: 'Internal server error' };

@Catch()
export class HttpErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpErrorFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof DomainError) {
      const status = STATUS_BY_DOMAIN_CODE[exception.code] ?? HttpStatus.BAD_REQUEST;
      response.status(status).json({ code: exception.code, message: exception.message });
      return;
    }

    if (exception instanceof HttpException) {
      response.status(exception.getStatus()).json(exception.getResponse());
      return;
    }

    this.logger.error('Unhandled error', exception instanceof Error ? exception.stack : String(exception));
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(INTERNAL_ERROR_BODY);
  }
}
