import { describe, expect, it } from 'vitest'
import { reconcileGameRoom, type GamePlayerRow, type GameRoomRow, type GameRoundRow } from './game-server'
import type { DrawGuessEnv } from './worker-env'

describe('authoritative game room reconciliation', () => {
  it('transfers a departed host and settles their drawing turn without a score', async () => {
    const now = 100_000
    const room: GameRoomRow = {
      id: 'room01',
      host_player_id: 'host',
      phase: 'drawing',
      ai_enabled: 1,
      ai_phase: 'generating',
      rounds_total: 3,
      turn_seconds: 60,
      current_round: 1,
      active_round_id: 'round01',
      whiteboard_uuid: null,
      expires_at: 999_999,
      waiting_for_players_since: null,
      host_epoch: 0,
    }
    const players: GamePlayerRow[] = [
      { id: 'host', room_id: room.id, nickname: 'Host', role: 'host', rtc_uid: '1', seat_token_hash: 'a', score: 0, ready: 1, connected: 0, joined_at: 1, last_seen_at: now, left_at: now },
      { id: 'next', room_id: room.id, nickname: 'Next', role: 'player', rtc_uid: '2', seat_token_hash: 'b', score: 0, ready: 1, connected: 1, joined_at: 2, last_seen_at: now, left_at: null },
      { id: 'third', room_id: room.id, nickname: 'Third', role: 'player', rtc_uid: '3', seat_token_hash: 'c', score: 0, ready: 1, connected: 1, joined_at: 3, last_seen_at: now, left_at: null },
    ]
    const round: GameRoundRow = {
      id: 'round01', room_id: room.id, number: 1, artist_id: 'host', phase: 'drawing', secret_word: 'cat', choices_json: '["cat"]', revealed_json: '[]',
      started_at: now - 1_000, ends_at: now + 59_000, winner_type: null, winner_id: null, end_reason: null, choose_ends_at: null, result_at: null,
    }
    const failedReasons: string[] = []

    class Statement {
      values: unknown[] = []
      constructor(readonly sql: string) {}
      bind(...values: unknown[]) { this.values = values; return this }
      async all<T>() { return { results: players.filter((player) => player.role !== 'ai') as T[] } }
      async first<T>() {
        if (this.sql.includes('FROM game_rooms')) return { ...room } as T
        if (this.sql.includes('FROM game_rounds')) return { ...round } as T
        return null
      }
      async run() {
        if (this.sql.includes("SET role = CASE")) {
          const successor = String(this.values[0])
          for (const player of players) player.role = player.id === successor ? 'host' : player.role === 'host' ? 'player' : player.role
        } else if (this.sql.includes('SET host_player_id = ?')) {
          room.host_player_id = String(this.values[0])
          room.host_epoch = (room.host_epoch ?? 0) + 1
          room.ai_phase = 'watching'
        } else if (this.sql.includes('UPDATE ai_proof_attempts')) {
          failedReasons.push(String(this.values[0]))
        } else if (this.sql.includes("end_reason = 'artist_left'")) {
          round.phase = 'result'
          round.end_reason = 'artist_left'
          round.result_at = Number(this.values[0])
        } else if (this.sql.includes("UPDATE game_rooms SET phase = 'result'")) {
          room.phase = 'result'
          room.ai_phase = 'failed'
        }
        return { meta: { changes: 1 } }
      }
    }

    const DB = {
      prepare: (sql: string) => new Statement(sql),
      batch: async (statements: Statement[]) => Promise.all(statements.map((statement) => statement.run())),
    }

    const reconciled = await reconcileGameRoom({ DB } as unknown as DrawGuessEnv, room, now)

    expect(reconciled.host_player_id).toBe('next')
    expect(reconciled.phase).toBe('result')
    expect(players.find((player) => player.id === 'next')?.role).toBe('host')
    expect(players.find((player) => player.id === 'host')?.role).toBe('player')
    expect(round.end_reason).toBe('artist_left')
    expect(round.winner_id).toBeNull()
    expect(failedReasons).toEqual(['host_transfer', 'artist_left'])
  })
})
