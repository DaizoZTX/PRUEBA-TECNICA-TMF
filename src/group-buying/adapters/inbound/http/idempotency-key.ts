import { InvalidIdempotencyKeyError } from '../../../domain/group-buying.errors';

const MAX_KEY_LENGTH = 128;
// Visible ASCII only: no spaces, no control characters.
const VISIBLE_ASCII = /^[\x21-\x7E]+$/;

/** Returns the key if the header is present, 1 to 128 chars, visible ASCII. Otherwise throws. */
export function parseIdempotencyKey(header: string | undefined): string {
  if (header === undefined || header.length > MAX_KEY_LENGTH || !VISIBLE_ASCII.test(header)) {
    throw new InvalidIdempotencyKeyError();
  }
  return header;
}
