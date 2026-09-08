const REACTOR_API_KEY_STORAGE_KEY = 'drawguess.reactor-api-key'

export type ReactorSession = { jwt: string; expiresAt: number }
export type ReactorSessionErrorCode = 'missing' | 'invalid' | 'credits' | 'network' | 'unavailable'

export class ReactorSessionError extends Error {
  constructor(public readonly code: ReactorSessionErrorCode, message: string) {
    super(message)
    this.name = 'ReactorSessionError'
  }
}

const CREDIT_WORDS = /credit|quota|billing|payment|balance|exhaust|limit reached|insufficient/i
const KEY_WORDS = /api[ _-]?key|unauthori[sz]ed|forbidden|credential|authentication/i

export function readReactorApiKey(storage: Pick<Storage, 'getItem'>) {
  return storage.getItem(REACTOR_API_KEY_STORAGE_KEY)?.trim() ?? ''
}

export function saveReactorApiKey(storage: Pick<Storage, 'setItem'>, apiKey: string) {
  storage.setItem(REACTOR_API_KEY_STORAGE_KEY, apiKey.trim())
}

export function reactorSessionErrorMessage(error: unknown) {
  if (error instanceof ReactorSessionError) {
    if (error.code === 'missing') return 'Enter a Reactor API key to use FastH3.'
    if (error.code === 'credits') return 'This Reactor API key has no available credits. Add credits or use a different key.'
    if (error.code === 'invalid') return 'Reactor rejected this API key. Check it or create a new key.'
    if (error.code === 'network') return 'Reactor could not be reached. Check your connection and try again.'
  }
  return 'FastH3 could not start with this key. Try another Reactor API key.'
}

export function reactorRuntimeCredentialError(message: string) {
  if (CREDIT_WORDS.test(message)) return 'This Reactor API key appears to be out of credits. Add credits or use a different key.'
  if (KEY_WORDS.test(message)) return 'Reactor no longer accepts this API key. Check it or create a new key.'
  if (/network|connect|failed to fetch|socket/i.test(message)) return 'FastH3 lost its Reactor connection. Verify the key and reconnect.'
  return null
}

export async function createReactorSession(apiKey: string, fetcher: typeof fetch = fetch): Promise<ReactorSession> {
  const normalizedKey = apiKey.trim()
  if (!normalizedKey) throw new ReactorSessionError('missing', 'A Reactor API key is required')

  let response: Response
  try {
    response = await fetcher('https://api.reactor.inc/tokens', {
      method: 'POST',
      headers: { 'Reactor-API-Key': normalizedKey, 'content-type': 'application/json' },
      body: JSON.stringify({
        expires_after: 15 * 60,
        authorization_details: [{
          type: 'session',
          resources: { models: { match: ['reactor/fast-h3'] } },
          constraints: { max_sessions: 1 },
        }],
      }),
      cache: 'no-store',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    })
  } catch {
    throw new ReactorSessionError('network', 'The Reactor token request could not connect')
  }

  const responseText = await response.text()
  if (!response.ok) {
    const code: ReactorSessionErrorCode = response.status === 402 || response.status === 429 || CREDIT_WORDS.test(responseText)
      ? 'credits'
      : response.status === 401 || response.status === 403 || KEY_WORDS.test(responseText)
        ? 'invalid'
        : 'unavailable'
    throw new ReactorSessionError(code, `Reactor token request failed (${response.status})`)
  }

  let result: { jwt?: unknown; expires_at?: unknown }
  try {
    result = JSON.parse(responseText) as typeof result
  } catch {
    throw new ReactorSessionError('unavailable', 'Reactor returned invalid credentials')
  }
  if (typeof result.jwt !== 'string' || typeof result.expires_at !== 'number') {
    throw new ReactorSessionError('unavailable', 'Reactor returned invalid credentials')
  }
  return { jwt: result.jwt, expiresAt: result.expires_at }
}
