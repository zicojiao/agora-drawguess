import { describe, expect, it } from 'vitest'
import { settleExpiredGameRound, type GameRoomRow } from './game-server'
import type { DrawGuessEnv } from './worker-env'

describe('expired game round settlement', () => {
  it('settles once and invalidates unfinished AI proof work', async () => {
    let roundSettled = false
    const batchedSql: string[] = []
    const db = {
      prepare(sql: string) {
        return {
          bind(..._args: unknown[]) {
            return {
              toString: () => sql,
              async run() {
                if (sql.includes('UPDATE game_rounds')) {
                  const changes = roundSettled ? 0 : 1
                  roundSettled = true
                  return { meta: { changes } }
                }
                return { meta: { changes: 1 } }
              },
            }
          },
        }
      },
      async batch(statements: Array<{ run?: () => unknown }>) {
        batchedSql.push(...statements.map((statement) => String(statement)))
        return []
      },
    }
    const env = { DB: db } as unknown as DrawGuessEnv
    const room = {
      id: 'a12345', host_player_id: 'host', phase: 'drawing', ai_enabled: 1, ai_phase: 'generating',
      rounds_total: 3, turn_seconds: 60, current_round: 1, active_round_id: 'round', whiteboard_uuid: null, expires_at: 9_999,
    } satisfies GameRoomRow

    const settled = await settleExpiredGameRound(env, room, 1_000)
    const repeated = await settleExpiredGameRound(env, room, 1_000)

    expect(settled.phase).toBe('result')
    expect(settled.ai_phase).toBe('failed')
    expect(repeated).toBe(room)
    expect(batchedSql.join('\n')).toContain('ai_proof_attempts')
  })
})
