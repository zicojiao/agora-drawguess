import { describe, expect, it } from 'vitest'
import { getCanonicalRedirect } from './canonical-origin'

describe('getCanonicalRedirect', () => {
  it('upgrades the canonical host to HTTPS while preserving the request', () => {
    expect(getCanonicalRedirect('http://drawguess.app/terms?from=footer')).toBe(
      'https://drawguess.app/terms?from=footer',
    )
  })

  it('redirects the www hostname to the canonical origin', () => {
    expect(getCanonicalRedirect('https://www.drawguess.app/privacy')).toBe(
      'https://drawguess.app/privacy',
    )
  })

  it('redirects the Workers hostname and preserves room links', () => {
    expect(getCanonicalRedirect(
      'https://draw-and-guess.convoai.workers.dev/room/abc123?invite=1',
      'https://drawguess.app',
      ['draw-and-guess.convoai.workers.dev'],
    )).toBe(
      'https://drawguess.app/room/abc123?invite=1',
    )
  })

  it('leaves the canonical HTTPS origin alone', () => {
    expect(getCanonicalRedirect('https://drawguess.app/')).toBeNull()
  })

  it('does not interfere with local development', () => {
    expect(getCanonicalRedirect('http://localhost:3000/room/abc123')).toBeNull()
  })
})
