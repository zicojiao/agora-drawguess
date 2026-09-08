import { afterEach, describe, expect, it, vi } from 'vitest'
import { startVideoLoopRecording } from './video-loop'

class FakeMediaStream {
  constructor(readonly tracks: MediaStreamTrack[]) {}
}

class FakeMediaRecorder extends EventTarget {
  static isTypeSupported(type: string) {
    return type === 'video/webm;codecs=vp8'
  }

  readonly mimeType: string
  state: RecordingState = 'inactive'

  constructor(_stream: MediaStream, options?: MediaRecorderOptions) {
    super()
    this.mimeType = options?.mimeType ?? 'video/webm'
  }

  start() {
    this.state = 'recording'
  }

  stop() {
    this.state = 'inactive'
    const dataEvent = new Event('dataavailable') as Event & { data: Blob }
    dataEvent.data = new Blob(['recorded-video'], { type: this.mimeType })
    this.dispatchEvent(dataEvent)
    this.dispatchEvent(new Event('stop'))
  }
}

function installMediaRecorder() {
  vi.stubGlobal('MediaStream', FakeMediaStream)
  vi.stubGlobal('MediaRecorder', FakeMediaRecorder)
}

afterEach(() => vi.unstubAllGlobals())

describe('FastH3 loop recording', () => {
  it('returns a playable recording after the live track finishes', async () => {
    installMediaRecorder()
    const recording = startVideoLoopRecording({ readyState: 'live' } as MediaStreamTrack)

    expect(recording).not.toBeNull()
    const blob = await recording!.stop()

    expect(blob?.type).toBe('video/webm;codecs=vp8')
    expect(blob?.size).toBeGreaterThan(0)
  })

  it('discards recorded data when the view is replaced or unmounted', async () => {
    installMediaRecorder()
    const recording = startVideoLoopRecording({ readyState: 'live' } as MediaStreamTrack)

    recording!.cancel()

    await expect(recording!.stop()).resolves.toBeNull()
  })

  it('falls back cleanly when recording is unavailable', () => {
    vi.stubGlobal('MediaRecorder', undefined)
    expect(startVideoLoopRecording({ readyState: 'live' } as MediaStreamTrack)).toBeNull()
  })
})
