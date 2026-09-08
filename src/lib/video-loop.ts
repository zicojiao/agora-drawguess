export type VideoLoopRecording = {
  stop: () => Promise<Blob | null>
  cancel: () => void
}

export function startVideoLoopRecording(track: MediaStreamTrack): VideoLoopRecording | null {
  if (typeof MediaRecorder === 'undefined' || track.readyState === 'ended') return null
  const mimeType = [
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mp4',
  ].find((type) => MediaRecorder.isTypeSupported(type))

  let recorder: MediaRecorder
  try {
    recorder = new MediaRecorder(
      new MediaStream([track]),
      mimeType ? { mimeType, videoBitsPerSecond: 1_200_000 } : { videoBitsPerSecond: 1_200_000 },
    )
  } catch {
    return null
  }

  const chunks: Blob[] = []
  let cancelled = false
  let resolved = false
  let resolveDone: (blob: Blob | null) => void = () => undefined
  const done = new Promise<Blob | null>((resolve) => { resolveDone = resolve })
  const finish = (blob: Blob | null) => {
    if (resolved) return
    resolved = true
    resolveDone(blob)
  }

  recorder.addEventListener('dataavailable', (event) => {
    if (event.data.size > 0) chunks.push(event.data)
  })
  recorder.addEventListener('stop', () => {
    if (cancelled || chunks.length === 0) { finish(null); return }
    const blob = new Blob(chunks, { type: recorder.mimeType || mimeType || 'video/webm' })
    finish(blob.size > 0 ? blob : null)
  })
  recorder.addEventListener('error', () => finish(null))

  try {
    recorder.start(250)
  } catch {
    return null
  }

  return {
    stop: () => {
      if (recorder.state !== 'inactive') recorder.stop()
      return done
    },
    cancel: () => {
      cancelled = true
      if (recorder.state !== 'inactive') recorder.stop()
      else finish(null)
    },
  }
}
