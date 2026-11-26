import { lookup as dnsLookup, type LookupAddress } from 'node:dns'
import http from 'node:http'
import https from 'node:https'
import { isIP, type LookupFunction } from 'node:net'
import { isPublicAddress, urlProblem } from './ssrf.ts'

export interface ProbeResult {
  ok: boolean
  statusCode?: number
  latencyMs?: number
  error?: string
}

export interface ProbeOptions {
  timeoutMs: number
  /** Development and tests only (MONITOR_ALLOW_PRIVATE): skip the address check. */
  allowPrivate?: boolean
  /** JSON body: sends a POST (webhooks) instead of a GET, and never follows redirects. */
  body?: string
}

const MAX_REDIRECTS = 3

class BlockedAddress extends Error {}

/** DNS lookup that refuses non-public addresses. It runs inside the socket connect, so the
 *  address checked is the address used: no window for DNS rebinding. */
function guardedLookup(allowPrivate: boolean): LookupFunction {
  return (hostname, options, callback) => {
    dnsLookup(hostname, { ...options, all: true }, (err, addresses) => {
      if (err) return callback(err, '', 0)
      const list = addresses as LookupAddress[]
      const bad = list.find((a) => !allowPrivate && !isPublicAddress(a.address))
      if (bad || list.length === 0) {
        return callback(new BlockedAddress(bad?.address ?? 'none'), '', 0)
      }
      if (options.all)
        return (callback as unknown as (e: null, a: LookupAddress[]) => void)(null, list)
      callback(null, list[0]!.address, list[0]!.family)
    })
  }
}

function once(url: URL, opts: ProbeOptions, signal: AbortSignal) {
  // Node skips `lookup` for IP-literal hosts, so those are checked here.
  const literal = url.hostname.replace(/^\[|\]$/g, '')
  if (isIP(literal) && !opts.allowPrivate && !isPublicAddress(literal)) {
    return Promise.reject(new BlockedAddress(literal))
  }
  return new Promise<{ status: number; location?: string }>((resolve, reject) => {
    const client = url.protocol === 'https:' ? https : http
    const req = client.request(
      url,
      {
        method: opts.body === undefined ? 'GET' : 'POST',
        signal,
        lookup: guardedLookup(opts.allowPrivate ?? false),
        headers: {
          'user-agent': 'DevHub-Monitor/1',
          accept: '*/*',
          ...(opts.body === undefined ? {} : { 'content-type': 'application/json' }),
        },
      },
      (res) => {
        // Only the status line matters; never read the body (size and time stay bounded).
        resolve({ status: res.statusCode ?? 0, location: res.headers.location })
        res.destroy()
      },
    )
    req.on('error', reject)
    req.end(opts.body)
  })
}

function classify(e: unknown) {
  if (e instanceof BlockedAddress) return 'blocked_address'
  const err = e as { name?: string; code?: string }
  if (err.name === 'AbortError' || err.name === 'TimeoutError') return 'timeout'
  if (err.code === 'ENOTFOUND' || err.code === 'EAI_AGAIN') return 'dns'
  if (err.code === 'ECONNREFUSED') return 'connection_refused'
  if (err.code === 'ECONNRESET') return 'connection_reset'
  if (typeof err.code === 'string' && err.code.startsWith('ERR_TLS')) return 'tls'
  if (typeof err.code === 'string' && /CERT|SSL/.test(err.code)) return 'tls'
  return 'network'
}

/** One health check: GET, follow up to 3 redirects (each hop re-checked), 2xx/3xx is up. */
export async function probe(rawUrl: string, opts: ProbeOptions): Promise<ProbeResult> {
  const problem = urlProblem(rawUrl)
  if (problem) return { ok: false, error: problem }
  const signal = AbortSignal.timeout(opts.timeoutMs)
  const start = performance.now()
  let url = new URL(rawUrl)
  try {
    for (let hop = 0; ; hop++) {
      const res = await once(url, opts, signal)
      const isRedirect = res.status >= 300 && res.status < 400 && res.location
      if (isRedirect && hop < MAX_REDIRECTS && opts.body === undefined) {
        url = new URL(res.location!, url)
        const bad = urlProblem(url.href)
        if (bad) return { ok: false, statusCode: res.status, error: bad }
        continue
      }
      const latencyMs = Math.round(performance.now() - start)
      const ok = res.status >= 200 && res.status < 400
      return { ok, statusCode: res.status, latencyMs, error: ok ? undefined : 'http_status' }
    }
  } catch (e) {
    return { ok: false, error: classify(e) }
  }
}
