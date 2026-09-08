import { createPartnerUrl, type PartnerPlacement } from '../lib/partner-links'

export function ReactorCredit({ compact = false, placement = 'home_header' }: { compact?: boolean; placement?: PartnerPlacement }) {
  return (
    <a
      className={`dg-reactor-credit${compact ? ' dg-reactor-credit--compact' : ''}`}
      href={createPartnerUrl('reactor', placement)}
      target="_blank"
      rel="noreferrer"
      aria-label="Powered by Reactor FastH3"
    >
      <span className="dg-reactor-credit__mark" aria-hidden="true">R</span>
      <span className="dg-reactor-credit__copy"><small>Powered by</small><strong>Reactor</strong></span>
      {!compact && <span className="dg-reactor-credit__product">FastH3</span>}
    </a>
  )
}
