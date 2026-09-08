import { RtcRole, RtcTokenBuilder } from 'agora-token'
import { roomToken, sdkToken, TokenRole } from 'netless-token'
import {
  createGameRoomId,
  createGameToken,
  createPlayerId,
  gameChannelName,
  isCorrectGuess,
  isGameRoomId,
  isGameSeatToken,
  progressiveHintIndexes,
  roundWordForViewer,
  type AiProofPhase,
  type PublicGameRoom,
} from '../game/model'
import {
  GAME_CHOICE_SECONDS,
  GAME_DISCONNECT_GRACE_MS,
  GAME_RESULT_SECONDS,
  gamePlayerPresence,
  isWithinReconnectGrace,
  nextEligiblePlayerId,
  shortageDeadline,
  shouldFinishForPlayerShortage,
  shouldTransferGameHost,
  type LifecyclePlayer,
} from '../game/lifecycle'
import type { DrawGuessEnv } from './worker-env'

const GAME_ROOM_LIFETIME_MS = 4 * 60 * 60_000
const GAME_AI_NAME = 'FastH3'
const GAME_WORDS = [
  'airplane', 'apple', 'bicycle', 'birthday cake', 'camera', 'cat', 'coffee', 'dinosaur',
  'dog', 'elephant', 'firetruck', 'guitar', 'hamburger', 'ice cream', 'lighthouse', 'moon',
  'octopus', 'pizza', 'rainbow', 'robot', 'rocket', 'sailboat', 'snowman', 'sunflower',
  'telephone', 'train', 'tree house', 'umbrella', 'volcano', 'watermelon',
]

export type GameRoomRow = {
  id: string
  host_player_id: string
  phase: PublicGameRoom['phase']
  ai_enabled: number
  ai_phase: AiProofPhase
  rounds_total: number
  turn_seconds: number
  current_round: number
  active_round_id: string | null
  whiteboard_uuid: string | null
  expires_at: number
  waiting_for_players_since?: number | null
  host_epoch?: number
}

export type GamePlayerRow = {
  id: string
  room_id: string
  nickname: string
  role: 'host' | 'player' | 'ai'
  rtc_uid: string
  seat_token_hash: string
  score: number
  ready: number
  connected: number
  joined_at: number
  last_seen_at: number
  left_at?: number | null
}

export type GameRoundRow = {
  id: string
  room_id: string
  number: number
  artist_id: string
  phase: 'choosing' | 'drawing' | 'result'
  secret_word: string
  choices_json: string
  revealed_json: string
  started_at: number | null
  ends_at: number | null
  winner_type: 'human' | 'ai' | null
  winner_id: string | null
  end_reason: 'correct_guess' | 'verified_proof' | 'timeout' | 'artist_left' | 'not_enough_players' | null
  choose_ends_at?: number | null
  result_at?: number | null
}

type AiAttemptRow = {
  id: string
  guess: string
  reason: string
  confidence: number
  phase: NonNullable<PublicGameRoom['aiActivity']>['phase']
  vision_ms: number | null
  generation_ms: number | null
  verification_ms: number | null
  created_at: number
  updated_at: number
}

export async function settleExpiredGameRound(env: DrawGuessEnv, room: GameRoomRow, now = Date.now()) {
  if (room.phase !== 'drawing' || !room.active_round_id) return room
  const settled = await env.DB.prepare(`UPDATE game_rounds
    SET phase = 'result', end_reason = 'timeout', result_at = ?
    WHERE id = ? AND phase = 'drawing' AND winner_id IS NULL AND ends_at IS NOT NULL AND ends_at <= ?`)
    .bind(now, room.active_round_id, now).run()
  if (settled.meta.changes !== 1) return room
  await env.DB.batch([
    env.DB.prepare(`UPDATE game_rooms SET phase = 'result', ai_phase = CASE WHEN ai_enabled = 1 THEN 'failed' ELSE 'idle' END WHERE id = ?`).bind(room.id),
    env.DB.prepare(`UPDATE ai_proof_attempts SET phase = 'failed', failure_code = 'round_timeout', updated_at = ?
      WHERE round_id = ? AND phase IN ('generating', 'ready', 'verifying')`).bind(now, room.active_round_id),
  ])
  return { ...room, phase: 'result' as const, ai_phase: (room.ai_enabled ? 'failed' : 'idle') as AiProofPhase }
}

function lifecyclePlayer(player: GamePlayerRow): LifecyclePlayer {
  return {
    id: player.id,
    joinedAt: player.joined_at,
    lastSeenAt: player.last_seen_at,
    leftAt: player.left_at ?? null,
  }
}

function eligibleGameHumans(players: GamePlayerRow[], now: number) {
  return players.filter((player) => isWithinReconnectGrace(lifecyclePlayer(player), now))
}

async function readGameHumans(env: DrawGuessEnv, roomId: string) {
  const result = await env.DB.prepare(`SELECT * FROM game_players WHERE room_id = ? AND role != 'ai' ORDER BY joined_at`)
    .bind(roomId).all<GamePlayerRow>()
  return result.results ?? []
}

async function failActiveAiWork(env: DrawGuessEnv, room: GameRoomRow, reason: string, now: number) {
  if (!room.active_round_id) return
  await env.DB.prepare(`UPDATE ai_proof_attempts SET phase = 'failed', failure_code = ?, updated_at = ?
    WHERE round_id = ? AND phase IN ('generating', 'ready', 'verifying')`)
    .bind(reason, now, room.active_round_id).run()
}

export async function advanceGameRoom(env: DrawGuessEnv, room: GameRoomRow, now = Date.now()) {
  if (room.phase !== 'result' || !room.active_round_id) return room
  if (room.current_round >= room.rounds_total) {
    await env.DB.prepare(`UPDATE game_rooms SET phase = 'finished', active_round_id = NULL, waiting_for_players_since = NULL
      WHERE id = ? AND phase = 'result' AND active_round_id = ?`).bind(room.id, room.active_round_id).run()
    return (await readGameRoom(env, room.id)) ?? room
  }

  const humans = await readGameHumans(env, room.id)
  const eligible = eligibleGameHumans(humans, now)
  if (eligible.length < 2) return room
  const previousRound = await env.DB.prepare('SELECT artist_id FROM game_rounds WHERE id = ?')
    .bind(room.active_round_id).first<{ artist_id: string }>()
  const artistId = nextEligiblePlayerId(humans.map(lifecyclePlayer), previousRound?.artist_id ?? null, now)
  if (!artistId) return room
  const choices = pickWords()
  const roundId = crypto.randomUUID().replaceAll('-', '')
  const number = room.current_round + 1
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO game_rounds
      (id, room_id, number, artist_id, phase, secret_word, choices_json, choose_ends_at, created_at)
      SELECT ?, id, ?, ?, 'choosing', ?, ?, ?, ? FROM game_rooms
      WHERE id = ? AND phase = 'result' AND active_round_id = ?`)
      .bind(roundId, number, artistId, choices[0], JSON.stringify(choices), now + GAME_CHOICE_SECONDS * 1000, now, room.id, room.active_round_id),
    env.DB.prepare(`UPDATE game_rooms SET phase = 'choosing', current_round = ?, active_round_id = ?, waiting_for_players_since = NULL,
      ai_phase = CASE ai_enabled WHEN 1 THEN 'watching' ELSE 'idle' END
      WHERE id = ? AND phase = 'result' AND active_round_id = ?`)
      .bind(number, roundId, room.id, room.active_round_id),
  ])
  return (await readGameRoom(env, room.id)) ?? room
}

export async function reconcileGameRoom(env: DrawGuessEnv, room: GameRoomRow, now = Date.now()) {
  await env.DB.prepare(`UPDATE game_players SET connected = 0, left_at = COALESCE(left_at, ?)
    WHERE room_id = ? AND role != 'ai' AND left_at IS NULL AND last_seen_at <= ?`)
    .bind(now, room.id, now - GAME_DISCONNECT_GRACE_MS).run()

  let humans = await readGameHumans(env, room.id)
  let eligible = eligibleGameHumans(humans, now)
  const host = humans.find((player) => player.id === room.host_player_id)
  if (shouldTransferGameHost(host ? lifecyclePlayer(host) : undefined, now) && eligible.length > 0) {
    const successorId = nextEligiblePlayerId(humans.map(lifecyclePlayer), room.host_player_id, now) ?? eligible[0].id
    if (successorId !== room.host_player_id) {
      await env.DB.batch([
        env.DB.prepare(`UPDATE game_players SET role = CASE WHEN id = ? THEN 'host' WHEN role = 'host' THEN 'player' ELSE role END
          WHERE room_id = ? AND role != 'ai'`).bind(successorId, room.id),
        env.DB.prepare(`UPDATE game_rooms SET host_player_id = ?, host_epoch = host_epoch + 1,
          ai_phase = CASE ai_enabled WHEN 1 THEN 'watching' ELSE 'idle' END WHERE id = ? AND host_player_id = ?`)
          .bind(successorId, room.id, room.host_player_id),
      ])
      await failActiveAiWork(env, room, 'host_transfer', now)
      room = (await readGameRoom(env, room.id)) ?? { ...room, host_player_id: successorId }
      humans = await readGameHumans(env, room.id)
      eligible = eligibleGameHumans(humans, now)
    }
  }

  if (room.phase === 'lobby' || room.phase === 'finished') {
    if (room.waiting_for_players_since) {
      await env.DB.prepare('UPDATE game_rooms SET waiting_for_players_since = NULL WHERE id = ?').bind(room.id).run()
      room = (await readGameRoom(env, room.id)) ?? room
    }
    return room
  }

  if (eligible.length < 2) {
    if (!room.waiting_for_players_since) {
      await env.DB.prepare('UPDATE game_rooms SET waiting_for_players_since = ? WHERE id = ? AND waiting_for_players_since IS NULL')
        .bind(now, room.id).run()
      room = (await readGameRoom(env, room.id)) ?? { ...room, waiting_for_players_since: now }
    } else if (shouldFinishForPlayerShortage(room.waiting_for_players_since, now)) {
      if (room.active_round_id) {
        await env.DB.prepare(`UPDATE game_rounds SET phase = 'result', end_reason = 'not_enough_players', result_at = ?
          WHERE id = ? AND phase != 'result'`).bind(now, room.active_round_id).run()
      }
      await failActiveAiWork(env, room, 'not_enough_players', now)
      await env.DB.prepare(`UPDATE game_rooms SET phase = 'finished', active_round_id = NULL, waiting_for_players_since = NULL,
        ai_phase = CASE ai_enabled WHEN 1 THEN 'failed' ELSE 'idle' END WHERE id = ?`).bind(room.id).run()
      room = (await readGameRoom(env, room.id)) ?? { ...room, phase: 'finished', active_round_id: null }
    }
    return room
  }

  if (room.waiting_for_players_since) {
    const pausedFor = Math.max(0, now - room.waiting_for_players_since)
    if (room.active_round_id && pausedFor > 0) {
      await env.DB.prepare(`UPDATE game_rounds SET
        started_at = CASE WHEN started_at IS NULL THEN NULL ELSE started_at + ? END,
        ends_at = CASE WHEN ends_at IS NULL THEN NULL ELSE ends_at + ? END,
        choose_ends_at = CASE WHEN choose_ends_at IS NULL THEN NULL ELSE choose_ends_at + ? END
        WHERE id = ?`).bind(pausedFor, pausedFor, pausedFor, room.active_round_id).run()
    }
    await env.DB.prepare('UPDATE game_rooms SET waiting_for_players_since = NULL WHERE id = ?').bind(room.id).run()
    room = (await readGameRoom(env, room.id)) ?? { ...room, waiting_for_players_since: null }
  }

  if (!room.active_round_id) return room
  const round = await env.DB.prepare('SELECT * FROM game_rounds WHERE id = ?').bind(room.active_round_id).first<GameRoundRow>()
  if (!round) return room
  const artistEligible = eligible.some((player) => player.id === round.artist_id)

  if (room.phase === 'choosing' && (!artistEligible || (round.choose_ends_at !== null && round.choose_ends_at !== undefined && now >= round.choose_ends_at))) {
    const artistId = nextEligiblePlayerId(humans.map(lifecyclePlayer), round.artist_id, now)
    if (artistId) {
      const choices = pickWords()
      await env.DB.prepare(`UPDATE game_rounds SET artist_id = ?, secret_word = ?, choices_json = ?, choose_ends_at = ?
        WHERE id = ? AND phase = 'choosing'`).bind(artistId, choices[0], JSON.stringify(choices), now + GAME_CHOICE_SECONDS * 1000, round.id).run()
    }
    return (await readGameRoom(env, room.id)) ?? room
  }

  if (room.phase === 'drawing' && !artistEligible) {
    await env.DB.batch([
      env.DB.prepare(`UPDATE game_rounds SET phase = 'result', end_reason = 'artist_left', result_at = ?
        WHERE id = ? AND phase = 'drawing' AND winner_id IS NULL`).bind(now, round.id),
      env.DB.prepare(`UPDATE game_rooms SET phase = 'result', ai_phase = CASE ai_enabled WHEN 1 THEN 'failed' ELSE 'idle' END
        WHERE id = ? AND phase = 'drawing' AND active_round_id = ?`).bind(room.id, round.id),
    ])
    await failActiveAiWork(env, room, 'artist_left', now)
    return (await readGameRoom(env, room.id)) ?? { ...room, phase: 'result' }
  }

  if (room.phase === 'drawing') room = await settleExpiredGameRound(env, room, now)
  if (room.phase === 'result') {
    const current = await env.DB.prepare('SELECT result_at FROM game_rounds WHERE id = ?').bind(room.active_round_id).first<{ result_at: number | null }>()
    if (current?.result_at && now >= current.result_at + GAME_RESULT_SECONDS * 1000) room = await advanceGameRoom(env, room, now)
  }
  return room
}

export function cleanNickname(value: unknown) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, 24) : ''
}

export async function hashSeatToken(token: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function makeRtcUid() {
  const bytes = crypto.getRandomValues(new Uint8Array(4))
  const value = new DataView(bytes.buffer).getUint32(0) & 0x7fffffff
  return String(Math.max(1, value))
}

export function pickWords(count = 3) {
  const pool = [...GAME_WORDS]
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const target = crypto.getRandomValues(new Uint32Array(1))[0] % (index + 1)
    ;[pool[index], pool[target]] = [pool[target], pool[index]]
  }
  return pool.slice(0, count)
}

export async function readGameRoom(env: DrawGuessEnv, roomId: string) {
  if (!isGameRoomId(roomId)) return null
  return env.DB.prepare('SELECT * FROM game_rooms WHERE id = ?').bind(roomId).first<GameRoomRow>()
}

export async function readGamePlayer(env: DrawGuessEnv, roomId: string, seatToken: unknown) {
  if (!isGameSeatToken(seatToken)) return null
  const hash = await hashSeatToken(seatToken)
  return env.DB.prepare('SELECT * FROM game_players WHERE room_id = ? AND seat_token_hash = ?')
    .bind(roomId, hash).first<GamePlayerRow>()
}

export async function ensureAiPlayer(env: DrawGuessEnv, room: Pick<GameRoomRow, 'id'>, now = Date.now()) {
  const aiId = createPlayerId()
  const aiSeatHash = await hashSeatToken(crypto.randomUUID().replaceAll('-', '').padEnd(64, '0'))
  await env.DB.batch([
    env.DB.prepare(`INSERT OR IGNORE INTO game_players
      (id, room_id, nickname, role, rtc_uid, seat_token_hash, ready, connected, joined_at, last_seen_at)
      SELECT ?, ?, ?, 'ai', ?, ?, 1, 1, ?, ?
      WHERE NOT EXISTS (SELECT 1 FROM game_players WHERE room_id = ? AND role = 'ai')`)
      .bind(aiId, room.id, GAME_AI_NAME, makeRtcUid(), aiSeatHash, now, now, room.id),
    env.DB.prepare(`UPDATE game_rooms SET ai_enabled = 1, ai_phase = 'watching' WHERE id = ?`).bind(room.id),
  ])
}

function issueGameAgoraSession(env: DrawGuessEnv, room: GameRoomRow, player: GamePlayerRow) {
  if (!env.AGORA_APP_ID || !env.AGORA_APP_CERTIFICATE) return undefined
  const ttl = 60 * 60
  return {
    appId: env.AGORA_APP_ID,
    channelName: gameChannelName(room.id),
    uid: player.rtc_uid,
    token: RtcTokenBuilder.buildTokenWithRtm(
      env.AGORA_APP_ID,
      env.AGORA_APP_CERTIFICATE,
      gameChannelName(room.id),
      player.rtc_uid,
      RtcRole.PUBLISHER,
      ttl,
      ttl,
    ),
  }
}

export function canWriteWhiteboard(isArtist: boolean, phase: GameRoundRow['phase'] | null | undefined) {
  return isArtist && (phase === 'choosing' || phase === 'drawing')
}

async function whiteboardRequest(env: DrawGuessEnv, path: string, body: unknown) {
  const token = env.AGORA_WHITEBOARD_ACCESS_KEY && env.AGORA_WHITEBOARD_SECRET_KEY
    ? sdkToken(env.AGORA_WHITEBOARD_ACCESS_KEY, env.AGORA_WHITEBOARD_SECRET_KEY, 10 * 60 * 1000, { role: TokenRole.Admin })
    : env.AGORA_WHITEBOARD_SDK_TOKEN
  if (!token) return null
  const response = await fetch(`https://api.netless.link/v5${path}`, {
    method: 'POST',
    headers: {
      token,
      region: env.AGORA_WHITEBOARD_REGION || 'us-sv',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error(`Whiteboard request failed (${response.status})`)
  return response.json() as Promise<Record<string, unknown>>
}

export async function ensureWhiteboardRoom(env: DrawGuessEnv, room: GameRoomRow) {
  if (room.whiteboard_uuid) return room.whiteboard_uuid
  if (!env.AGORA_WHITEBOARD_APP_IDENTIFIER || (!env.AGORA_WHITEBOARD_SDK_TOKEN && !(env.AGORA_WHITEBOARD_ACCESS_KEY && env.AGORA_WHITEBOARD_SECRET_KEY))) return null
  const created = await whiteboardRequest(env, '/rooms', { isRecord: false })
  const uuid = typeof created?.uuid === 'string' ? created.uuid : null
  if (!uuid) throw new Error('Whiteboard room response did not include a uuid')
  await env.DB.prepare('UPDATE game_rooms SET whiteboard_uuid = ? WHERE id = ? AND whiteboard_uuid IS NULL')
    .bind(uuid, room.id).run()
  const canonical = await env.DB.prepare('SELECT whiteboard_uuid FROM game_rooms WHERE id = ?')
    .bind(room.id).first<{ whiteboard_uuid: string | null }>()
  if (!canonical?.whiteboard_uuid) throw new Error('Whiteboard room could not be assigned')
  return canonical.whiteboard_uuid
}

async function issueWhiteboardSession(env: DrawGuessEnv, room: GameRoomRow, player: GamePlayerRow, writable: boolean) {
  const uuid = await ensureWhiteboardRoom(env, room)
  if (!uuid || !env.AGORA_WHITEBOARD_APP_IDENTIFIER) return undefined
  let issuedRoomToken: string | null = null
  if (env.AGORA_WHITEBOARD_ACCESS_KEY && env.AGORA_WHITEBOARD_SECRET_KEY) {
    issuedRoomToken = roomToken(env.AGORA_WHITEBOARD_ACCESS_KEY, env.AGORA_WHITEBOARD_SECRET_KEY, 60 * 60 * 1000, {
      uuid,
      role: writable ? TokenRole.Writer : TokenRole.Reader,
    })
  } else {
    const token = await whiteboardRequest(env, `/tokens/rooms/${encodeURIComponent(uuid)}`, {
      lifespan: 60 * 60 * 1000,
      role: writable ? 'writer' : 'reader',
    })
    issuedRoomToken = typeof token === 'string' ? token : typeof token?.token === 'string' ? token.token : null
  }
  if (!issuedRoomToken) throw new Error('Whiteboard token generation failed')
  return {
    appIdentifier: env.AGORA_WHITEBOARD_APP_IDENTIFIER,
    uuid,
    roomToken: issuedRoomToken,
    uid: player.id,
    region: env.AGORA_WHITEBOARD_REGION || 'us-sv',
    writable,
  }
}

export async function publicGameRoom(env: DrawGuessEnv, room: GameRoomRow, viewer: GamePlayerRow, includeCredentials = true): Promise<PublicGameRoom> {
  const now = Date.now()
  room = await reconcileGameRoom(env, room, now)
  const playersResult = await env.DB.prepare('SELECT * FROM game_players WHERE room_id = ? ORDER BY joined_at')
    .bind(room.id).all<GamePlayerRow>()
  const round = room.active_round_id
    ? await env.DB.prepare('SELECT * FROM game_rounds WHERE id = ?').bind(room.active_round_id).first<GameRoundRow>()
    : null
  const guesses = round
    ? await env.DB.prepare(`SELECT id, player_id, source, content, correctness, created_at FROM game_guesses WHERE round_id = ? ORDER BY created_at DESC LIMIT 40`)
      .bind(round.id).all<{ id: string; player_id: string | null; source: 'human' | 'ai'; content: string; correctness: 'wrong' | 'close' | 'correct'; created_at: number }>()
    : { results: [] }
  const isArtist = round?.artist_id === viewer.id
  const revealed = new Set<number>(round ? JSON.parse(round.revealed_json || '[]') : [])
  if (round?.phase === 'drawing') {
    for (const index of progressiveHintIndexes(round.secret_word, round.started_at, round.ends_at)) revealed.add(index)
  }
  const aiAttempt = round && room.ai_enabled
    ? await env.DB.prepare(`SELECT id, guess, reason, confidence, phase, vision_ms, generation_ms, verification_ms, created_at, updated_at
      FROM ai_proof_attempts WHERE round_id = ? ORDER BY created_at DESC LIMIT 1`).bind(round.id).first<AiAttemptRow>()
    : null
  const [agora, whiteboard] = includeCredentials
    ? await Promise.all([
        Promise.resolve(issueGameAgoraSession(env, room, viewer)),
        issueWhiteboardSession(env, room, viewer, canWriteWhiteboard(isArtist, round?.phase)).catch(() => undefined),
      ])
    : [undefined, undefined]
  return {
    id: room.id,
    phase: room.phase,
    hostPlayerId: room.host_player_id,
    aiEnabled: Boolean(room.ai_enabled),
    aiPhase: room.ai_phase,
    roundsTotal: room.rounds_total,
    turnSeconds: room.turn_seconds,
    waitingForPlayersUntil: shortageDeadline(room.waiting_for_players_since),
    players: (playersResult.results ?? [])
      .filter((player) => room.phase !== 'lobby' || player.role === 'ai' || player.left_at === null || player.left_at === undefined)
      .map((player) => {
        const presence = player.role === 'ai' ? 'online' : gamePlayerPresence(lifecyclePlayer(player), now)
        return {
          id: player.id,
          nickname: player.role === 'ai' ? 'FastH3' : player.nickname,
          role: player.role,
          score: player.score,
          ready: Boolean(player.ready),
          connected: presence === 'online',
          presence,
        }
      }),
    messages: [...(guesses.results ?? [])].reverse().map((guess) => ({
      id: guess.id,
      playerId: guess.player_id,
      source: guess.source,
      content: guess.correctness === 'correct' && round?.phase !== 'result' ? 'guessed the word!' : guess.content,
      correctness: guess.correctness,
      createdAt: guess.created_at,
    })),
    aiActivity: aiAttempt ? {
      attemptId: aiAttempt.id,
      guess: aiAttempt.guess,
      reason: aiAttempt.reason,
      confidence: aiAttempt.confidence,
      phase: aiAttempt.phase,
      visionMs: aiAttempt.vision_ms,
      generationMs: aiAttempt.generation_ms,
      verificationMs: aiAttempt.verification_ms,
      startedAt: aiAttempt.created_at,
      updatedAt: aiAttempt.updated_at,
    } : undefined,
    round: round ? {
      id: round.id,
      number: round.number,
      artistId: round.artist_id,
      phase: round.phase,
      wordHint: roundWordForViewer({ phase: round.phase, isArtist, secretWord: round.secret_word, revealed }),
      choices: isArtist && round.phase === 'choosing' ? JSON.parse(round.choices_json) : undefined,
      secretWord: isArtist && round.phase !== 'result' ? round.secret_word : round.phase === 'result' ? round.secret_word : undefined,
      startedAt: round.started_at,
      endsAt: round.ends_at,
      winnerType: round.winner_type,
      winnerId: round.winner_id,
      endReason: round.end_reason,
      chooseEndsAt: round.choose_ends_at ?? null,
    } : null,
    agora,
    whiteboard,
  }
}

export async function createRoomWithHost(env: DrawGuessEnv, nickname: string) {
  const now = Date.now()
  const roomId = createGameRoomId()
  const playerId = createPlayerId()
  const seatToken = createGameToken()
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO game_rooms
      (id, host_player_id, phase, rounds_total, turn_seconds, created_at, expires_at)
      VALUES (?, ?, 'lobby', 3, 60, ?, ?)`)
      .bind(roomId, playerId, now, now + GAME_ROOM_LIFETIME_MS),
    env.DB.prepare(`INSERT INTO game_players
      (id, room_id, nickname, role, rtc_uid, seat_token_hash, ready, connected, joined_at, last_seen_at)
      VALUES (?, ?, ?, 'host', ?, ?, 1, 1, ?, ?)`)
      .bind(playerId, roomId, nickname, makeRtcUid(), await hashSeatToken(seatToken), now, now),
  ])
  return { roomId, playerId, seatToken }
}

export function isAiGuessCorrect(guess: string, answer: string) {
  return isCorrectGuess(guess, answer)
}
