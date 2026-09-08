import { createFileRoute } from '@tanstack/react-router'
import { cleanNickname, createRoomWithHost } from '#/lib/server/game-server'
import { json } from '#/lib/server/http'
import { checkRateLimit, rateLimitBuckets, rateLimitResponse, recordRateLimitHit } from '#/lib/server/rate-limit'
import { withPrimaryD1Session, workerEnv } from '#/lib/server/worker-env'

export const Route = createFileRoute('/api/game/rooms')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const gameEnv = withPrimaryD1Session(workerEnv)
          const body = await request.json() as { nickname?: unknown }
          const nickname = cleanNickname(body.nickname)
          if (!nickname) return json({ error: 'Enter a nickname.' }, { status: 400 })
          const now = Date.now()
          const buckets = rateLimitBuckets(request, nickname, 'draw-room')
          const retryAfter = await checkRateLimit(buckets, { windowMs: 10 * 60_000, max: 12 }, now)
          if (retryAfter > 0) return rateLimitResponse(retryAfter, 'Too many rooms created. Try again shortly.')
          await recordRateLimitHit(buckets, now)
          await gameEnv.DB.prepare('DELETE FROM game_rooms WHERE expires_at < ?').bind(now).run()
          const room = await createRoomWithHost(gameEnv, nickname)
          return json({ ...room, sharePath: `/room/${room.roomId}` }, { status: 201 })
        } catch (error) {
          console.error('Draw & Guess room creation failed', error)
          return json({ error: 'The room could not be created. Try again.' }, { status: 503 })
        }
      },
    },
  },
})
