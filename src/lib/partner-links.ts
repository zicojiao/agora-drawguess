import { SITE_HOSTNAME } from './site-config'

export type Partner = 'agora' | 'reactor'
export type PartnerPlacement = 'home_header' | 'game_header'

const partnerBaseUrls: Record<Partner, string> = {
  agora: 'https://www.agora.io/',
  reactor: 'https://www.reactor.inc/',
}

export function createPartnerUrl(partner: Partner, placement: PartnerPlacement) {
  void placement
  const url = new URL(partnerBaseUrls[partner])
  url.searchParams.set('utm_source', SITE_HOSTNAME)
  return url.toString()
}
