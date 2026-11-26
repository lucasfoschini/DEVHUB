import { BlockList, isIP } from 'node:net'

/** Addresses a monitor must never reach (THREAT_MODEL.md B5): loopback, private, link-local
 *  (including cloud metadata 169.254.169.254), CGNAT, multicast, reserved and documentation. */
const blocked = new BlockList()
for (const [net, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const) {
  blocked.addSubnet(net, prefix, 'ipv4')
}
for (const [net, prefix] of [
  ['::', 128],
  ['::1', 128],
  ['64:ff9b::', 96],
  ['100::', 64],
  ['2001:db8::', 32],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
] as const) {
  blocked.addSubnet(net, prefix, 'ipv6')
}

/** True when the IP is public. IPv4-mapped IPv6 (::ffff:a.b.c.d) is judged by its IPv4. */
export function isPublicAddress(ip: string) {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip)
  if (mapped) return isPublicAddress(mapped[1]!)
  // WHATWG URL normalizes ::ffff:10.0.0.1 to the hex form ::ffff:a00:1.
  const hex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(ip)
  if (hex) {
    const [hi, lo] = [parseInt(hex[1]!, 16), parseInt(hex[2]!, 16)]
    return isPublicAddress(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`)
  }
  const family = isIP(ip)
  if (family === 4) return !blocked.check(ip, 'ipv4')
  if (family === 6) return !blocked.check(ip, 'ipv6')
  return false
}

/** Syntactic checks on a monitor URL, before any network access. Returns a reason or null. */
export function urlProblem(raw: string): string | null {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return 'invalid_url'
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return 'unsupported_protocol'
  if (url.username || url.password) return 'credentials_in_url'
  return null
}
