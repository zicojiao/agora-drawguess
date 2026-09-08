import { describe, expect, it, vi } from 'vitest'
import {
  createReactorSession,
  ReactorSessionError,
  reactorRuntimeCredentialError,
  reactorSessionErrorMessage,
} from './reactor-session'

describe('browser-owned Reactor sessions', () => {
  it('mints a short-lived FastH3 token without putting the API key in the request body', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ jwt: 'short-lived-jwt', expires_at: 12345 }), { status: 200 }))

    await expect(createReactorSession('  rk_local  ', fetcher)).resolves.toEqual({ jwt: 'short-lived-jwt', expiresAt: 12345 })
    const [url, init] = fetcher.mock.calls[0] as [string, RequestInit]
    const headers = new Headers(init.headers)
    const body = JSON.parse(String(init.body))
    expect(url).toBe('https://api.reactor.inc/tokens')
    expect(headers.get('Reactor-API-Key')).toBe('rk_local')
    expect(String(init.body)).not.toContain('rk_local')
    expect(init.credentials).toBe('omit')
    expect(body.expires_after).toBe(900)
    expect(body.authorization_details[0].resources.models.match).toEqual(['reactor/fast-h3'])
    expect(body.authorization_details[0].constraints.max_sessions).toBe(1)
  })

  it('explains an exhausted Reactor balance without exposing provider details', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('insufficient credits', { status: 402 }))
    const error = await createReactorSession('rk_empty', fetcher).catch((caught) => caught)
    expect(error).toBeInstanceOf(ReactorSessionError)
    expect((error as ReactorSessionError).code).toBe('credits')
    expect(reactorSessionErrorMessage(error)).toContain('no available credits')
  })

  it('recognizes credit and credential failures reported during a live session', () => {
    expect(reactorRuntimeCredentialError('insufficient account balance')).toContain('out of credits')
    expect(reactorRuntimeCredentialError('API key is unauthorized')).toContain('no longer accepts')
    expect(reactorRuntimeCredentialError('one clip failed')).toBeNull()
  })
})
