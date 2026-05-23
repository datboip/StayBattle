import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SCRYPT_KEYLEN = 32;
const SALT_BYTES = 16;
// N=2^14 ≈ ~100ms per hash on a modern laptop — fast enough not to delay
// sign-in, slow enough to make brute-forcing a 4-6 digit PIN take hours.
const SCRYPT_N = 16384;

export function hashPin(pin: string): string {
  const salt = randomBytes(SALT_BYTES);
  const derived = scryptSync(pin, salt, SCRYPT_KEYLEN, { N: SCRYPT_N });
  return `${salt.toString("hex")}:${derived.toString("hex")}`;
}

export function verifyPin(pin: string, stored: string): boolean {
  const parts = stored.split(":");
  if (parts.length !== 2) return false;
  const [saltHex, hashHex] = parts;
  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(saltHex, "hex");
    expected = Buffer.from(hashHex, "hex");
  } catch {
    return false;
  }
  if (expected.length === 0) return false;
  const actual = scryptSync(pin, salt, expected.length, { N: SCRYPT_N });
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(expected, actual);
}

export function isValidPin(pin: string): boolean {
  return /^[0-9]{4,6}$/.test(pin);
}

export function normalizeName(name: string): string {
  // Case-insensitive, whitespace-collapsed canonical key for uniqueness.
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}
