import { workerEnv } from './worker-env'

export type RateLimitRule = {
  windowMs: number
  max: number
}

/**
 * Anonymous profile cookies are client-controlled, so a profile bucket alone is
 * trivially reset by dropping the cookie. Every check is therefore evaluated
 * against the coarse network identity as well, and the strictest bucket wins.
 */
export function rateLimitBuckets(request: Request, profileId: string | null, action: string) {
  const address = request.headers.get('cf-connecting-ip')
    || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || null
  const buckets = [`${action}:ip:${address ?? 'unknown'}`]
  if (profileId) buckets.push(`${action}:profile:${profileId}`)
  return buckets
}

/**
 * Returns the number of seconds a caller should wait, or 0 when the request is
 * within budget. Recording a hit is deliberately separate so a rejected request
 * does not extend its own cooldown.
 */
export async function checkRateLimit(buckets: string[], rule: RateLimitRule, now = Date.now()) {
  if (buckets.length === 0) return 0
  const cutoff = now - rule.windowMs
  const placeholders = buckets.map(() => '?').join(', ')
  const rows = await workerEnv.DB.prepare(
    `SELECT bucket, COUNT(*) AS hits, MIN(created_at) AS oldest
     FROM rate_hits
     WHERE created_at >= ? AND bucket IN (${placeholders})
     GROUP BY bucket`,
  ).bind(cutoff, ...buckets).all<{ bucket: string; hits: number; oldest: number }>()

  let retryAfterSeconds = 0
  for (const row of rows.results ?? []) {
    if (row.hits < rule.max) continue
    const waitMs = Math.max(1_000, row.oldest + rule.windowMs - now)
    retryAfterSeconds = Math.max(retryAfterSeconds, Math.ceil(waitMs / 1_000))
  }
  return retryAfterSeconds
}

export async function recordRateLimitHit(buckets: string[], now = Date.now()) {
  if (buckets.length === 0) return
  const values = buckets.map(() => '(?, ?)').join(', ')
  const bindings = buckets.flatMap((bucket) => [bucket, now])
  await workerEnv.DB.prepare(
    `INSERT INTO rate_hits (bucket, created_at) VALUES ${values}`,
  ).bind(...bindings).run()
}

export function rateLimitResponse(retryAfterSeconds: number, message: string) {
  return new Response(JSON.stringify({ error: message, retryAfterSeconds }), {
    status: 429,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'retry-after': String(retryAfterSeconds),
    },
  })
}
