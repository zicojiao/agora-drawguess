import { createFileRoute } from '@tanstack/react-router'
import { createGameToken, normalizeGuess } from '#/lib/game/model'
import { hashSeatToken, isAiGuessCorrect, readGamePlayer, readGameRoom, reconcileGameRoom } from '#/lib/server/game-server'
import { json } from '#/lib/server/http'
import { guessDrawing, isSafeDataImage, VisionProviderError } from '#/lib/server/openai-vision'
import { withPrimaryD1Session, workerEnv as baseWorkerEnv } from '#/lib/server/worker-env'

export const Route = createFileRoute('/api/game/rooms/$roomId/ai-guess')({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const workerEnv = withPrimaryD1Session(baseWorkerEnv)
        try {
          const body = await request.json() as { seatToken?: unknown; image?: unknown }
          let [room, player] = await Promise.all([
            readGameRoom(workerEnv, params.roomId),
            readGamePlayer(workerEnv, params.roomId, body.seatToken),
          ])
          if (!room || !player) return json({ error: 'Your room seat is no longer valid.' }, { status: 401 })
          if (player.left_at != null) return json({ error: 'You already left this room. Rejoin before running FastH3.' }, { status: 409 })
          const heartbeatAt = Date.now()
          await workerEnv.DB.prepare('UPDATE game_players SET connected = 1, last_seen_at = ? WHERE id = ? AND left_at IS NULL')
            .bind(heartbeatAt, player.id).run()
          room = await reconcileGameRoom(workerEnv, room, heartbeatAt)
          if (room.host_player_id !== player.id) return json({ error: 'Only the current host can run FastH3.' }, { status: 403 })
          if (!room.ai_enabled || room.phase !== 'drawing' || !room.active_round_id) return json({ error: 'FastH3 is not watching an active drawing.' }, { status: 409 })
          if (!isSafeDataImage(body.image)) return json({ error: 'Upload one PNG, JPEG, or WebP snapshot under 2 MB.' }, { status: 400 })
          const round = await workerEnv.DB.prepare('SELECT * FROM game_rounds WHERE id = ?').bind(room.active_round_id)
            .first<{ id: string; secret_word: string; winner_id: string | null; ends_at: number }>()
          if (!round || round.winner_id || Date.now() > round.ends_at) return json({ error: 'That drawing turn is already settled.' }, { status: 409 })
          const claimed = await workerEnv.DB.prepare(`UPDATE game_rooms SET ai_phase = 'thinking' WHERE id = ? AND ai_phase = 'watching'`).bind(room.id).run()
          if (claimed.meta.changes !== 1) return json({ error: 'FastH3 is already handling the latest drawing.' }, { status: 409 })
          const earlier = await workerEnv.DB.prepare(`SELECT content AS guess FROM game_guesses
            WHERE round_id = ? AND source = 'ai' ORDER BY created_at DESC LIMIT 8`)
            .bind(round.id).all<{ guess: string }>()
          const visionStartedAt = Date.now()
          const guess = await guessDrawing(workerEnv, body.image, (earlier.results ?? []).map(({ guess: value }) => value))
          const visionMs = Date.now() - visionStartedAt
          const correct = isAiGuessCorrect(guess.guess, round.secret_word)
          const now = Date.now()
          await workerEnv.DB.prepare(`INSERT INTO game_guesses
            (id, room_id, round_id, player_id, source, content, normalized, correctness, created_at)
            VALUES (?, ?, ?, NULL, 'ai', ?, ?, ?, ?)`)
            .bind(crypto.randomUUID().replaceAll('-', ''), room.id, round.id, guess.guess, normalizeGuess(guess.guess), correct ? 'correct' : 'wrong', now).run()
          if (!correct) {
            await workerEnv.DB.prepare(`UPDATE game_rooms SET ai_phase = 'watching' WHERE id = ?`).bind(room.id).run()
            return json({ guess, correct: false })
          }
          const duplicate = await workerEnv.DB.prepare('SELECT id FROM ai_proof_attempts WHERE round_id = ? AND lower(guess) = lower(?) LIMIT 1')
            .bind(round.id, guess.guess).first<{ id: string }>()
          if (duplicate) {
            await workerEnv.DB.prepare(`UPDATE game_rooms SET ai_phase = 'watching' WHERE id = ?`).bind(room.id).run()
            return json({ guess, correct, duplicate: true })
          }
          const attemptId = crypto.randomUUID().replaceAll('-', '')
          const verifyNonce = createGameToken()
          await workerEnv.DB.prepare(`INSERT INTO ai_proof_attempts
            (id, room_id, round_id, guess, reason, confidence, verify_nonce_hash, phase, vision_ms, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'generating', ?, ?, ?)`)
            .bind(attemptId, room.id, round.id, guess.guess, guess.reason, guess.confidence, await hashSeatToken(verifyNonce), visionMs, visionStartedAt, now).run()
          await workerEnv.DB.prepare(`UPDATE game_rooms SET ai_phase = 'generating' WHERE id = ?`).bind(room.id).run()
          const prompt = `A clear, instantly recognizable cinematic shot of ${guess.guess}. Keep ${guess.guess} as the single central subject. No text, labels, captions, or unrelated objects.`
          return json({ guess, correct, proof: { attemptId, verifyNonce, prompt, status: 'generating', visionMs, startedAt: visionStartedAt } })
        } catch (error) {
          console.error('AI drawing guess failed', error)
          const quotaUnavailable = error instanceof VisionProviderError && (error.status === 429 || /1113|quota|resource pack|余额不足|资源包/i.test(error.message))
          await workerEnv.DB.prepare(`UPDATE game_rooms SET ai_phase = ? WHERE id = ?`).bind(quotaUnavailable ? 'failed' : 'watching', params.roomId).run().catch(() => undefined)
          return json({ error: quotaUnavailable ? 'FastH3 is offline because the vision provider has no available quota.' : 'FastH3 could not inspect this snapshot.' }, { status: 503 })
        }
      },
    },
  },
})
