import { useEffect, useRef, useState } from 'react'
import type { PublicGameRoom } from '#/lib/game/model'
import { colorsMatch, DRAWING_COLOR_OPTIONS, DRAWING_WIDTHS, enableWhiteboardUndo, hasVisibleDrawing, isWhiteboardReady, resetWhiteboardForRound, shouldClearForRound, type DrawingColor, type DrawingTool, type WhiteboardConnectionStatus } from '#/lib/game/whiteboard-state'

type WhiteboardCredentials = NonNullable<PublicGameRoom['whiteboard']>
let whiteboardSdkPromise: Promise<typeof import('white-web-sdk')> | null = null

export function preloadAgoraWhiteboardSdk() {
  whiteboardSdkPromise ??= import('white-web-sdk').catch((error) => {
    whiteboardSdkPromise = null
    throw error
  })
  return whiteboardSdkPromise
}

export function AgoraGameBoard({ credentials, canDraw, roundId, sampleEnabled, onSnapshot, onReadyChange }: {
  credentials?: WhiteboardCredentials
  canDraw: boolean
  roundId: string
  sampleEnabled: boolean
  onSnapshot: (image: string) => void
  onReadyChange?: (ready: boolean) => void
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const fallbackRef = useRef<HTMLCanvasElement>(null)
  const roomRef = useRef<import('white-web-sdk').Room | null>(null)
  const [status, setStatus] = useState<WhiteboardConnectionStatus>(credentials ? 'loading' : 'local')
  const [tool, setTool] = useState<DrawingTool>('pencil')
  const [color, setColor] = useState<DrawingColor>(DRAWING_COLOR_OPTIONS[0].rgb)
  const [strokeWidth, setStrokeWidth] = useState<number>(DRAWING_WIDTHS[1])
  const [agoraUndoSteps, setAgoraUndoSteps] = useState(0)
  const [fallbackUndoSteps, setFallbackUndoSteps] = useState(0)
  const dirtyRef = useRef(false)
  const clearedRoundRef = useRef<string | null>(null)
  const fallbackHistoryRef = useRef<ImageData[]>([])

  useEffect(() => {
    if (!credentials || !hostRef.current) { setStatus('local'); return }
    let cancelled = false
    let room: import('white-web-sdk').Room | null = null
    const connect = async () => {
      try {
        const { WhiteWebSdk } = await preloadAgoraWhiteboardSdk()
        const sdk = new WhiteWebSdk({ appIdentifier: credentials.appIdentifier, region: credentials.region, useMobXState: false })
        room = await sdk.joinRoom({
          uuid: credentials.uuid,
          uid: credentials.uid,
          roomToken: credentials.roomToken,
          region: credentials.region,
          isWritable: credentials.writable,
          userPayload: { name: credentials.uid },
        }, {
          onRoomStateChanged: () => { dirtyRef.current = true },
          onCanUndoStepsUpdate: (steps) => setAgoraUndoSteps(steps),
        })
        if (cancelled) { await room.disconnect(); return }
        room.bindHtmlElement(hostRef.current)
        room.disableDeviceInputs = !canDraw
        setAgoraUndoSteps(enableWhiteboardUndo(room, credentials.writable))
        if (canDraw) room.setMemberState({ currentApplianceName: 'pencil' as import('white-web-sdk').ApplianceNames, strokeColor: color, strokeWidth })
        roomRef.current = room
        setStatus('agora')
      } catch (error) {
        console.error('Agora Whiteboard connection failed', error)
        setStatus('error')
      }
    }
    void connect()
    return () => { cancelled = true; roomRef.current = null; if (room) { room.bindHtmlElement(null); void room.disconnect() } }
  }, [credentials?.uuid, credentials?.uid, credentials?.roomToken])

  useEffect(() => {
    onReadyChange?.(isWhiteboardReady(status))
  }, [onReadyChange, status])

  useEffect(() => {
    const room = roomRef.current
    if (!room) return
    void room.setWritable(canDraw).then(() => {
      room.disableDeviceInputs = !canDraw
      if (canDraw) {
        room.setMemberState({
          currentApplianceName: tool as import('white-web-sdk').ApplianceNames,
          strokeColor: color,
          strokeWidth: tool === 'eraser' ? 18 : strokeWidth,
          fillColor: tool === 'rectangle' || tool === 'ellipse' ? color : undefined,
        })
      }
    }).catch(() => undefined)
  }, [canDraw])

  useEffect(() => {
    const host = hostRef.current
    if (!host || status !== 'agora' || !canDraw) return
    const markLocalStroke = () => { dirtyRef.current = true }
    host.addEventListener('pointerup', markLocalStroke, true)
    host.addEventListener('mouseup', markLocalStroke, true)
    host.addEventListener('touchend', markLocalStroke, true)
    return () => {
      host.removeEventListener('pointerup', markLocalStroke, true)
      host.removeEventListener('mouseup', markLocalStroke, true)
      host.removeEventListener('touchend', markLocalStroke, true)
    }
  }, [canDraw, status])

  useEffect(() => {
    const room = roomRef.current
    if (!room || !canDraw) return
    room.setMemberState({
      currentApplianceName: tool as import('white-web-sdk').ApplianceNames,
      strokeColor: color,
      strokeWidth: tool === 'eraser' ? 18 : strokeWidth,
      fillColor: tool === 'rectangle' || tool === 'ellipse' ? color : undefined,
    })
  }, [canDraw, color, status, strokeWidth, tool])

  useEffect(() => {
    const room = roomRef.current
    const boardReady = Boolean(room) || Boolean(fallbackRef.current && status !== 'loading')
    if (!shouldClearForRound({ canDraw, roundId, clearedRoundId: clearedRoundRef.current, boardReady })) return
    if (room) {
      resetWhiteboardForRound(room)
      setAgoraUndoSteps(0)
    }
    const canvas = fallbackRef.current
    const context = canvas?.getContext('2d')
    if (canvas && context) {
      context.fillStyle = '#fff'
      context.fillRect(0, 0, canvas.width, canvas.height)
    }
    clearedRoundRef.current = roundId
    fallbackHistoryRef.current = []
    setFallbackUndoSteps(0)
    dirtyRef.current = false
  }, [canDraw, roundId, status])

  const undo = () => {
    if (!canDraw) return
    if (roomRef.current) {
      roomRef.current.undo()
      setAgoraUndoSteps(roomRef.current.canUndoSteps)
      dirtyRef.current = true
      return
    }
    const canvas = fallbackRef.current
    const context = canvas?.getContext('2d')
    const previous = fallbackHistoryRef.current.pop()
    if (canvas && context && previous) {
      context.putImageData(previous, 0, 0)
      setFallbackUndoSteps(fallbackHistoryRef.current.length)
      dirtyRef.current = true
    }
  }

  useEffect(() => {
    if (!canDraw) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); undo(); return }
      if (event.key.toLowerCase() === 'p') setTool('pencil')
      if (event.key.toLowerCase() === 'e') setTool('eraser')
      if (event.key.toLowerCase() === 'r') setTool('rectangle')
      if (event.key.toLowerCase() === 'o') setTool('ellipse')
      if (event.key === '[') setStrokeWidth((width) => DRAWING_WIDTHS[Math.max(0, DRAWING_WIDTHS.indexOf(width as typeof DRAWING_WIDTHS[number]) - 1)])
      if (event.key === ']') setStrokeWidth((width) => DRAWING_WIDTHS[Math.min(DRAWING_WIDTHS.length - 1, DRAWING_WIDTHS.indexOf(width as typeof DRAWING_WIDTHS[number]) + 1)])
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [canDraw])

  useEffect(() => {
    if (!sampleEnabled) return
    const timer = window.setInterval(async () => {
      if (!dirtyRef.current) return
      if (roomRef.current) {
        const room = roomRef.current
        const transparent = document.createElement('canvas')
        transparent.width = 800; transparent.height = 450
        const transparentContext = transparent.getContext('2d')
        if (!transparentContext) return
        try {
          await room.screenshotToCanvasAsync(transparentContext, room.state.sceneState.scenePath, 800, 450, room.state.cameraState)
          const pixels = transparentContext.getImageData(0, 0, transparent.width, transparent.height).data
          if (!hasVisibleDrawing(pixels)) { dirtyRef.current = false; return }
          const canvas = document.createElement('canvas')
          canvas.width = 800; canvas.height = 450
          const context = canvas.getContext('2d')
          if (!context) return
          context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height)
          context.drawImage(transparent, 0, 0)
          dirtyRef.current = false
          onSnapshot(canvas.toDataURL('image/jpeg', .78))
        } catch { /* The next interval can retry. */ }
      } else if (fallbackRef.current) {
        const context = fallbackRef.current.getContext('2d')
        if (!context || !hasVisibleDrawing(context.getImageData(0, 0, fallbackRef.current.width, fallbackRef.current.height).data)) { dirtyRef.current = false; return }
        dirtyRef.current = false
        onSnapshot(fallbackRef.current.toDataURL('image/jpeg', .78))
      }
    }, 4_000)
    return () => window.clearInterval(timer)
  }, [sampleEnabled, onSnapshot])

  useEffect(() => {
    const canvas = fallbackRef.current
    if (!canvas || status === 'agora') return
    const context = canvas.getContext('2d')
    if (!context) return
    const resize = () => {
      const old = document.createElement('canvas'); old.width = canvas.width; old.height = canvas.height
      old.getContext('2d')?.drawImage(canvas, 0, 0)
      const ratio = window.devicePixelRatio || 1
      canvas.width = canvas.clientWidth * ratio; canvas.height = canvas.clientHeight * ratio
      context.setTransform(ratio, 0, 0, ratio, 0, 0); context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight)
      context.drawImage(old, 0, 0, canvas.clientWidth, canvas.clientHeight)
    }
    resize(); window.addEventListener('resize', resize)
    let drawing = false
    let startPoint: readonly [number, number] | null = null
    const point = (event: PointerEvent) => { const box = canvas.getBoundingClientRect(); return [event.clientX - box.left, event.clientY - box.top] as const }
    const down = (event: PointerEvent) => {
      if (!canDraw) return
      fallbackHistoryRef.current.push(context.getImageData(0, 0, canvas.width, canvas.height))
      if (fallbackHistoryRef.current.length > 20) fallbackHistoryRef.current.shift()
      setFallbackUndoSteps(fallbackHistoryRef.current.length)
      drawing = true; canvas.setPointerCapture(event.pointerId); startPoint = point(event)
      context.beginPath(); context.moveTo(...startPoint)
    }
    const move = (event: PointerEvent) => {
      if (!drawing || !canDraw || (tool !== 'pencil' && tool !== 'eraser')) return
      const [x, y] = point(event); context.strokeStyle = tool === 'eraser' ? '#fff' : `rgb(${color.join(',')})`; context.lineWidth = tool === 'eraser' ? 28 : strokeWidth; context.lineCap = 'round'; context.lineJoin = 'round'; context.lineTo(x, y); context.stroke(); dirtyRef.current = true
    }
    const up = (event: PointerEvent) => {
      if (drawing && startPoint && (tool === 'rectangle' || tool === 'ellipse')) {
        const [x, y] = point(event); const [startX, startY] = startPoint
        context.fillStyle = `rgb(${color.join(',')})`; context.strokeStyle = `rgb(${color.join(',')})`; context.lineWidth = strokeWidth
        context.beginPath()
        if (tool === 'rectangle') context.rect(startX, startY, x - startX, y - startY)
        else context.ellipse((startX + x) / 2, (startY + y) / 2, Math.abs(x - startX) / 2, Math.abs(y - startY) / 2, 0, 0, Math.PI * 2)
        context.fill(); context.stroke(); dirtyRef.current = true
      }
      drawing = false; startPoint = null
    }
    canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up)
    return () => { window.removeEventListener('resize', resize); canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', up) }
  }, [canDraw, color, status, strokeWidth, tool])

  const clear = () => {
    if (!canDraw) return
    if (roomRef.current) roomRef.current.cleanCurrentScene(false)
    const canvas = fallbackRef.current; const context = canvas?.getContext('2d')
    if (canvas && context) {
      fallbackHistoryRef.current.push(context.getImageData(0, 0, canvas.width, canvas.height))
      if (fallbackHistoryRef.current.length > 20) fallbackHistoryRef.current.shift()
      setFallbackUndoSteps(fallbackHistoryRef.current.length)
      context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height); dirtyRef.current = true
    }
  }

  const canUndo = canDraw && (status === 'agora' ? agoraUndoSteps > 0 : fallbackUndoSteps > 0)

  return (
    <div className="dg-board-wrap">
      {canDraw && <div className="dg-board-tools" aria-label="Drawing tools">
        <button className={`dg-tool ${tool === 'pencil' ? 'is-selected' : ''}`} aria-pressed={tool === 'pencil'} onPointerUp={(event) => event.currentTarget.blur()} onClick={() => setTool('pencil')}><span aria-hidden="true">✎</span> Pencil</button>
        <div className="dg-color-palette" aria-label="Brush colors">
        {DRAWING_COLOR_OPTIONS.map(({ name, rgb }) => {
          const selected = tool !== 'eraser' && colorsMatch(color, rgb)
          return <button key={name} className={`dg-color ${selected ? 'is-selected' : ''}`} style={{ backgroundColor: `rgb(${rgb.join(',')})` }} title={name} aria-label={`Use ${name}`} aria-pressed={selected} onPointerUp={(event) => event.currentTarget.blur()} onClick={() => { setTool((current) => current === 'eraser' ? 'pencil' : current); setColor(rgb) }}><span aria-hidden="true">✓</span></button>
        })}
        </div>
        <span className="dg-tool-divider" aria-hidden="true" />
        <div className="dg-size-group" aria-label="Brush size">{DRAWING_WIDTHS.map((width, index) => <button key={width} className={`dg-size ${strokeWidth === width ? 'is-selected' : ''}`} aria-label={`${['Small', 'Medium', 'Large'][index]} brush`} aria-pressed={strokeWidth === width} onClick={() => setStrokeWidth(width)}><span style={{ width: index * 4 + 5, height: index * 4 + 5 }} /></button>)}</div>
        <button className={`dg-tool dg-tool--icon ${tool === 'rectangle' ? 'is-selected' : ''}`} aria-label="Filled rectangle (R)" aria-pressed={tool === 'rectangle'} onClick={() => setTool('rectangle')}><span aria-hidden="true">■</span></button>
        <button className={`dg-tool dg-tool--icon ${tool === 'ellipse' ? 'is-selected' : ''}`} aria-label="Filled ellipse (O)" aria-pressed={tool === 'ellipse'} onClick={() => setTool('ellipse')}><span aria-hidden="true">●</span></button>
        <button className={`dg-tool ${tool === 'eraser' ? 'is-selected' : ''}`} aria-pressed={tool === 'eraser'} onPointerUp={(event) => event.currentTarget.blur()} onClick={() => setTool('eraser')}><span aria-hidden="true">▱</span> Eraser</button>
        <span className="dg-tool-divider" aria-hidden="true" />
        <button className="dg-tool dg-tool--action dg-tool--undo" disabled={!canUndo} aria-label={canUndo ? 'Undo last drawing action' : 'Nothing to undo'} onPointerUp={(event) => event.currentTarget.blur()} onClick={undo}><span aria-hidden="true">↶</span> Undo</button>
        <button className="dg-tool dg-tool--action dg-tool--clear" onPointerUp={(event) => event.currentTarget.blur()} onClick={clear}>Clear</button>
      </div>}
      <div ref={hostRef} className={`dg-whiteboard ${status === 'agora' ? 'is-active' : ''}`} />
      {(status === 'local' || status === 'error') && <canvas ref={fallbackRef} className="dg-whiteboard dg-whiteboard--fallback" aria-label="Drawing board" />}
      {status === 'loading' && <div className="dg-board-loading" role="status"><span className="dg-loader">✎</span><strong>Connecting whiteboard…</strong><small>Your turn starts after Agora is ready.</small></div>}
      <span className={`dg-board-status dg-board-status--${status}`}>{status === 'agora' ? '● Agora Whiteboard live' : status === 'loading' ? 'Connecting whiteboard…' : status === 'error' ? 'Whiteboard unavailable · local sketchpad' : 'Local sketchpad · add Whiteboard credentials to sync'}</span>
    </div>
  )
}
