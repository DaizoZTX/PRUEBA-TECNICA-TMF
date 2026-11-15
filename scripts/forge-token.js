// Creates deliberately invalid tokens for the curl matrix (security tests only).
// Usage: node scripts/forge-token.js <case>
// Cases: guest-role | expired | bad-sub | wrong-secret | alg-none
const { JwtService } = require('@nestjs/jwt');

process.loadEnvFile('.env');

const BUYER_ID = 'c0000000-0000-0000-0000-000000000001';
const MINORISTA = 'NIVEL_2_MINORISTA';
const secret = process.env.JWT_SECRET;
const jwt = new JwtService({ secret });

function base64Url(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

const cases = {
  'guest-role': () => jwt.sign({ sub: BUYER_ID, role: 'GUEST' }),
  expired: () => jwt.sign({ sub: BUYER_ID, role: MINORISTA, exp: Math.floor(Date.now() / 1000) - 60 }),
  'bad-sub': () => jwt.sign({ sub: 'no-es-uuid', role: MINORISTA }),
  'wrong-secret': () =>
    new JwtService({ secret: 'otro-secreto-distinto-de-treinta-y-dos-caracteres' }).sign({
      sub: BUYER_ID,
      role: MINORISTA,
    }),
  'alg-none': () =>
    `${base64Url({ alg: 'none', typ: 'JWT' })}.${base64Url({ sub: BUYER_ID, role: MINORISTA })}.`,
};

const forge = cases[process.argv[2]];
if (!forge) {
  console.error(`unknown case. Use one of: ${Object.keys(cases).join(', ')}`);
  process.exit(1);
}
console.log(forge());
