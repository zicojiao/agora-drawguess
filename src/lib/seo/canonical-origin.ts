import { CANONICAL_HOST_ALIASES, SITE_ORIGIN } from '../site-config'

export function getCanonicalRedirect(
  requestUrl: string,
  canonicalOrigin = SITE_ORIGIN,
  aliases: readonly string[] = CANONICAL_HOST_ALIASES,
) {
  const url = new URL(requestUrl)
  const canonical = new URL(canonicalOrigin)
  const isCanonicalHost = url.hostname === canonical.hostname

  if (!aliases.includes(url.hostname) && (!isCanonicalHost || url.protocol === canonical.protocol)) {
    return null
  }

  url.protocol = canonical.protocol
  url.hostname = canonical.hostname
  url.port = canonical.port
  return url.toString()
}
