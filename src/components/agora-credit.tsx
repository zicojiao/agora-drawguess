import { createPartnerUrl, type PartnerPlacement } from '../lib/partner-links'

export function AgoraCredit({ compact = false, placement = 'home_header' }: { compact?: boolean; placement?: PartnerPlacement }) {
  return (
    <a
      className={`dg-agora-credit${compact ? ' dg-agora-credit--compact' : ''}`}
      href={createPartnerUrl('agora', placement)}
      target="_blank"
      rel="noreferrer"
      aria-label="Powered by Agora RTC and Interactive Whiteboard"
    >
      <span className="dg-agora-credit__mark" aria-hidden="true">A</span>
      <span className="dg-agora-credit__copy"><small>Powered by</small><strong>Agora RTC</strong></span>
      {!compact && <span className="dg-agora-credit__product">+ Whiteboard</span>}
    </a>
  )
}
