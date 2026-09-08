import { createFileRoute } from '@tanstack/react-router'
import { createGameToken, createPlayerId, isGameRoomId } from '#/lib/game/model'
import {
  cleanNickname,
  hashSeatToken,
  makeRtcUid,
  publicGameRoom,
  reconcileGameRoom,
  readGamePlayer,
  readGameRoom,
} from '#/lib/server/game-server'
import { json } from '#/lib/server/http'
import { withPrimaryD1Session, workerEnv } from '#/lib/server/worker-env'

export const Route = createFileRoute('/api/game/rooms/$roomId/join')({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        try {
          const gameEnv = withPrimaryD1Session(workerEnv)
          if (!isGameRoomId(params.roomId)) return json({ error: 'That room code is invalid.' }, { status: 400 })
          let room = await readGameRoom(gameEnv, params.roomId)
          if (!room || room.expires_at <= Date.now()) return json({ error: 'That room does not exist or has expired.' }, { status: 404 })
          const body = await request.json().catch(() => ({})) as { nickname?: unknown; seatToken?: unknown }
          let player = await readGamePlayer(gameEnv, room.id, body.seatToken)
          let seatToken = typeof body.seatToken === 'string' ? body.seatToken : ''
          if (!player) {
            room = await reconcileGameRoom(gameEnv, room)
            const nickname = cleanNickname(body.nickname)
            if (!nickname) return json({ error: 'Enter a nickname to join.' }, { status: 400 })
            if (room.phase !== 'lobby') return json({ error: 'This game has already started.' }, { status: 409 })
            const count = await gameEnv.DB.prepare(`SELECT COUNT(*) AS count FROM game_players WHERE room_id = ? AND role != 'ai' AND left_at IS NULL`)
              .bind(room.id).first<{ count: number }>()
            if ((count?.count ?? 0) >= 6) return json({ error: 'This room already has six human players.' }, { status: 409 })
            seatToken = createGameToken()
            const now = Date.now()
            const playerId = createPlayerId()
            await gameEnv.DB.prepare(`INSERT INTO game_players
              (id, room_id, nickname, role, rtc_uid, seat_token_hash, connected, joined_at, last_seen_at)
              VALUES (?, ?, ?, 'player', ?, ?, 1, ?, ?)`)
              .bind(playerId, room.id, nickname, makeRtcUid(), await hashSeatToken(seatToken), now, now).run()
            player = await readGamePlayer(gameEnv, room.id, seatToken)
          }
          if (!player) throw new Error('Player seat could not be restored')
          await gameEnv.DB.prepare('UPDATE game_players SET connected = 1, left_at = NULL, last_seen_at = ? WHERE id = ?')
            .bind(Date.now(), player.id).run()
          const freshRoom = await readGameRoom(gameEnv, room.id)
          if (!freshRoom) throw new Error('Room disappeared while joining')
          return json({ seatToken, playerId: player.id, room: await publicGameRoom(gameEnv, freshRoom, player) })
        } catch (error) {
          console.error('Draw & Guess join failed', error)
          return json({ error: 'Could not join the room. Try again.' }, { status: 503 })
        }
      },
    },
  },
})
