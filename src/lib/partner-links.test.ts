import { describe, expect, it } from 'vitest'
import { createPartnerUrl } from './partner-links'

describe('partner links', () => {
  it('identifies homepage Agora referrals', () => {
    const url = new URL(createPartnerUrl('agora', 'home_header'))

    expect(url.origin).toBe('https://www.agora.io')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      utm_source: 'drawguess.app',
    })
  })

  it('identifies in-game Reactor referrals', () => {
    const url = new URL(createPartnerUrl('reactor', 'game_header'))

    expect(url.origin).toBe('https://www.reactor.inc')
    expect(url.searchParams.get('utm_source')).toBe('drawguess.app')
  })
})
