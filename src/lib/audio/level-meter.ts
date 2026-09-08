/** Root mean square of one window of normalized PCM samples. */
export function rmsOf(samples: Float32Array): number {
  if (samples.length === 0) return 0
  let sumSquares = 0
  for (const sample of samples) sumSquares += sample * sample
  return Math.sqrt(sumSquares / samples.length)
}

export type LevelMeter = {
  getLevel: () => number
  close: () => Promise<void>
}

/**
 * Reads the microphone level straight off the captured track.
 *
 * Measuring the captured media track keeps the UI independent from SDK-specific
 * volume normalization and makes the reported value deterministic.
 */
export async function createLevelMeter(track: MediaStreamTrack): Promise<LevelMeter> {
  const AudioContextClass = window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioContextClass) throw new Error('This browser does not support live audio analysis.')

  const context = new AudioContextClass()
  if (context.state === 'suspended') await context.resume()
  const source = context.createMediaStreamSource(new MediaStream([track]))
  const analyser = context.createAnalyser()
  // Roughly a 40–46ms analysis window at common browser sample rates.
  analyser.fftSize = 2_048
  analyser.smoothingTimeConstant = 0
  source.connect(analyser)
  const frame = new Float32Array(analyser.fftSize)

  return {
    getLevel: () => {
      analyser.getFloatTimeDomainData(frame)
      return rmsOf(frame)
    },
    close: async () => {
      source.disconnect()
      analyser.disconnect()
      await context.close().catch(() => undefined)
    },
  }
}
