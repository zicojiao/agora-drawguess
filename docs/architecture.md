# Architecture

Draw & Guess separates authoritative game state from realtime media and collaboration.

## Trust boundaries

- Cloudflare D1 is the source of truth for rooms, seats, rounds, guesses, scores, and AI proof attempts.
- The Worker validates every state-changing request. Browser state and Agora messages are never treated as authoritative game results.
- Agora credentials are signed by the Worker into short-lived, room-scoped tokens. Certificates and Whiteboard AK/SK remain server-side.
- The Reactor API key is supplied by the host and exchanged directly with Reactor. It is not sent to the Worker.

## Room lifecycle

1. A player creates a room and receives a tab-scoped seat token.
2. Other players join with the invitation code and mark themselves ready.
3. The host starts a game after at least two human players are online.
4. Each round selects an artist, offers three words, and starts a timed drawing phase.
5. Guessers submit answers while Agora Whiteboard synchronizes the canvas.
6. The server awards points, records the round result, and advances the artist rotation.
7. Finished rooms can replay after the minimum human-player requirement is satisfied again.

## Realtime channels

Agora RTC carries optional microphone audio and the FastH3 proof-video track. Agora RTM carries lightweight refresh and presence signals. Event listeners are attached before clients join; expiring tokens are renewed together; local tracks are stopped and closed on leave.

Realtime events only tell clients when to refetch. The Worker and D1 determine the canonical room state, which makes reconnects and late joins deterministic.

## Whiteboard

The Worker lazily provisions one Agora Whiteboard room for each game room, then returns a short-lived writer token to the current artist and reader tokens to everyone else. The board is preloaded in the lobby so the first stroke is not lost when a round starts. Starting or replaying a game clears the shared scene.

## FastH3 proof lifecycle

1. A non-empty drawing snapshot is sent to the Worker.
2. The configured vision model returns a concrete guess.
3. If the guess matches the secret word, the host starts FastH3 generation.
4. The generated video track is published through Agora RTC.
5. Three sampled frames are sent to the Worker for independent verification.
6. The AI receives a win only after both the text guess and visual proof pass.

If FastH3 or Reactor is unavailable, the human game remains playable. If RTM is unavailable, clients continue polling the authoritative HTTP state. If Whiteboard setup fails, the UI reports the connection state rather than accepting unsynchronized drawing.
