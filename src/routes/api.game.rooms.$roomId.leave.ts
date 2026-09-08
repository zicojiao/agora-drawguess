import { createFileRoute } from '@tanstack/react-router'
import { hashSeatToken, readGamePlayer, readGameRoom, reconcileGameRoom } from '#/lib/server/game-server'
import { json } from '#/lib/server/http'
import { withPrimaryD1Session, workerEnv as baseWorkerEnv } from '#/lib/server/worker-env'

export const Route = createFileRoute('/api/game/rooms/$roomId/leave')({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const workerEnv = withPrimaryD1Session(baseWorkerEnv)
        try {
          const body = await request.json().catch(() => ({})) as { seatToken?: unknown }
          const [room, player] = await Promise.all([
            readGameRoom(workerEnv, params.roomId),
            readGamePlayer(workerEnv, params.roomId, body.seatToken),
          ])
          if (!room || !player || player.role === 'ai') return json({ error: 'This room seat is no longer active.' }, { status: 409 })
          const now = Date.now()
          const retiredSeatHash = await hashSeatToken(crypto.randomUUID().replaceAll('-', '').padEnd(64, '0'))
          await workerEnv.DB.prepare('UPDATE game_players SET connected = 0, left_at = ?, last_seen_at = ?, seat_token_hash = ? WHERE id = ? AND room_id = ?')
            .bind(now, now, retiredSeatHash, player.id, room.id).run()
          await reconcileGameRoom(workerEnv, room, now)
          return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } })
        } catch (error) {
          console.error('Draw & Guess leave failed', error)
          return json({ error: 'The room could not record this exit.' }, { status: 503 })
        }
      },
    },
  },
})
