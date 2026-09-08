import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { toast } from 'sonner'
import { AgoraGameBoard, preloadAgoraWhiteboardSdk } from './agora-game-board'
import { AgoraCredit } from './agora-credit'
import { GameRulesDialog } from './game-rules-dialog'
import { ReactorProof } from './reactor-proof'
import { ReactorCredit } from './reactor-credit'
import { ReactorKeyDialog, type ReactorKeyDialogMode } from './reactor-key-dialog'
import { gameStartGate, type PublicGameRoom } from '#/lib/game/model'
import { countdownCue, GameAudio } from '#/lib/game/game-audio'
import { voiceControlCopy, type VoiceControlState } from '#/lib/game/voice-control'
import { connectAgoraSession, loadAgoraSessionDependencies, type ConnectedAgoraSession } from '#/lib/agora/session'
import { createReactorSession, readReactorApiKey, reactorRuntimeCredentialError, reactorSessionErrorMessage, type ReactorSession } from '#/lib/reactor-session'

type ProofState = { attemptId: string; verifyNonce: string; prompt?: string; status: string; visionMs?: number; startedAt?: number } | null
type GameSettings = { rounds: number; seconds: number }

function playerName(room: PublicGameRoom, id: string | null) {
  if (id === 'ai') return 'FastH3'
  return room.players.find((player) => player.id === id)?.nickname ?? 'Someone'
}

function readRoomSeat(key: string) {
  return window.sessionStorage.getItem(key) ?? window.localStorage.getItem(key)
}

function saveRoomSeat(key: string, seatToken: string) {
  window.sessionStorage.setItem(key, seatToken)
  window.localStorage.setItem(key, seatToken)
}

function clearRoomSeat(key: string) {
  window.sessionStorage.removeItem(key)
  window.localStorage.removeItem(key)
}

function roomPlayerStatus(player: PublicGameRoom['players'][number], artistId?: string | null, aiPhase?: string) {
  if (player.role === 'ai') return aiPhase ?? 'AI challenger'
  if (player.presence === 'left') return 'Left the room'
  if (!player.connected) return 'Reconnecting…'
  return player.id === artistId ? 'Drawing now' : 'Guessing'
}

function SharedFastH3Video({ track, active }: { track: MediaStreamTrack | null; active: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.srcObject = track ? new MediaStream([track]) : null
    if (track) void video.play().catch(() => undefined)
    return () => { video.srcObject = null }
  }, [track])

  return (
    <div className={`dg-proof dg-proof--shared ${active ? 'is-active' : 'is-idle'}`}>
      <div className="dg-proof__stage">
        <span className="dg-proof__scan" />
        {track ? <video ref={videoRef} autoPlay muted playsInline /> : <div className="dg-proof__waiting">Linking host video…</div>}
        <span className="dg-proof__live-badge">AGORA RTC · ROOM LIVE</span>
      </div>
      <small><i />{track ? 'The same FastH3 video is live for every player' : 'Waiting for the host’s FastH3 stream…'}</small>
    </div>
  )
}

export function DrawGuessRoom({ roomId }: { roomId: string }) {
  const [room, setRoom] = useState<PublicGameRoom | null>(null)
  const [playerId, setPlayerId] = useState('')
  const [joinName, setJoinName] = useState('')
  const [guess, setGuess] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [rulesOpen, setRulesOpen] = useState(false)
  const [aiConfirmMode, setAiConfirmMode] = useState<ReactorKeyDialogMode | null>(null)
  const [reactorSetupError, setReactorSetupError] = useState('')
  const [needsPlayerOpen, setNeedsPlayerOpen] = useState(false)
  const [aiMutationPending, setAiMutationPending] = useState(false)
  const [startPending, setStartPending] = useState(false)
  const [replayPending, setReplayPending] = useState(false)
  const [nextTurnPending, setNextTurnPending] = useState(false)
  const [leavePending, setLeavePending] = useState(false)
  const [optimisticSettings, setOptimisticSettings] = useState<GameSettings | null>(null)
  const [whiteboardReady, setWhiteboardReady] = useState(false)
  const [voiceState, setVoiceState] = useState<VoiceControlState>('off')
  const [proof, setProof] = useState<ProofState>(null)
  const [aiSession, setAiSession] = useState<{ jwt: string; expiresAt: number } | null>(null)
  const [proofPortal, setProofPortal] = useState<HTMLDivElement | null>(null)
  const [proofNote, setProofNote] = useState('')
  const [remoteFastH3Track, setRemoteFastH3Track] = useState<MediaStreamTrack | null>(null)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [now, setNow] = useState(Date.now())
  const sessionRef = useRef<ConnectedAgoraSession | null>(null)
  const sessionPromiseRef = useRef<Promise<ConnectedAgoraSession> | null>(null)
  const intentionalVoiceCloseRef = useRef(false)
  const aiBusyRef = useRef(false)
  const aiMutationPendingRef = useRef(false)
  const startPendingRef = useRef(false)
  const replayPendingRef = useRef(false)
  const nextTurnPendingRef = useRef(false)
  const queuedSettingsRef = useRef<GameSettings | null>(null)
  const settingsSavingRef = useRef(false)
  const audioRef = useRef<GameAudio | null>(null)
  const lastCountdownRef = useRef('')
  const previousPhaseRef = useRef<string | null>(null)
  const previousHostRef = useRef<string | null>(null)
  const refreshFailureRef = useRef(0)
  const leavingRef = useRef(false)
  const seatKey = `drawguess.seat.${roomId}`

  const refresh = useCallback(async () => {
    if (leavingRef.current) return
    const seatToken = readRoomSeat(seatKey)
    if (!seatToken) return
    const response = await fetch(`/api/game/rooms/${roomId}`, { headers: { 'x-game-seat': seatToken } })
    const result = await response.json() as { playerId?: string; room?: PublicGameRoom; error?: string }
    if (!response.ok || !result.room || !result.playerId) {
      if (response.status === 401 || response.status === 404) {
        clearRoomSeat(seatKey)
        setRoom(null)
        setPlayerId('')
        setError(result.error || 'This room is no longer available.')
        setLoading(false)
        return
      }
      throw new Error(result.error || 'Could not refresh the room.')
    }
    refreshFailureRef.current = 0
    setRoom((previous) => ({
      ...result.room!,
      agora: previous?.agora ?? result.room!.agora,
      whiteboard: result.room!.whiteboard?.writable === previous?.whiteboard?.writable
        ? previous?.whiteboard
        : result.room!.whiteboard ?? previous?.whiteboard,
    })); setPlayerId(result.playerId); setLoading(false)
  }, [roomId, seatKey])

  const join = useCallback(async (name: string, existingSeat?: string | null) => {
    setLoading(true); setError('')
    try {
      const response = await fetch(`/api/game/rooms/${roomId}/join`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nickname: name, seatToken: existingSeat }) })
      const result = await response.json() as { seatToken?: string; playerId?: string; room?: PublicGameRoom; error?: string }
      if (!response.ok || !result.seatToken || !result.playerId || !result.room) throw new Error(result.error || 'Could not join the room.')
      saveRoomSeat(seatKey, result.seatToken)
      if (name) window.localStorage.setItem('drawguess.nickname', name)
      setRoom(result.room); setPlayerId(result.playerId); setLoading(false)
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not join the room.'); setLoading(false) }
  }, [roomId, seatKey])

  useEffect(() => {
    const storedName = window.localStorage.getItem('drawguess.nickname') ?? ''
    setSoundEnabled(window.localStorage.getItem('drawguess.sound') !== 'false')
    setJoinName(storedName)
    const seat = readRoomSeat(seatKey)
    if (seat) void join(storedName, seat)
    else setLoading(false)
  }, [join, seatKey])

  useEffect(() => {
    if (room?.whiteboard) void preloadAgoraWhiteboardSdk().catch(() => undefined)
  }, [room?.whiteboard?.appIdentifier])

  useEffect(() => {
    if (!room) return
    const poll = window.setInterval(() => {
      void refresh().catch((caught) => {
        refreshFailureRef.current += 1
        if (refreshFailureRef.current >= 3) setError(caught instanceof Error ? caught.message : 'Room updates are temporarily unavailable.')
      })
    }, 2_500)
    const clock = window.setInterval(() => setNow(Date.now()), 250)
    return () => { window.clearInterval(poll); window.clearInterval(clock) }
  }, [refresh, room?.id])

  const ensureAgoraSession = useCallback(async () => {
    if (sessionRef.current) return sessionRef.current
    if (sessionPromiseRef.current) return sessionPromiseRef.current
    const credentials = room?.agora
    if (!credentials) throw new Error('Agora realtime is unavailable for this room.')
    const promise = (async () => {
      const dependencies = await loadAgoraSessionDependencies()
      const connected = await connectAgoraSession(credentials, {
        onOpponentJoined: () => { void refresh() },
        onOpponentLeft: () => { void refresh() },
        onRemoteVideoTrack: (track) => setRemoteFastH3Track(track),
        onMessage: (message) => { try { if ((JSON.parse(message) as { type?: string }).type === 'refresh') void refresh() } catch { /* ignore */ } },
        onConnectionState: (state) => {
          if (state === 'DISCONNECTED' || state === 'SAME_UID_LOGIN') {
            setRemoteFastH3Track(null)
            setVoiceState((current) => current === 'live' ? 'error' : current)
            if (state === 'SAME_UID_LOGIN') setError('This room seat is open in another tab. Use one tab at a time, then retry voice.')
          }
        },
        renewToken: async () => {
          const seatToken = readRoomSeat(seatKey)
          const response = await fetch(`/api/game/rooms/${roomId}/join`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ seatToken }) })
          const result = await response.json() as { room?: PublicGameRoom; error?: string }
          const token = result.room?.agora?.token
          if (!response.ok || !result.room || !token) throw new Error(result.error || 'Could not renew Agora credentials.')
          setRoom((previous) => previous?.agora ? { ...previous, agora: { ...previous.agora, token } } : result.room!)
          return token
        },
      }, dependencies, { deferMicrophone: true })
      sessionRef.current = connected
      return connected
    })()
    sessionPromiseRef.current = promise
    try {
      return await promise
    } finally {
      if (sessionPromiseRef.current === promise) sessionPromiseRef.current = null
    }
  }, [refresh, room?.agora, roomId, seatKey])

  useEffect(() => {
    if (!room?.agora) return
    void ensureAgoraSession().catch(() => {
      setRemoteFastH3Track(null)
    })
  }, [ensureAgoraSession, room?.agora])

  useEffect(() => () => {
    intentionalVoiceCloseRef.current = true
    const session = sessionRef.current
    sessionRef.current = null
    sessionPromiseRef.current = null
    void session?.close()
  }, [])

  useEffect(() => {
    audioRef.current = new GameAudio()
    const unlock = () => { if (soundEnabled) void audioRef.current?.unlock() }
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
      audioRef.current?.close()
      audioRef.current = null
    }
  }, [])

  const publishRefresh = async () => { await sessionRef.current?.publish(JSON.stringify({ type: 'refresh', at: Date.now() }), 'drawguess.refresh').catch(() => undefined) }
  const act = async (action: string, value?: string) => {
    const seatToken = readRoomSeat(seatKey)
    const response = await fetch(`/api/game/rooms/${roomId}/action`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ seatToken, action, value }) })
    const result = await response.json() as { error?: string }
    if (!response.ok) { setError(result.error || 'That action failed.'); return false }
    setError(''); await publishRefresh(); await refresh(); return true
  }

  const changeAiPlayer = async (action: 'invite-ai' | 'remove-ai') => {
    if (aiMutationPendingRef.current) return false
    aiMutationPendingRef.current = true
    setAiMutationPending(true)
    try {
      return await act(action)
    } finally {
      aiMutationPendingRef.current = false
      setAiMutationPending(false)
    }
  }

  const startGame = async () => {
    if (startPendingRef.current) return
    startPendingRef.current = true
    setStartPending(true)
    try {
      await act('start')
    } finally {
      startPendingRef.current = false
      setStartPending(false)
    }
  }

  const requestStartGame = () => {
    if (!room) return
    const gate = gameStartGate(room.players, room.hostPlayerId, room.aiEnabled)
    if (gate === 'needs-player') {
      setNeedsPlayerOpen(true)
      return
    }
    if (gate === 'needs-ai') {
      setReactorSetupError('')
      setAiConfirmMode('start')
      return
    }
    void startGame()
  }

  const finishFastH3Setup = async (session: ReactorSession) => {
    const mode = aiConfirmMode
    setAiSession(session)
    setReactorSetupError('')
    if (mode !== 'reconnect' && !await changeAiPlayer('invite-ai')) {
      setAiSession(null)
      return false
    }
    setAiConfirmMode(null)
    if (mode === 'start') await startGame()
    return true
  }

  const continueWithoutFastH3 = () => {
    const shouldStart = aiConfirmMode === 'start'
    setAiConfirmMode(null)
    if (shouldStart) void startGame()
  }

  const replayCurrentRoom = async () => {
    if (replayPendingRef.current) return
    replayPendingRef.current = true
    setReplayPending(true)
    try {
      const seatToken = readRoomSeat(seatKey)
      const response = await fetch(`/api/game/rooms/${roomId}/action`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ seatToken, action: 'restart' }),
      })
      const result = await response.json() as { error?: string; needsPlayer?: boolean }
      if (!response.ok) {
        setError(result.error || 'This room could not be restarted.')
        return
      }
      setError('')
      await publishRefresh()
      await refresh()
      if (result.needsPlayer) setNeedsPlayerOpen(true)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'This room could not be restarted.')
    } finally {
      replayPendingRef.current = false
      setReplayPending(false)
    }
  }

  const nextTurn = useCallback(async () => {
    if (nextTurnPendingRef.current) return
    nextTurnPendingRef.current = true
    setNextTurnPending(true)
    try {
      await act('next-turn')
    } finally {
      nextTurnPendingRef.current = false
      setNextTurnPending(false)
    }
  }, [roomId, seatKey])

  const updateSettings = async (settings: GameSettings) => {
    queuedSettingsRef.current = settings
    setOptimisticSettings(settings)
    if (settingsSavingRef.current) return
    settingsSavingRef.current = true
    try {
      while (queuedSettingsRef.current) {
        const latest = queuedSettingsRef.current
        queuedSettingsRef.current = null
        if (!await act('settings', JSON.stringify(latest))) {
          queuedSettingsRef.current = null
          break
        }
      }
    } catch (caught) {
      queuedSettingsRef.current = null
      setError(caught instanceof Error ? caught.message : 'Room settings could not be saved.')
    } finally {
      settingsSavingRef.current = false
      setOptimisticSettings(null)
    }
  }

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      toast.success('Invite link copied!', {
        id: `invite-copied-${roomId}`,
        description: `Room ${roomId.toUpperCase()} is ready to share.`,
        duration: 3_600,
        icon: (
          <svg className="dg-toast-check" viewBox="0 0 24 24" aria-hidden="true">
            <path d="m6.5 12.5 3.25 3.25L17.8 7.7" />
          </svg>
        ),
      })
    } catch {
      toast.error("Couldn't copy the invite link", {
        id: `invite-copy-failed-${roomId}`,
        description: 'Copy the URL from your address bar instead.',
        duration: 4_500,
      })
    }
  }

  const connectVoice = async () => {
    if (!room?.agora || voiceState === 'joining' || voiceState === 'leaving' || voiceState === 'live') return
    intentionalVoiceCloseRef.current = false
    setVoiceState('joining')
    try {
      const session = await ensureAgoraSession()
      await session.enableMicrophone()
      setVoiceState('live')
    } catch (caught) { setVoiceState('error'); setError(caught instanceof Error ? caught.message : 'Voice could not connect.') }
  }

  const disconnectVoice = async () => {
    if (voiceState !== 'live' || !sessionRef.current) return
    intentionalVoiceCloseRef.current = true
    setVoiceState('leaving')
    const session = sessionRef.current
    try {
      await session.disableMicrophone()
      setError('')
      setVoiceState('off')
      toast.success('Voice disconnected')
    } catch (caught) {
      setVoiceState('error')
      setError(caught instanceof Error ? caught.message : 'Voice could not disconnect cleanly.')
    }
  }

  const leaveRoom = async (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    if (leavePending || leavingRef.current) return
    leavingRef.current = true
    setLeavePending(true)
    const seatToken = readRoomSeat(seatKey)
    try {
      if (seatToken) {
        await fetch(`/api/game/rooms/${roomId}/leave`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ seatToken }),
          keepalive: true,
        })
      }
    } catch {
      // The server-side grace period still recovers an interrupted leave request.
    } finally {
      clearRoomSeat(seatKey)
      const session = sessionRef.current
      sessionRef.current = null
      await session?.close().catch(() => undefined)
      window.location.assign('/')
    }
  }

  const submitGuess = async () => { if (guess.trim() && await act('guess', guess)) setGuess('') }

  const inspectDrawing = useCallback(async (image: string) => {
    if (aiBusyRef.current || !room?.aiEnabled || room.waitingForPlayersUntil || room.aiPhase !== 'watching' || room.phase !== 'drawing') return
    aiBusyRef.current = true
    try {
      const response = await fetch(`/api/game/rooms/${roomId}/ai-guess`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ seatToken: readRoomSeat(seatKey), image }) })
      const result = await response.json() as { proof?: ProofState; error?: string }
      if (result.proof && 'attemptId' in result.proof) { setProofNote(''); setProof(result.proof) }
      if (!response.ok && response.status !== 409) setProofNote(result.error || 'FastH3 missed that snapshot.')
      await publishRefresh(); await refresh()
    } finally { aiBusyRef.current = false }
  }, [room?.aiEnabled, room?.aiPhase, room?.phase, room?.waitingForPlayersUntil, roomId, seatKey, refresh])

  const verifyVideo = async (frames: string[], generationMs: number) => {
    if (!proof?.attemptId || !proof.verifyNonce) return
    setProofNote('OpenAI is checking three frames…')
    try {
      const response = await fetch(`/api/game/rooms/${roomId}/verify-proof`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ seatToken: readRoomSeat(seatKey), attemptId: proof.attemptId, verifyNonce: proof.verifyNonce, frames, generationMs }) })
      const result = await response.json() as { accepted?: boolean; won?: boolean; error?: string }
      if (!response.ok) throw new Error(result.error || 'Proof verification failed.')
      setProofNote(result.won ? 'Proof verified. FastH3 wins this turn.' : result.accepted ? 'Proof passed, but a human finished first.' : 'That candidate did not prove the secret word. Scanning again…')
      await publishRefresh(); await refresh()
      if (!result.won) setProof(null)
    } catch (caught) { setProofNote(caught instanceof Error ? caught.message : 'Proof verification failed.') }
  }

  const failProof = async (message: string, generationMs?: number) => {
    const credentialError = reactorRuntimeCredentialError(message)
    setProofNote(credentialError ?? `${message}. FastH3 is scanning again…`)
    if (credentialError) {
      setAiSession(null)
      setReactorSetupError(credentialError)
      setAiConfirmMode('reconnect')
    }
    if (!proof?.attemptId || !proof.verifyNonce) return
    await fetch(`/api/game/rooms/${roomId}/verify-proof`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ seatToken: readRoomSeat(seatKey), attemptId: proof.attemptId, verifyNonce: proof.verifyNonce, failed: true, generationMs }) }).catch(() => undefined)
    setProof(null); await publishRefresh(); await refresh().catch(() => undefined)
  }

  const isHost = room?.hostPlayerId === playerId
  const isArtist = room?.round?.artistId === playerId
  const waitingForPlayers = Boolean(room?.waitingForPlayersUntil)
  const waitingSeconds = room?.waitingForPlayersUntil ? Math.max(0, Math.ceil((room.waitingForPlayersUntil - now) / 1000)) : 0
  const secondsLeft = room?.round?.endsAt ? Math.max(0, Math.ceil((room.round.endsAt - now) / 1000)) : room?.turnSeconds ?? 60
  const sortedPlayers = useMemo(() => [...(room?.players ?? [])].sort((a, b) => b.score - a.score), [room?.players])
  const hintsRevealed = room?.phase === 'drawing' && !isArtist ? (room.round?.wordHint.match(/[\p{L}\p{N}]/gu)?.length ?? 0) : 0
  const aiElapsedMs = room?.aiActivity && ['generating', 'verifying'].includes(room.aiPhase) ? Math.max(0, now - room.aiActivity.startedAt) : null
  const aiStage = isHost && room?.aiEnabled && !aiSession ? 'WARMING UP FASTH3' : room?.aiPhase === 'thinking' ? 'VISION IS THINKING' : room?.aiPhase === 'generating' ? 'FASTH3 IS GENERATING' : room?.aiPhase === 'verifying' ? 'VERIFYING 3 FRAMES' : room?.aiPhase === 'watching' ? 'SCANNING THE BOARD' : room?.aiPhase === 'verified' ? 'PROOF VERIFIED' : room?.aiPhase === 'failed' ? 'GENERATION OFFLINE' : 'AI CHALLENGER'
  const aiVideoActive = Boolean(room?.aiActivity && ['generating', 'verifying', 'verified'].includes(room.aiPhase))
  const voiceControl = voiceControlCopy(voiceState, Boolean(room?.agora))
  const whiteboardStatus = !room?.whiteboard
    ? { state: 'fallback', detail: 'Local board', label: 'Using the local whiteboard' }
    : room.phase === 'lobby'
      ? { state: 'standby', detail: 'Ready to connect', label: 'Agora whiteboard is preloaded' }
      : whiteboardReady
        ? { state: 'ready', detail: 'Agora synced', label: 'Agora whiteboard connected' }
        : { state: 'loading', detail: 'Connecting…', label: 'Connecting Agora whiteboard' }
  const displayedRounds = optimisticSettings?.rounds ?? room?.roundsTotal ?? 3
  const displayedSeconds = optimisticSettings?.seconds ?? room?.turnSeconds ?? 60
  const resultInterrupted = room?.round?.endReason === 'artist_left'
  const resultTimedOut = room?.round?.endReason === 'timeout'

  useEffect(() => {
    if (!room || !playerId) return
    const previousHost = previousHostRef.current
    if (previousHost && previousHost !== room.hostPlayerId && room.hostPlayerId === playerId) {
      toast.success('You are the host now', { description: 'The previous host left. You can keep the game moving.' })
    }
    previousHostRef.current = room.hostPlayerId
  }, [playerId, room?.hostPlayerId])

  const relayFastH3Video = useCallback((track: MediaStreamTrack | null) => {
    if (!isHost) return
    void ensureAgoraSession()
      .then((session) => session.setPublishedVideoTrack(track))
      .catch(() => setProofNote('FastH3 video could not be shared to the room.'))
  }, [ensureAgoraSession, isHost])

  useEffect(() => {
    if (!isHost || !room?.aiEnabled) {
      setAiSession(null)
      if (isHost) void sessionRef.current?.setPublishedVideoTrack(null)
      return
    }
    if (aiSession || reactorSetupError) return
    let cancelled = false
    void (async () => {
      const apiKey = readReactorApiKey(window.localStorage)
      if (!apiKey) throw new Error('missing-reactor-key')
      const result = await createReactorSession(apiKey)
      if (cancelled) return
      setAiSession(result)
    })().catch((caught) => {
      if (cancelled) return
      const message = caught instanceof Error && caught.message === 'missing-reactor-key'
        ? 'Add a Reactor API key to reconnect FastH3 on this device.'
        : reactorSessionErrorMessage(caught)
      setProofNote(message)
      setReactorSetupError(message)
      setAiConfirmMode('reconnect')
    })
    return () => { cancelled = true }
  }, [aiSession, isHost, reactorSetupError, room?.aiEnabled])

  useEffect(() => {
    if (!isHost || room?.phase !== 'result' || !room.round?.id) return
    const timer = window.setTimeout(() => { void nextTurn() }, 3_000)
    return () => window.clearTimeout(timer)
  }, [isHost, nextTurn, room?.phase, room?.round?.id])

  useEffect(() => {
    if (!room || !soundEnabled) return
    const previousPhase = previousPhaseRef.current
    if (room.phase === 'choosing' && previousPhase !== 'choosing' && isArtist) audioRef.current?.play('your-turn')
    if (room.phase === 'result' && previousPhase !== 'result') {
      audioRef.current?.play(room.round?.endReason === 'timeout' ? 'round-end' : 'correct')
    }
    previousPhaseRef.current = room.phase
  }, [isArtist, room?.phase, room?.round?.endReason, soundEnabled])

  useEffect(() => {
    if (!room || !soundEnabled || room.phase !== 'drawing' || !room.round?.id) return
    const cue = countdownCue(secondsLeft)
    const cueKey = `${room.round.id}:${secondsLeft}`
    if (cue === 'none' || lastCountdownRef.current === cueKey) return
    lastCountdownRef.current = cueKey
    audioRef.current?.play(cue)
  }, [room?.phase, room?.round?.id, secondsLeft, soundEnabled])

  const toggleSound = async () => {
    const next = !soundEnabled
    setSoundEnabled(next)
    window.localStorage.setItem('drawguess.sound', String(next))
    if (next) {
      await audioRef.current?.unlock()
      audioRef.current?.play('tick')
    }
  }

  if (loading) return <main className="dg-room-shell dg-loading"><div className="dg-loader">✎</div><p>Opening room {roomId.toUpperCase()}…</p></main>
  if (!room) return <main className="dg-room-shell dg-join-page"><section className="dg-join-card"><a className="dg-brand" href="/"><span className="dg-brand__mark">✎</span><span>DRAW<br />& GUESS</span></a><span className="dg-eyebrow">JOIN ROOM {roomId.toUpperCase()}</span><h1>Pick a name.<br />Grab a marker.</h1><label><span>Your nickname</span><input value={joinName} maxLength={24} onChange={(event) => setJoinName(event.target.value)} placeholder="Mysterious Mango" /></label><button className="dg-button dg-button--blue" onClick={() => void join(joinName)}>Join the room →</button>{error && <p className="dg-form-error">{error}</p>}</section></main>

  return (
    <main className={`dg-room-shell dg-room-shell--active ${room.phase === 'finished' ? 'dg-room-shell--finished' : ''}`}>
      <header className="dg-game-header">
        <a className="dg-brand dg-brand--small" href="/"><span className="dg-brand__mark">✎</span><span>DRAW<br />& GUESS</span></a>
        <div className="dg-game-header__credits" aria-label="Technology partners">
          <AgoraCredit compact placement="game_header" />
          <ReactorCredit compact placement="game_header" />
        </div>
        <div className="dg-room-code"><span>ROOM</span><strong>{room.id.toUpperCase()}</strong><button onClick={() => void copyInvite()}>Copy invite</button></div>
        <div className="dg-round-word"><span>{room.phase === 'lobby' ? 'WAITING FOR PLAYERS' : room.phase === 'finished' ? 'FINAL SCORES' : `ROUND ${room.round?.number ?? 1} / ${room.roundsTotal}`}{hintsRevealed > 0 && <em>HINT +{hintsRevealed}</em>}</span><strong>{room.phase === 'finished' ? 'GAME OVER' : room.round?.wordHint ?? 'GET READY'}</strong></div>
        <div className={`dg-timer ${!waitingForPlayers && room.phase !== 'finished' && secondsLeft <= 10 ? 'is-urgent' : ''}`}><span>{room.phase === 'finished' ? 'DONE' : waitingForPlayers ? 'RECONNECT' : 'TIME'}</span><strong>{room.phase === 'finished' ? '—:—' : waitingForPlayers ? `00:${String(waitingSeconds).padStart(2, '0')}` : `${String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:${String(secondsLeft % 60).padStart(2, '0')}`}</strong></div>
      </header>

      {room.phase === 'lobby' ? (
        <section className="dg-lobby">
          <div className="dg-lobby__intro"><span className="dg-eyebrow">ROOM {room.id.toUpperCase()}</span><h1>THE GAME<br />IS ALMOST READY.</h1><p>Invite your friends, add FastH3 if you want an AI challenger, then start the game.</p><div className="dg-lobby__actions"><button className="dg-button dg-button--paper" onClick={() => setRulesOpen(true)}>Read the rules</button></div>{isHost && <div className="dg-lobby-settings" aria-busy={Boolean(optimisticSettings)}><div><span>ROUNDS</span>{[3, 5].map((count) => <button key={count} className={displayedRounds === count ? 'is-selected' : ''} aria-pressed={displayedRounds === count} onPointerUp={(event) => event.currentTarget.blur()} onClick={() => void updateSettings({ rounds: count, seconds: displayedSeconds })}>{count}</button>)}</div><div><span>DRAW TIME</span>{[45, 60, 90].map((seconds) => <button key={seconds} className={displayedSeconds === seconds ? 'is-selected' : ''} aria-pressed={displayedSeconds === seconds} onPointerUp={(event) => event.currentTarget.blur()} onClick={() => void updateSettings({ rounds: displayedRounds, seconds })}>{seconds}s</button>)}</div></div>}</div>
          <div className="dg-lobby__roster"><div className="dg-panel-title"><span>PLAYERS</span><strong>{room.players.length}/7</strong></div>{sortedPlayers.map((player) => <div className={`dg-player-row ${player.id === playerId ? 'is-me' : ''}`} key={player.id}><span className="dg-player-avatar">{player.role === 'ai' ? '✦' : player.nickname.slice(0, 1).toUpperCase()}</span><div><strong>{player.nickname}{player.id === playerId ? ' (you)' : ''}</strong><span>{player.role === 'ai' ? 'AI challenger' : player.role === 'host' ? player.connected ? 'Host' : 'Host · Reconnecting…' : player.connected ? 'In the room' : 'Reconnecting…'}</span></div><b aria-label={player.connected ? 'Online' : 'Offline'}>{player.role === 'ai' ? 'AI' : player.connected ? '✓' : '…'}</b></div>)}
            {isHost && !room.aiEnabled && (
              <button
                className={`dg-invite-ai ${aiConfirmMode ? '' : 'dg-invite-ai--attention'}`}
                onClick={() => { setReactorSetupError(''); setAiConfirmMode('invite') }}
              >
                <span>✦</span>
                <div>
                  <strong>Invite FastH3</strong>
                  <small>Add the AI challenger</small>
                </div>
                <b>+</b>
              </button>
            )}
            {isHost && room.aiEnabled && <button className="dg-link-danger" disabled={aiMutationPending} onClick={() => void changeAiPlayer('remove-ai')}>{aiMutationPending ? 'Removing…' : 'Remove FastH3'}</button>}
            <button className="dg-roster-copy" onClick={() => void copyInvite()}>
              <span aria-hidden="true">⧉</span>
              <span><strong>Copy invite link</strong><small>Share room {room.id.toUpperCase()}</small></span>
              <b>Copy</b>
            </button>
          </div>
          <div className="dg-lobby__start">{isHost ? <button className="dg-start-game" disabled={startPending} onClick={requestStartGame}><span><small>HOST CONTROL</small><strong>{startPending ? 'Starting…' : 'Start game'}</strong></span><b aria-hidden="true">→</b></button> : <p className="dg-waiting-host">You’re in. Waiting for the host to start…</p>}</div>
        </section>
      ) : room.phase === 'finished' ? (
        <section className="dg-finished">
          <header className="dg-finished__heading">
            <span className="dg-eyebrow">FINAL RESULTS</span>
            <h1>THAT’S A WRAP.</h1>
            <p>{sortedPlayers.some((player) => player.score > 0) ? 'Final points from every correct guess and verified FastH3 proof.' : 'No correct guesses this time — run it back.'}</p>
          </header>
          <div className="dg-finished__scores" aria-label="Final scores">
            {sortedPlayers.map((player, index) => (
              <div className={`dg-finish-row ${index === 0 ? 'is-winner' : ''}`} key={player.id}>
                <span>#{index + 1}</span>
                <div><strong>{player.nickname}</strong><small>{player.role === 'ai' ? 'AI challenger' : player.role === 'host' ? 'Host' : 'Player'}</small></div>
                <b aria-label={`${player.score} points`}><span>{player.score.toLocaleString('en-US')}</span><small>PTS</small></b>
              </div>
            ))}
          </div>
          <div className="dg-finished__actions">{isHost && <button className="dg-button dg-button--yellow" disabled={replayPending} onClick={() => void replayCurrentRoom()}>{replayPending ? 'Getting room ready…' : 'Play again in this room'}</button>}<a className="dg-button dg-button--blue" href="/">Make another room</a></div>
        </section>
      ) : (
        <section className="dg-game-grid">
          <aside className="dg-panel dg-players-panel"><div className="dg-panel-title"><span>SCOREBOARD</span><strong>LIVE</strong></div>{sortedPlayers.map((player, index) => <div className={`dg-player-row ${player.id === room.round?.artistId ? 'is-artist' : ''} ${!player.connected ? 'is-offline' : ''}`} key={player.id}><span className="dg-player-rank">{index + 1}</span><span className="dg-player-avatar">{player.role === 'ai' ? '✦' : player.nickname.slice(0, 1).toUpperCase()}</span><div><strong>{player.nickname}</strong><span>{roomPlayerStatus(player, room.round?.artistId, room.aiPhase)}</span></div><b>{player.score}</b></div>)}</aside>
          <section className="dg-canvas-panel">
            <AgoraGameBoard credentials={room.whiteboard} canDraw={Boolean(!waitingForPlayers && isArtist && room.phase === 'drawing' && secondsLeft > 0)} roundId={room.round?.id ?? ''} sampleEnabled={Boolean(!waitingForPlayers && isHost && aiSession && room.aiEnabled && room.phase === 'drawing' && secondsLeft > 0)} onSnapshot={inspectDrawing} onReadyChange={setWhiteboardReady} />
            {room.phase === 'choosing' && isArtist ? <div className="dg-word-picker"><span className={`dg-word-picker__board-status ${whiteboardReady ? 'is-ready' : 'is-loading'}`}>{whiteboardReady ? '✓ Whiteboard ready' : '◌ Connecting Agora Whiteboard…'}</span><span className="dg-eyebrow">YOUR TURN TO DRAW</span><h2>Choose a word</h2><div>{room.round?.choices?.map((choice) => <button key={choice} disabled={!whiteboardReady} onClick={() => void act('choose-word', choice)}>{choice}</button>)}</div></div> : room.phase === 'choosing' ? <div className="dg-word-picker"><div className="dg-loader">✎</div><h2>{playerName(room, room.round?.artistId ?? null)} is choosing…</h2><small>Getting the next turn ready.</small></div> : null}
            {room.phase === 'result' && <div className={`dg-result-overlay ${resultTimedOut || resultInterrupted ? 'is-timeout' : ''}`}><span>{resultInterrupted ? '↗ ARTIST LEFT' : resultTimedOut ? '⌛ ROUND OVER' : room.round?.winnerType === 'ai' ? '✦ AI VERIFIED' : '✓ CORRECT GUESS'}</span><h2>{resultInterrupted ? 'TURN SKIPPED' : resultTimedOut ? 'TIME’S UP!' : `${playerName(room, room.round?.winnerId ?? null)} wins!`}</h2><p>{resultInterrupted ? 'The artist disconnected, so nobody scores this turn.' : <>The word was <strong>{room.round?.secretWord}</strong>.</>}</p>{isHost ? <button className="dg-button dg-button--yellow" disabled={nextTurnPending} onClick={() => void nextTurn()}>{nextTurnPending ? 'Loading scores…' : (room.round?.number ?? 0) >= room.roundsTotal ? 'See final scores' : 'Next turn →'}</button> : <small>Next turn starts automatically…</small>}</div>}
            {waitingForPlayers && <div className="dg-player-shortage" role="status" aria-live="assertive"><span className="dg-eyebrow">GAME PAUSED</span><h2>Waiting for a player.</h2><p>The timer is safe. The game continues when two humans are back.</p><strong>{waitingSeconds}s</strong></div>}
          </section>
          <aside className="dg-panel dg-chat-panel"><div className="dg-panel-title"><span>GUESSES</span><strong>{room.messages.length}</strong></div><div className="dg-chat-log">{room.messages.length === 0 && <p className="dg-empty">No guesses yet. Watch the drawing!</p>}{room.messages.map((message) => <div className={`dg-chat-message is-${message.correctness}`} key={message.id}><strong>{message.source === 'ai' ? '✦ FastH3' : playerName(room, message.playerId)}</strong><span>{message.content}</span>{message.correctness === 'close' && <em>Close!</em>}</div>)}</div>{room.aiEnabled && room.phase === 'drawing' ? <aside className={`dg-ai-race dg-ai-race--sidebar is-${room.aiPhase}`} aria-live="polite"><div className="dg-ai-race__head"><span className="dg-ai-race__orb">✦</span><div><b>FASTH3 · SHARED LIVE</b><strong>{waitingForPlayers ? 'PAUSED FOR PLAYERS' : aiStage}</strong></div>{aiElapsedMs !== null && <time><small>TOTAL</small>{(aiElapsedMs / 1000).toFixed(1)}s</time>}</div>{room.aiActivity && <div className="dg-ai-race__candidate"><span>CURRENT IDEA · EVERY PLAYER</span><strong>“{room.aiActivity.guess}”</strong><small>{Math.round(room.aiActivity.confidence * 100)}% confidence · {room.aiActivity.reason}</small></div>}<div className="dg-ai-race__track"><i /></div>{room.aiActivity && <div className="dg-ai-race__metrics"><span>Vision <b>{room.aiActivity.visionMs === null ? '…' : `${(room.aiActivity.visionMs / 1000).toFixed(1)}s`}</b></span><span>Video <b>{room.aiActivity.generationMs === null ? room.aiPhase === 'generating' ? 'LIVE' : '—' : `${(room.aiActivity.generationMs / 1000).toFixed(1)}s`}</b></span><span>Verify <b>{room.aiActivity.verificationMs === null ? room.aiPhase === 'verifying' ? 'LIVE' : '—' : `${(room.aiActivity.verificationMs / 1000).toFixed(1)}s`}</b></span></div>}<div className="dg-ai-race__proof-slot" ref={setProofPortal}>{!isHost && <SharedFastH3Video track={remoteFastH3Track} active={aiVideoActive} />}</div>{proofNote && <p className="dg-ai-race__note">{proofNote}</p>}</aside> : <div className={`dg-ai-card is-${room.aiPhase}`}><div><span>✦</span><strong>FASTH3 · AI</strong></div><p>{room.aiEnabled ? room.aiPhase === 'watching' ? 'Watching the drawing and preparing guesses.' : room.aiPhase === 'thinking' ? 'Reading the latest strokes…' : room.aiPhase === 'generating' ? `Generating video proof for “${room.aiActivity?.guess ?? 'its guess'}”…` : room.aiPhase === 'verifying' ? 'OpenAI is checking the generated video…' : room.aiPhase === 'verified' ? 'Proof accepted.' : room.aiPhase === 'failed' ? 'Proof unavailable. Humans can keep guessing.' : room.aiPhase : 'Not invited to this room.'}</p></div>}{!waitingForPlayers && !isArtist && room.phase === 'drawing' && secondsLeft > 0 && <div className="dg-guess-input"><input value={guess} onChange={(event) => setGuess(event.target.value)} placeholder="Type your guess…" maxLength={80} onKeyDown={(event) => { if (event.key === 'Enter') void submitGuess() }} /><button onClick={() => void submitGuess()}>↑</button></div>}{!waitingForPlayers && !isArtist && room.phase === 'drawing' && secondsLeft === 0 && <p className="dg-settling">Time’s up — settling the round…</p>}</aside>
        </section>
      )}

      <footer className="dg-game-footer" aria-label="Room controls">
        <div className="dg-footer-realtime" aria-label="Agora realtime services">
          <button
            className={`dg-footer-control dg-footer-control--voice is-${voiceState}`}
            onClick={() => { if (voiceControl.action === 'leave') void disconnectVoice(); else if (voiceControl.action === 'join') void connectVoice() }}
            disabled={voiceControl.action === 'none'}
            aria-pressed={voiceState === 'live'}
            aria-label={`${voiceControl.label}. ${voiceControl.detail}`}
          >
            <span className="dg-footer-control__icon" aria-hidden="true">{voiceControl.icon}</span>
            <span><b>{voiceControl.label}</b><small>{voiceControl.detail}</small></span>
          </button>
          <span className={`dg-sync-indicator is-${whiteboardStatus.state}`} role="status" aria-live="polite" aria-label={whiteboardStatus.label} title={whiteboardStatus.label}>
            <i aria-hidden="true" /><span><b>Whiteboard</b><small>{whiteboardStatus.detail}</small></span>
          </span>
        </div>
        <div className="dg-footer-utilities">
          <button className={`dg-footer-icon-button dg-sound-toggle ${soundEnabled ? 'is-on' : 'is-muted'}`} onClick={() => void toggleSound()} aria-label={soundEnabled ? 'Mute game sounds' : 'Turn on game sounds'} aria-pressed={soundEnabled} title={soundEnabled ? 'Mute game sounds' : 'Turn on game sounds'}>
            <span aria-hidden="true">{soundEnabled ? '🔊' : '🔇'}</span>
          </button>
          <button className="dg-footer-mini-button dg-footer-mini-button--rules" onClick={() => setRulesOpen(true)} aria-label="How to play">
            <span aria-hidden="true">?</span> Rules
          </button>
          <a className="dg-footer-mini-button dg-footer-mini-button--leave" href="/" aria-label="Leave room and return home" aria-disabled={leavePending} onClick={(event) => void leaveRoom(event)}>
            {leavePending ? 'Leaving…' : 'Exit'} <span aria-hidden="true">↗</span>
          </a>
        </div>
      </footer>
      {aiSession && <ReactorProof jwt={aiSession.jwt} job={proof?.prompt ? { attemptId: proof.attemptId, prompt: proof.prompt } : null} portalTarget={proofPortal} onReady={(frames, metrics) => void verifyVideo(frames, metrics.generationMs)} onError={(message, metrics) => void failProof(message, metrics?.generationMs)} onVideoTrack={relayFastH3Video} />}
      {error && <div className="dg-toast" role="alert">{error}<button onClick={() => setError('')}>×</button></div>}
      <GameRulesDialog open={rulesOpen} onClose={() => setRulesOpen(false)} />
      {needsPlayerOpen && <div className="dg-modal-backdrop"><section className="dg-modal dg-start-check" role="dialog" aria-modal="true" aria-labelledby="needs-player-title"><span className="dg-start-check__orb" aria-hidden="true">↗</span><span className="dg-eyebrow">ONE MORE PLAYER NEEDED</span><h2 id="needs-player-title">Invite a friend first.</h2><p>Draw &amp; Guess needs at least two online human players—one to draw and one to guess.</p><div className="dg-ai-confirm__rule"><strong>Your room is ready</strong><span>Copy the link and send it to one friend. You can start as soon as they appear in Players.</span></div><div className="dg-modal-actions"><button className="dg-button dg-button--paper" onClick={() => setNeedsPlayerOpen(false)}>Close</button><button className="dg-button dg-button--yellow" onClick={async () => { await copyInvite(); setNeedsPlayerOpen(false) }}>Copy invite link</button></div></section></div>}
      {aiConfirmMode && <ReactorKeyDialog mode={aiConfirmMode} initialError={reactorSetupError} onVerified={finishFastH3Setup} onContinue={continueWithoutFastH3} onClose={() => setAiConfirmMode(null)} />}
    </main>
  )
}
