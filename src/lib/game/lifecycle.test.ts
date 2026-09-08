import { describe, expect, it } from 'vitest'
import {
  GAME_DISCONNECT_GRACE_MS,
  GAME_HEARTBEAT_ONLINE_MS,
  GAME_PLAYER_SHORTAGE_SECONDS,
  gamePlayerPresence,
  isWithinReconnectGrace,
  nextEligiblePlayerId,
  shouldFinishForPlayerShortage,
  shouldTransferGameHost,
} from './lifecycle'

const player = (id: string, joinedAt: number, lastSeenAt: number, leftAt: number | null = null) => ({ id, joinedAt, lastSeenAt, leftAt })

describe('game room lifecycle', () => {
  it('separates online, reconnecting, and left presence', () => {
    const now = 100_000
    expect(gamePlayerPresence(player('a', 0, now - GAME_HEARTBEAT_ONLINE_MS + 1), now)).toBe('online')
    expect(gamePlayerPresence(player('a', 0, now - GAME_HEARTBEAT_ONLINE_MS), now)).toBe('reconnecting')
    expect(gamePlayerPresence(player('a', 0, now, now - 1), now)).toBe('left')
  })

  it('keeps a reconnecting player eligible only during the grace period', () => {
    const now = 100_000
    expect(isWithinReconnectGrace(player('a', 0, now - GAME_DISCONNECT_GRACE_MS + 1), now)).toBe(true)
    expect(isWithinReconnectGrace(player('a', 0, now - GAME_DISCONNECT_GRACE_MS), now)).toBe(false)
  })

  it('chooses the next joined eligible player and skips departed seats', () => {
    const now = 100_000
    const players = [player('host', 1, now), player('left', 2, now, now), player('next', 3, now)]
    expect(nextEligiblePlayerId(players, 'host', now)).toBe('next')
    expect(nextEligiblePlayerId(players, 'next', now)).toBe('host')
  })

  it('returns no successor when every seat has left or exceeded grace', () => {
    const now = 100_000
    const players = [
      player('left', 1, now, now),
      player('stale', 2, now - GAME_DISCONNECT_GRACE_MS),
    ]
    expect(nextEligiblePlayerId(players, 'left', now)).toBeNull()
  })

  it('transfers a missing host and finishes only after the shortage grace', () => {
    const now = 100_000
    expect(shouldTransferGameHost(undefined, now)).toBe(true)
    expect(shouldTransferGameHost(player('host', 0, now), now)).toBe(false)
    expect(shouldFinishForPlayerShortage(now - GAME_PLAYER_SHORTAGE_SECONDS * 1000 + 1, now)).toBe(false)
    expect(shouldFinishForPlayerShortage(now - GAME_PLAYER_SHORTAGE_SECONDS * 1000, now)).toBe(true)
  })
})
