const defaultOrigin = 'https://drawguess.app'

export const SITE_ORIGIN = (import.meta.env.VITE_PUBLIC_SITE_URL || defaultOrigin).replace(/\/$/, '')
export const SITE_HOSTNAME = new URL(SITE_ORIGIN).hostname

const deploymentAlias = import.meta.env.VITE_DEPLOYMENT_ALIAS_HOST?.trim()

export const CANONICAL_HOST_ALIASES = [
  `www.${SITE_HOSTNAME}`,
  ...(deploymentAlias ? [deploymentAlias] : []),
]

export function siteUrl(path = '/') {
  return new URL(path, `${SITE_ORIGIN}/`).toString()
}
