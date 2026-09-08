import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { FastH3MainVideoView, FastH3Provider, useFastH3, useFastH3ClipFailed, useFastH3ClipFinished, useFastH3ClipStarted, useFastH3Track } from '@reactor-models/fast-h3'

function captureFrame(video: HTMLVideoElement) {
  const canvas = document.createElement('canvas')
  canvas.width = 640
  canvas.height = 360
  const context = canvas.getContext('2d')
  if (!context || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) throw new Error('Fast H3 video frame is not ready')
  context.drawImage(video, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', .78)
}

async function captureFrameWhenReady(video: HTMLVideoElement, timeoutMs = 4_000) {
  const deadline = Date.now() + timeoutMs
  while (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA && Date.now() < deadline) {
    await new Promise((resolve) => window.setTimeout(resolve, 100))
  }
  return captureFrame(video)
}

type ProofJob = { attemptId: string; prompt: string } | null

function ProofController({ job, portalTarget, onReady, onError, onVideoTrack }: { job: ProofJob; portalTarget: HTMLDivElement | null; onReady: (frames: string[], metrics: { generationMs: number }) => void; onError: (message: string, metrics?: { generationMs: number }) => void; onVideoTrack?: (track: MediaStreamTrack | null) => void }) {
  const { connect, disconnect, status, getState, setCanvas, setAutoplay, enqueue } = useFastH3()
  const videoTrack = useFastH3Track('main_video')
  const rootRef = useRef<HTMLDivElement>(null)
  const onErrorRef = useRef(onError)
  const queuedRef = useRef<string | null>(null)
  const framesRef = useRef<Promise<string[]> | null>(null)
  const requestedAtRef = useRef<number | null>(null)
  const [label, setLabel] = useState('Connecting to Fast H3…')
  useEffect(() => { onErrorRef.current = onError }, [onError])
  useEffect(() => {
    void connect().catch((error) => onErrorRef.current(error instanceof Error ? error.message : 'Fast H3 could not connect'))
    return () => { void disconnect() }
  }, [connect, disconnect])
  useEffect(() => {
    onVideoTrack?.(videoTrack ?? null)
    return () => { onVideoTrack?.(null) }
  }, [onVideoTrack, videoTrack])
  useEffect(() => {
    if (!job) { if (status === 'ready') setLabel('FastH3 warmed up · waiting for an idea'); return }
    if (status !== 'ready' || queuedRef.current === job.attemptId) return
    queuedRef.current = job.attemptId
    void (async () => {
      try {
        const state = await getState()
        if (state?.aspect !== '16:9') await setCanvas({ aspect: '16:9' })
        if (!state?.autoplay) await setAutoplay({ enabled: true })
        requestedAtRef.current = Date.now()
        const reply = await enqueue({ prompt: job.prompt, seconds: 5.167, metadata: JSON.stringify({ source: 'draw-and-guess-proof', attemptId: job.attemptId }) })
        if (!reply?.clip.clip_id) throw new Error('Fast H3 rejected the proof prompt')
        setLabel('Generating proof video…')
      } catch (error) { onError(error instanceof Error ? error.message : 'Fast H3 could not start', requestedAtRef.current ? { generationMs: Date.now() - requestedAtRef.current } : undefined) }
    })()
  }, [enqueue, getState, job, onError, setAutoplay, setCanvas, status])
  useFastH3ClipStarted(() => {
    const video = rootRef.current?.querySelector('video')
    if (!video) { onError('Fast H3 started without a playable video'); return }
    framesRef.current = (async () => {
      const frames: string[] = []
      for (const delay of [650, 1_650, 1_650]) {
        await new Promise((resolve) => window.setTimeout(resolve, delay))
        frames.push(await captureFrameWhenReady(video))
      }
      return frames
    })().catch((error) => {
      onError(error instanceof Error ? error.message : 'Fast H3 frames could not be captured', requestedAtRef.current ? { generationMs: Date.now() - requestedAtRef.current } : undefined)
      return []
    })
  })
  useFastH3ClipFinished(() => {
    void (async () => {
      if (!framesRef.current) { onError('Fast H3 finished without proof frames'); return }
      try {
        const frames = await framesRef.current
        if (frames.length !== 3) return
        setLabel('Proof video ready. Verifying…')
        onReady(frames, { generationMs: requestedAtRef.current ? Date.now() - requestedAtRef.current : 0 })
      } catch (error) {
        onError(error instanceof Error ? error.message : 'Fast H3 frames could not be captured')
      }
    })()
  })
  useFastH3ClipFailed((message) => onError(message.reason || 'Fast H3 could not generate this proof', requestedAtRef.current ? { generationMs: Date.now() - requestedAtRef.current } : undefined))
  const view = <div className={`dg-proof ${job ? 'is-active' : 'is-idle'} ${portalTarget ? '' : 'is-prewarming'}`} ref={rootRef}><div className="dg-proof__stage"><span className="dg-proof__scan" /><FastH3MainVideoView muted /></div><small><i />{label}</small></div>
  return portalTarget ? createPortal(view, portalTarget) : view
}

export function ReactorProof({ jwt, job, portalTarget, onReady, onError, onVideoTrack }: { jwt: string; job: ProofJob; portalTarget: HTMLDivElement | null; onReady: (frames: string[], metrics: { generationMs: number }) => void; onError: (message: string, metrics?: { generationMs: number }) => void; onVideoTrack?: (track: MediaStreamTrack | null) => void }) {
  return <FastH3Provider jwtToken={jwt} connectOptions={{ autoConnect: false }}><ProofController job={job} portalTarget={portalTarget} onReady={onReady} onError={onError} onVideoTrack={onVideoTrack} /></FastH3Provider>
}
