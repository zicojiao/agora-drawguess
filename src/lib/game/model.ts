const GAME_ROOM_ID = /^[a-z][a-z0-9]{5}$/
const GAME_SEAT_TOKEN = /^[a-f0-9]{64}$/
export const MIN_GAME_HUMANS = 2

type GamePhase = 'lobby' | 'choosing' | 'drawing' | 'result' | 'finished'
type PlayerRole = 'host' | 'player' | 'ai'
export type AiProofPhase = 'idle' | 'watching' | 'thinking' | 'guessed' | 'generating' | 'ready' | 'verifying' | 'verified' | 'rejected' | 'failed'
type GamePlayerPresence = 'online' | 'reconnecting' | 'left'

export type PublicGamePlayer = {
  id: string
  nickname: string
  role: PlayerRole
  score: number
  ready: boolean
  connected: boolean
  presence?: GamePlayerPresence
}

export type GameStartGate = 'needs-player' | 'needs-ai' | 'ready'

export function gameStartGate(players: ReadonlyArray<Pick<PublicGamePlayer, 'id' | 'role' | 'connected'>>, hostPlayerId: string, aiEnabled: boolean): GameStartGate {
  const hasConnectedGuest = players.some((player) => player.id !== hostPlayerId && player.role !== 'ai' && player.connected)
  if (!hasConnectedGuest) return 'needs-player'
  return aiEnabled ? 'ready' : 'needs-ai'
}

type PublicGameRound = {
  id: string
  number: number
  artistId: string
  phase: Exclude<GamePhase, 'lobby' | 'finished'>
  wordHint: string
  choices?: string[]
  secretWord?: string
  startedAt: number | null
  endsAt: number | null
  winnerType: 'human' | 'ai' | null
  winnerId: string | null
  endReason: 'correct_guess' | 'verified_proof' | 'timeout' | 'artist_left' | 'not_enough_players' | null
  chooseEndsAt?: number | null
}

export function isDrawingRoundExpired(round: { phase: string; endsAt: number | null }, now = Date.now()) {
  return round.phase === 'drawing' && round.endsAt !== null && round.endsAt <= now
}

export function roundWordForViewer(options: {
  phase: 'choosing' | 'drawing' | 'result'
  isArtist: boolean
  secretWord: string
  revealed: Set<number>
}) {
  if (options.phase === 'choosing') return options.isArtist ? 'CHOOSE A WORD' : 'CHOOSING…'
  if (options.phase === 'result' || options.isArtist) return Array.from(options.secretWord).join(' ')
  return wordHint(options.secretWord, options.revealed)
}

export type PublicGameRoom = {
  id: string
  phase: GamePhase
  hostPlayerId: string
  aiEnabled: boolean
  aiPhase: AiProofPhase
  roundsTotal: number
  turnSeconds: number
  waitingForPlayersUntil?: number | null
  players: PublicGamePlayer[]
  messages: Array<{
    id: string
    playerId: string | null
    source: 'human' | 'ai'
    content: string
    correctness: 'wrong' | 'close' | 'correct'
    createdAt: number
  }>
  aiActivity?: {
    attemptId: string
    guess: string
    reason: string
    confidence: number
    phase: 'generating' | 'verifying' | 'verified' | 'rejected' | 'failed'
    visionMs: number | null
    generationMs: number | null
    verificationMs: number | null
    startedAt: number
    updatedAt: number
  }
  round: PublicGameRound | null
  agora?: { appId: string; channelName: string; token: string; uid: string }
  whiteboard?: { appIdentifier: string; uuid: string; roomToken: string; uid: string; region: string; writable: boolean }
}

const ALIASES: Record<string, string> = {
  bike: 'bicycle',
  cellphone: 'phone',
  'cell phone': 'phone',
  television: 'tv',
  aeroplane: 'airplane',
}

export function isGameRoomId(value: unknown): value is string {
  return typeof value === 'string' && GAME_ROOM_ID.test(value)
}

export function isGameSeatToken(value: unknown): value is string {
  return typeof value === 'string' && GAME_SEAT_TOKEN.test(value)
}

export function normalizeGuess(value: string) {
  const normalized = value.normalize('NFKC').toLocaleLowerCase('en-US')
    .replace(/[\p{P}\p{S}]+/gu, ' ').trim().replace(/\s+/g, ' ')
  return ALIASES[normalized] ?? normalized
}

export function isCorrectGuess(guess: string, answer: string) {
  return normalizeGuess(guess) === normalizeGuess(answer)
}

export function isAiProofAccepted(guess: string, answer: string, videoMatches: boolean, confidence: number) {
  return isCorrectGuess(guess, answer) && videoMatches && confidence >= .65
}

export function editDistance(left: string, right: string) {
  const a = Array.from(normalizeGuess(left))
  const b = Array.from(normalizeGuess(right))
  const row = Array.from({ length: b.length + 1 }, (_, index) => index)
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = row[0]
    row[0] = i
    for (let j = 1; j <= b.length; j += 1) {
      const previous = row[j]
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1))
      diagonal = previous
    }
  }
  return row[b.length]
}

export function isCloseGuess(guess: string, answer: string) {
  const target = normalizeGuess(answer)
  if (!target || isCorrectGuess(guess, answer)) return false
  return editDistance(guess, answer) <= (target.length >= 8 ? 2 : 1)
}

export function wordHint(answer: string, revealed: ReadonlySet<number> = new Set()) {
  return Array.from(answer).map((character, index) => {
    if (/\s|-/.test(character)) return character
    return revealed.has(index) ? character.toLocaleUpperCase('en-US') : '_'
  }).join(' ')
}

export function progressiveHintIndexes(answer: string, startedAt: number | null, endsAt: number | null, now = Date.now()) {
  const visible = new Set<number>()
  if (startedAt === null || endsAt === null || endsAt <= startedAt) return visible
  const candidates = Array.from(answer)
    .map((character, index) => /[\p{L}\p{N}]/u.test(character) ? index : -1)
    .filter((index) => index >= 0)
  if (candidates.length < 2) return visible
  const progress = Math.max(0, Math.min(1, (now - startedAt) / (endsAt - startedAt)))
  if (progress >= .5) visible.add(candidates[Math.floor(candidates.length / 3)])
  if (progress >= .75 && candidates.length >= 4) visible.add(candidates[Math.floor(candidates.length * 2 / 3)])
  return visible
}

export function guesserScore(now: number, startedAt: number, endsAt: number, hintsShown: number) {
  const duration = Math.max(1, endsAt - startedAt)
  const remaining = Math.max(0, Math.min(1, (endsAt - now) / duration))
  return Math.max(100, Math.round(300 + remaining * 700 - hintsShown * 75))
}

export function artistAssistScore(winnerScore: number) {
  return Math.max(100, Math.round(Math.max(0, winnerScore) * .4))
}

export function canSettleWinner(currentWinner: string | null, now: number, endsAt: number) {
  return currentWinner === null && now <= endsAt
}

export function createGameRoomId(random = crypto.getRandomValues(new Uint8Array(6))) {
  const letters = 'abcdefghjkmnpqrstuvwxyz'
  const alphabet = `${letters}23456789`
  return letters[random[0] % letters.length] + Array.from(random.slice(1), (byte) => alphabet[byte % alphabet.length]).join('')
}

export function createGameToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function createPlayerId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(8)), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function gameChannelName(roomId: string) {
  if (!isGameRoomId(roomId)) throw new Error('Invalid game room ID')
  return `drawguess_${roomId}`
}
