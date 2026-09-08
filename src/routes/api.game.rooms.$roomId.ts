import { createFileRoute } from '@tanstack/react-router'
import { isGameRoomId } from '#/lib/game/model'
import { hashSeatToken, publicGameRoom, readGamePlayer, readGameRoom } from '#/lib/server/game-server'
import { json } from '#/lib/server/http'
import { withPrimaryD1Session, workerEnv } from '#/lib/server/worker-env'

export const Route = createFileRoute('/api/game/rooms/$roomId')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const gameEnv = withPrimaryD1Session(workerEnv)
        if (!isGameRoomId(params.roomId)) return json({ error: 'That room code is invalid.' }, { status: 400 })
        const seatToken = request.headers.get('x-game-seat')
        if (!seatToken) return json({ error: 'Join the room first.' }, { status: 401 })
        const [room, player] = await Promise.all([
          readGameRoom(gameEnv, params.roomId),
          readGamePlayer(gameEnv, params.roomId, seatToken),
        ])
        if (!room || room.expires_at <= Date.now()) return json({ error: 'That room has expired.' }, { status: 404 })
        if (!player) return json({ error: 'Join the room first.' }, { status: 401 })
        const heartbeat = await gameEnv.DB.prepare('UPDATE game_players SET connected = 1, left_at = NULL, last_seen_at = ? WHERE id = ? AND (left_at IS NULL OR seat_token_hash = ?)')
          .bind(Date.now(), player.id, await hashSeatToken(seatToken)).run()
        if (heartbeat.meta.changes !== 1) return json({ error: 'This room seat has been closed.' }, { status: 401 })
        return json({ playerId: player.id, room: await publicGameRoom(gameEnv, room, player) })
      },
    },
  },
})
