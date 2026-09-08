import { createFileRoute } from '@tanstack/react-router'
import { json } from '#/lib/server/http'

export const Route = createFileRoute('/api/game/rooms/$roomId/ai-session')({
  server: {
    handlers: {
      POST: async () => json({
        error: 'Shared FastH3 credits are no longer available. Add a Reactor API key in the room; it stays in your browser.',
      }, { status: 410 }),
    },
  },
})
