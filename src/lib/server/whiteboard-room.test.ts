import { afterEach, describe, expect, it, vi } from 'vitest'
import { canWriteWhiteboard, ensureWhiteboardRoom, type GameRoomRow } from './game-server'
import type { DrawGuessEnv } from './worker-env'

afterEach(() => vi.unstubAllGlobals())

describe('Agora Whiteboard room assignment', () => {
  it('gives the artist writer credentials while choosing so the board can connect early', () => {
    expect(canWriteWhiteboard(true, 'choosing')).toBe(true)
    expect(canWriteWhiteboard(true, 'drawing')).toBe(true)
    expect(canWriteWhiteboard(true, 'result')).toBe(false)
    expect(canWriteWhiteboard(false, 'choosing')).toBe(false)
  })

  it('returns the canonical database UUID when concurrent creation loses the race', async () => {
    const first = vi.fn().mockResolvedValue({ whiteboard_uuid: 'canonical-room' })
    const run = vi.fn().mockResolvedValue({ meta: { changes: 0 } })
    const prepare = vi.fn((sql: string) => ({
      bind: vi.fn(() => sql.startsWith('SELECT') ? { first } : { run }),
    }))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ uuid: 'orphaned-race-room' }), { status: 200 })))

    const env = {
      DB: { prepare },
      AGORA_WHITEBOARD_APP_IDENTIFIER: 'app-id',
      AGORA_WHITEBOARD_ACCESS_KEY: 'access-key',
      AGORA_WHITEBOARD_SECRET_KEY: 'secret-key',
      AGORA_WHITEBOARD_REGION: 'us-sv',
    } as unknown as DrawGuessEnv
    const room = { id: 'abcdef', whiteboard_uuid: null } as GameRoomRow

    await expect(ensureWhiteboardRoom(env, room)).resolves.toBe('canonical-room')
    expect(run).toHaveBeenCalledOnce()
    expect(first).toHaveBeenCalledOnce()
  })
})
