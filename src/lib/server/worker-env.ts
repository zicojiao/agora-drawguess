import { env } from 'cloudflare:workers'

type DrawGuessDatabase = Pick<D1Database, 'prepare' | 'batch'>

export type DrawGuessEnv = {
  DB: DrawGuessDatabase
  AGORA_APP_ID: string
  AGORA_APP_CERTIFICATE: string
  AGORA_WHITEBOARD_APP_IDENTIFIER?: string
  AGORA_WHITEBOARD_ACCESS_KEY?: string
  AGORA_WHITEBOARD_SECRET_KEY?: string
  AGORA_WHITEBOARD_SDK_TOKEN?: string
  AGORA_WHITEBOARD_REGION?: string
  OPENAI_API_KEY?: string
  AI_API_BASE_URL?: string
  OPENAI_VISION_MODEL?: string
}

export const workerEnv = env as unknown as DrawGuessEnv

type SessionCapableDatabase = DrawGuessDatabase & Partial<Pick<D1Database, 'withSession'>>

/**
 * Game requests need read-after-write consistency across Cloudflare's D1 replicas.
 * Starting every request on the primary also makes the rest of that request
 * sequentially consistent. The fallback keeps unit-test database doubles simple.
 */
export function withPrimaryD1Session(source: DrawGuessEnv): DrawGuessEnv {
  const database = source.DB as SessionCapableDatabase
  if (typeof database.withSession !== 'function') return source
  return { ...source, DB: database.withSession('first-primary') }
}
