import { describe, expect, it } from 'vitest'
import { rmsOf } from './level-meter'

describe('live level meter', () => {
  it('measures normalized PCM with the expected RMS', () => {
    const sampleRate = 48_000
    const windowSamples = sampleRate * 0.05
    const float = new Float32Array(windowSamples)
    for (let index = 0; index < windowSamples; index += 1) {
      const value = 0.3 * Math.sin((2 * Math.PI * 440 * index) / sampleRate)
      float[index] = value
    }

    expect(rmsOf(float)).toBeCloseTo(0.3 * Math.SQRT1_2, 3)
  })

  it('reads a sine wave at its true RMS, not its peak', () => {
    const samples = new Float32Array(2_048)
    for (let index = 0; index < samples.length; index += 1) {
      samples[index] = Math.sin((2 * Math.PI * index) / 128)
    }

    expect(rmsOf(samples)).toBeCloseTo(Math.SQRT1_2, 3)
  })

  it('reports silence as zero', () => {
    expect(rmsOf(new Float32Array(512))).toBe(0)
    expect(rmsOf(new Float32Array(0))).toBe(0)
  })
})
