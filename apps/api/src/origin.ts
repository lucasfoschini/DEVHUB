import type { NextFunction, Request, Response } from 'express'

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS'])

/** CSRF defence for cookie-authenticated routes: state-changing requests must come from the
 *  web origin. Browsers always send Origin on cross-site POST, PUT, PATCH and DELETE. */
export function requireSameOrigin(allowed: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (SAFE.has(req.method) || req.headers.origin === allowed) return next()
    res.status(403).json({ message: 'Origin not allowed' })
  }
}
