import { createFileRoute } from '@tanstack/react-router'
import { artistAssistScore, guesserScore, isAiProofAccepted, progressiveHintIndexes } from '#/lib/game/model'
import { hashSeatToken, readGamePlayer, readGameRoom, reconcileGameRoom } from '#/lib/server/game-server'
import { json } from '#/lib/server/http'
import { isSafeDataImage, verifyProof } from '#/lib/server/openai-vision'
import { withPrimaryD1Session, workerEnv as baseWorkerEnv } from '#/lib/server/worker-env'

export const Route = createFileRoute('/api/game/rooms/$roomId/verify-proof')({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const workerEnv = withPrimaryD1Session(baseWorkerEnv)
        try {
          const body = await request.json() as { seatToken?: unknown; attemptId?: unknown; verifyNonce?: unknown; frames?: unknown; generationMs?: unknown; failed?: unknown }
          let [room, player] = await Promise.all([
            readGameRoom(workerEnv, params.roomId),
            readGamePlayer(workerEnv, params.roomId, body.seatToken),
          ])
          if (!room || !player) return json({ error: 'Your room seat is no longer valid.' }, { status: 401 })
          if (player.left_at != null) return json({ error: 'You already left this room. Rejoin before verifying FastH3 proof.' }, { status: 409 })
          const heartbeatAt = Date.now()
          await workerEnv.DB.prepare('UPDATE game_players SET connected = 1, last_seen_at = ? WHERE id = ? AND left_at IS NULL')
            .bind(heartbeatAt, player.id).run()
          room = await reconcileGameRoom(workerEnv, room, heartbeatAt)
          if (room.host_player_id !== player.id) return json({ error: 'Only the current host can verify FastH3 proof.' }, { status: 403 })
          if (typeof body.attemptId !== 'string' || typeof body.verifyNonce !== 'string') return json({ error: 'Invalid proof request.' }, { status: 400 })
          const attempt = await workerEnv.DB.prepare('SELECT * FROM ai_proof_attempts WHERE id = ? AND room_id = ?')
            .bind(body.attemptId, room.id).first<{ id: string; round_id: string; guess: string; phase: string; verify_nonce_hash: string }>()
          if (!attempt || attempt.verify_nonce_hash !== await hashSeatToken(body.verifyNonce)) return json({ error: 'This proof link is invalid.' }, { status: 403 })
          if (room.phase !== 'drawing' || room.active_round_id !== attempt.round_id) return json({ error: 'That FastH3 turn is no longer active.' }, { status: 409 })
          if (!['generating', 'ready'].includes(attempt.phase)) return json({ error: 'This proof has already been processed.' }, { status: 409 })
          const generationMs = typeof body.generationMs === 'number' && body.generationMs >= 0 && body.generationMs < 120_000 ? Math.round(body.generationMs) : null
          if (body.failed === true) {
            await workerEnv.DB.batch([
              workerEnv.DB.prepare(`UPDATE ai_proof_attempts SET phase = 'failed', failure_code = 'client_generation_failed', generation_ms = ?, updated_at = ? WHERE id = ?`).bind(generationMs, Date.now(), attempt.id),
              workerEnv.DB.prepare(`UPDATE game_rooms SET ai_phase = CASE WHEN phase = 'drawing' THEN 'watching' ELSE 'failed' END WHERE id = ?`).bind(room.id),
            ])
            return json({ failed: true })
          }
          const frames = Array.isArray(body.frames) ? body.frames : []
          if (frames.length !== 3 || !frames.every(isSafeDataImage)) return json({ error: 'Proof requires exactly three valid image frames.' }, { status: 400 })
          const round = await workerEnv.DB.prepare('SELECT artist_id, secret_word, started_at, ends_at, winner_id FROM game_rounds WHERE id = ?')
            .bind(attempt.round_id).first<{ artist_id: string; secret_word: string; started_at: number; ends_at: number; winner_id: string | null }>()
          if (!round) return json({ error: 'The proof round no longer exists.' }, { status: 404 })
          const verificationStartedAt = Date.now()
          await workerEnv.DB.batch([
            workerEnv.DB.prepare(`UPDATE ai_proof_attempts SET phase = 'verifying', generation_ms = ?, updated_at = ? WHERE id = ?`).bind(generationMs, verificationStartedAt, attempt.id),
            workerEnv.DB.prepare(`UPDATE game_rooms SET ai_phase = 'verifying' WHERE id = ?`).bind(room.id),
          ])
          const decision = await verifyProof(workerEnv, round.secret_word, frames as string[])
          const verificationMs = Date.now() - verificationStartedAt
          const eligible = isAiProofAccepted(attempt.guess, round.secret_word, true, 1)
          const accepted = isAiProofAccepted(attempt.guess, round.secret_word, decision.matches, decision.confidence)
          let won = false
          const settledAt = Date.now()
          if (accepted && !round.winner_id && settledAt <= round.ends_at) {
            const settled = await workerEnv.DB.prepare(`UPDATE game_rounds SET winner_type = 'ai', winner_id = 'ai', phase = 'result', end_reason = 'verified_proof', result_at = ?
              WHERE id = ? AND winner_id IS NULL AND ends_at >= ?`).bind(settledAt, attempt.round_id, settledAt).run()
            won = settled.meta.changes === 1
          }
          const phase = accepted ? 'verified' : 'rejected'
          const updates = [
            workerEnv.DB.prepare('UPDATE ai_proof_attempts SET phase = ?, verification_result = ?, generation_ms = ?, verification_ms = ?, updated_at = ? WHERE id = ?')
              .bind(phase, JSON.stringify({ ...decision, eligible }), generationMs, verificationMs, Date.now(), attempt.id),
            workerEnv.DB.prepare(`UPDATE game_rooms SET ai_phase = CASE WHEN ? THEN 'verified' WHEN phase = 'drawing' THEN 'watching' ELSE ? END, phase = CASE WHEN ? THEN 'result' ELSE phase END WHERE id = ?`)
              .bind(won ? 1 : 0, phase, won ? 1 : 0, room.id),
          ]
          if (won) {
            const hintsShown = progressiveHintIndexes(round.secret_word, round.started_at, round.ends_at, settledAt).size
            const score = guesserScore(settledAt, round.started_at, round.ends_at, hintsShown)
            updates.push(
              workerEnv.DB.prepare(`UPDATE game_players SET score = score + ? WHERE room_id = ? AND role = 'ai'`).bind(score, room.id),
              workerEnv.DB.prepare('UPDATE game_players SET score = score + ? WHERE id = ? AND room_id = ?').bind(artistAssistScore(score), round.artist_id, room.id),
            )
          }
          await workerEnv.DB.batch(updates)
          return json({ decision, eligible, accepted, won, generationMs, verificationMs })
        } catch (error) {
          console.error('AI proof verification failed', error)
          return json({ error: 'The generated proof could not be verified.' }, { status: 503 })
        }
      },
    },
  },
})
