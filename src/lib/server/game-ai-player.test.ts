import { describe, expect, it, vi } from 'vitest'
import { ensureAiPlayer } from './game-server'
import type { DrawGuessEnv } from './worker-env'

describe('FastH3 room seat', () => {
  it('uses an idempotent insert before enabling the AI', async () => {
    const statements: Array<{ sql: string; values: unknown[] }> = []
    const batch = vi.fn().mockResolvedValue([])
    const DB = {
      prepare(sql: string) {
        return {
          bind(...values: unknown[]) {
            const statement = { sql, values }
            statements.push(statement)
            return statement
          },
        }
      },
      batch,
    }

    await ensureAiPlayer({ DB } as unknown as DrawGuessEnv, { id: 'room123' }, 1234)

    expect(batch).toHaveBeenCalledOnce()
    expect(statements[0].sql).toContain('INSERT OR IGNORE INTO game_players')
    expect(statements[0].values[1]).toBe('room123')
    expect(statements[0].values[2]).toBe('FastH3')
    expect(statements[1].sql).toContain("ai_enabled = 1")
    expect(statements[1].values).toEqual(['room123'])
  })
})
