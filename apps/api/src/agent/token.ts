import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

/** Local Agent credentials (ADR 0007). Pure functions so they can be unit tested. */

export const TOKEN_TTL_MS = 10 * 60_000
const BASE32 = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no I, O, 0, 1: easy to read aloud

export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex')

/** 8 characters from a 32-symbol alphabet: 40 bits, single use, valid 10 minutes. */
export function pairingCode() {
  return [...randomBytes(8)].map((b) => BASE32[b % 32]).join('')
}

export const deviceSecret = () => randomBytes(32).toString('base64url')

const sign = (key: string, body: string) =>
  createHmac('sha256', `devhub-agent-token:${key}`).update(body).digest('base64url')

/** `deviceId.expiry.signature`, valid TOKEN_TTL_MS. */
export function accessToken(key: string, deviceId: string, now = Date.now()) {
  const body = `${deviceId}.${now + TOKEN_TTL_MS}`
  return { token: `${body}.${sign(key, body)}`, expiresAt: new Date(now + TOKEN_TTL_MS) }
}

/** The device id of a valid, unexpired token, or null. */
export function verifyToken(key: string, token: string, now = Date.now()): string | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [deviceId, expiry, signature] = parts as [string, string, string]
  const expected = Buffer.from(sign(key, `${deviceId}.${expiry}`))
  const given = Buffer.from(signature)
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null
  return Number(expiry) > now ? deviceId : null
}
