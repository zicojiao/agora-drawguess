import { createFileRoute } from '@tanstack/react-router'
import { DrawGuessRoom } from '#/components/draw-guess-room'

// Room identity lives in sessionStorage, so this screen is intentionally
// client-rendered. Rendering the anonymous loading shell on the server and
// immediately restoring a seat on the client caused avoidable hydration
// recovery warnings on every room refresh.
export const Route = createFileRoute('/room/$roomId')({
  ssr: false,
  head: () => ({
    meta: [
      { name: 'robots', content: 'noindex, nofollow, noarchive' },
    ],
  }),
  component: GameRoomRoute,
})

function GameRoomRoute() {
  const { roomId } = Route.useParams()
  return <DrawGuessRoom roomId={roomId.toLowerCase()} />
}
