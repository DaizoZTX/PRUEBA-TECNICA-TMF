import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { InvalidTokenError } from '../../../../shared/errors';
import { Viewer } from '../../../../shared/viewer';
import { AUTH_PORT, AuthPort } from '../../../domain/auth.port';

const BEARER_PREFIX = 'Bearer ';

export interface ViewerRequest extends Request {
  viewer?: Viewer;
}

/**
 * Extracts the raw token from the Authorization header.
 * - No header: undefined (the viewer is a guest).
 * - Header without the "Bearer " scheme, or an empty token: invalid.
 */
function extractBearerToken(header: string | undefined): string | undefined {
  if (header === undefined) {
    return undefined;
  }
  if (!header.startsWith(BEARER_PREFIX)) {
    throw new InvalidTokenError();
  }
  const token = header.slice(BEARER_PREFIX.length);
  if (token === '') {
    throw new InvalidTokenError();
  }
  return token;
}

@Injectable()
export class ResolveViewerGuard implements CanActivate {
  constructor(@Inject(AUTH_PORT) private readonly auth: AuthPort) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<ViewerRequest>();
    const token = extractBearerToken(request.headers.authorization);
    request.viewer = await this.auth.resolveViewer(token);
    return true;
  }
}
