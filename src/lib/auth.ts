import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

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


/**
 * HMAC-sign a cookie payload so a client can't forge it. Format is
 * `<base64url(payload)>.<base64url(hmac)>`. The payload is base64url-encoded
 * so it never contains the "." separator. `verifyPayload` returns the original
 * payload only when the signature matches (constant-time), else null.
 */
export function signPayload(payload: string, secret: string): string {
  const p64 = Buffer.from(payload, "utf8").toString("base64url");
  const sig = createHmac("sha256", secret).update(p64).digest("base64url");
  return `${p64}.${sig}`;
}

export function verifyPayload(signed: string, secret: string): string | null {
  if (typeof signed !== "string") return null;
  const parts = signed.split(".");
  if (parts.length !== 2) return null;
  const [p64, sig] = parts;
  if (!p64 || !sig) return null;
  const expected = createHmac("sha256", secret).update(p64).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    return Buffer.from(p64, "base64url").toString("utf8");
  } catch {
    return null;
  }
}