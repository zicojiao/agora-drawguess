export const GAME_HEARTBEAT_ONLINE_MS = 12_000
export const GAME_DISCONNECT_GRACE_MS = 15_000
export const GAME_CHOICE_SECONDS = 20
export const GAME_RESULT_SECONDS = 5
export const GAME_PLAYER_SHORTAGE_SECONDS = 60

export type LifecyclePlayer = {
  id: string
  joinedAt: number
  lastSeenAt: number
  leftAt: number | null
}

export type GamePlayerPresence = 'online' | 'reconnecting' | 'left'

export function gamePlayerPresence(player: Pick<LifecyclePlayer, 'lastSeenAt' | 'leftAt'>, now = Date.now()): GamePlayerPresence {
  if (player.leftAt !== null) return 'left'
  return now - player.lastSeenAt < GAME_HEARTBEAT_ONLINE_MS ? 'online' : 'reconnecting'
}

export function isWithinReconnectGrace(player: Pick<LifecyclePlayer, 'lastSeenAt' | 'leftAt'>, now = Date.now()) {
  return player.leftAt === null && now - player.lastSeenAt < GAME_DISCONNECT_GRACE_MS
}

export function nextEligiblePlayerId(players: ReadonlyArray<LifecyclePlayer>, currentId: string | null, now = Date.now()) {
  const ordered = [...players].sort((left, right) => left.joinedAt - right.joinedAt)
  const eligible = new Set(ordered.filter((player) => isWithinReconnectGrace(player, now)).map((player) => player.id))
  if (eligible.size === 0) return null
  const start = Math.max(-1, ordered.findIndex((player) => player.id === currentId))
  for (let offset = 1; offset <= ordered.length; offset += 1) {
    const candidate = ordered[(start + offset) % ordered.length]
    if (eligible.has(candidate.id)) return candidate.id
  }
  return null
}

export function shouldTransferGameHost(host: Pick<LifecyclePlayer, 'lastSeenAt' | 'leftAt'> | undefined, now = Date.now()) {
  return !host || !isWithinReconnectGrace(host, now)
}

export function shortageDeadline(waitingSince: number | null | undefined) {
  return waitingSince === null || waitingSince === undefined ? null : waitingSince + GAME_PLAYER_SHORTAGE_SECONDS * 1000
}

export function shouldFinishForPlayerShortage(waitingSince: number | null | undefined, now = Date.now()) {
  const deadline = shortageDeadline(waitingSince)
  return deadline !== null && now >= deadline
}
