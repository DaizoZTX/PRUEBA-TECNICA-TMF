import { JwtService } from '@nestjs/jwt';
import { AuthenticatedRole, ROLES } from '../src/shared/viewer';

const AUTHENTICATED_ROLES = ROLES.filter((role): role is AuthenticatedRole => role !== 'GUEST');
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const USAGE = 'usage: npm run token -- <ROLE> <buyer-uuid>';

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

function parseArgs(args: string[]): { role: AuthenticatedRole; buyerId: string } {
  const [role, buyerId] = args;
  if (!AUTHENTICATED_ROLES.includes(role as AuthenticatedRole)) {
    throw new Error(`Invalid role. ${USAGE}\nAllowed: ${AUTHENTICATED_ROLES.join(', ')}`);
  }
  if (!buyerId || !UUID_PATTERN.test(buyerId)) {
    throw new Error(`Invalid buyer UUID. ${USAGE}`);
  }
  return { role: role as AuthenticatedRole, buyerId };
}

async function main(): Promise<void> {
  process.loadEnvFile('.env');
  const { role, buyerId } = parseArgs(process.argv.slice(2));

  const jwt = new JwtService({ secret: requiredEnv('JWT_SECRET') });
  const token = await jwt.signAsync(
    { sub: buyerId, role },
    {
      algorithm: 'HS256',
      expiresIn: Number(requiredEnv('JWT_EXPIRES_IN_SECONDS')),
    },
  );

  console.log(token);
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
