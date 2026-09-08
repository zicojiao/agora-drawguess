import { createCsrfMiddleware, createMiddleware, createStart } from '@tanstack/react-start'
import { setResponseHeaders } from '@tanstack/react-start/server'
import { getCanonicalRedirect } from '#/lib/seo/canonical-origin'

const responseSecurityHeaders = {
  'Permissions-Policy': 'camera=(), geolocation=(), microphone=(self), payment=(), usb=()',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'X-Permitted-Cross-Domain-Policies': 'none',
} as const

const securityHeaders = createMiddleware().server(({ next }) => {
  // fetchdts omits several standard security headers from its name union, but
  // TanStack accepts the same plain string map at runtime.
  setResponseHeaders(responseSecurityHeaders as unknown as Parameters<typeof setResponseHeaders>[0])
  return next()
})

const seoRouting = createMiddleware().server(({ request, next }) => {
  const canonicalRedirect = getCanonicalRedirect(request.url)
  if (canonicalRedirect) return Response.redirect(canonicalRedirect, 308)

  if (new URL(request.url).pathname.startsWith('/room/')) {
    setResponseHeaders({
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
    } as unknown as Parameters<typeof setResponseHeaders>[0])
  }

  return next()
})

const csrfMiddleware = createCsrfMiddleware({
  filter: (context) => context.handlerType === 'serverFn',
})

export const startInstance = createStart(() => ({
  requestMiddleware: [seoRouting, csrfMiddleware, securityHeaders],
}))
