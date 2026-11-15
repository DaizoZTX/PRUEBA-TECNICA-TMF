import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InvalidTokenError } from '../../../../shared/errors';
import { AuthenticatedRole, ROLES, Viewer } from '../../../../shared/viewer';
import { AuthPort } from '../../../domain/auth.port';

const JWT_ALGORITHM = 'HS256';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const AUTHENTICATED_ROLES: readonly AuthenticatedRole[] = ROLES.filter(
  (role): role is AuthenticatedRole => role !== 'GUEST',
);

function isAuthenticatedRole(value: unknown): value is AuthenticatedRole {
  return typeof value === 'string' && (AUTHENTICATED_ROLES as readonly string[]).includes(value);
}

function toBuyerViewer(claims: unknown): Viewer { 
  if (typeof claims !== 'object' || claims === null) {
    throw new InvalidTokenError();
  }

  const { sub, role } = claims as { sub?: unknown; role?: unknown };
 
  if (typeof sub !== 'string' || !UUID_PATTERN.test(sub)) {
      throw new InvalidTokenError();
  }
  
  if (!isAuthenticatedRole(role)) {
    throw new InvalidTokenError();
  }

  return { kind: 'buyer', buyerId: sub, role };
}

@Injectable()
export class JwtAuthAdapter implements AuthPort {
  constructor(private readonly jwtService: JwtService) { }

  async resolveViewer(bearerToken: string | undefined): Promise<Viewer> {
    if (!bearerToken) {
      return { kind: 'guest' };
    }

    let claims: unknown;
    try {
      claims = await this.jwtService.verifyAsync(bearerToken, {
        algorithms: [JWT_ALGORITHM],
      });
    } catch {
      throw new InvalidTokenError();
    }

    return toBuyerViewer(claims);
  }
}

