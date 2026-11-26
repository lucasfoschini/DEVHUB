import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

/** Encrypts provider tokens at rest (THREAT_MODEL.md B4). AES-256-GCM with a random 96-bit IV;
 *  the auth tag makes any change to the stored value fail on decrypt. The key comes from
 *  ENCRYPTION_KEY and never lives in the database. */
const VERSION = 'v1'

export function parseKey(base64: string) {
  const key = Buffer.from(base64, 'base64')
  if (key.length !== 32) throw new Error('ENCRYPTION_KEY must be 32 bytes, base64-encoded')
  return key
}

export function encrypt(plain: string, key: Buffer) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return [VERSION, iv, cipher.getAuthTag(), data]
    .map((p) => (typeof p === 'string' ? p : p.toString('base64')))
    .join(':')
}

export function decrypt(stored: string, key: Buffer) {
  const [version, iv, tag, data] = stored.split(':')
  if (version !== VERSION || !iv || !tag || !data) throw new Error('Unknown token format')
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'))
  decipher.setAuthTag(Buffer.from(tag, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString(
    'utf8',
  )
}
