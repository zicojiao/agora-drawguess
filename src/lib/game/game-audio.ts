export type CountdownCue = 'none' | 'tick' | 'urgent' | 'final'

export function countdownCue(secondsLeft: number): CountdownCue {
  if (secondsLeft === 0) return 'final'
  if (secondsLeft > 0 && secondsLeft <= 3) return 'urgent'
  if (secondsLeft > 3 && secondsLeft <= 10) return 'tick'
  return 'none'
}

type Tone = { frequency: number; duration: number; offset?: number; volume?: number }

export class GameAudio {
  private context: AudioContext | null = null

  async unlock() {
    const context = this.getContext()
    if (context?.state === 'suspended') await context.resume().catch(() => undefined)
  }

  play(cue: CountdownCue | 'your-turn' | 'correct' | 'round-end') {
    const context = this.getContext()
    if (!context || context.state !== 'running' || document.visibilityState === 'hidden') return

    const tones: Tone[] = cue === 'tick'
      ? [{ frequency: 620, duration: 0.055, volume: 0.045 }]
      : cue === 'urgent'
        ? [{ frequency: 820, duration: 0.075, volume: 0.07 }, { frequency: 980, duration: 0.05, offset: 0.09, volume: 0.045 }]
        : cue === 'final' || cue === 'round-end'
          ? [{ frequency: 330, duration: 0.12, volume: 0.07 }, { frequency: 220, duration: 0.28, offset: 0.13, volume: 0.065 }]
          : cue === 'your-turn'
            ? [{ frequency: 523, duration: 0.1 }, { frequency: 659, duration: 0.1, offset: 0.11 }, { frequency: 784, duration: 0.2, offset: 0.22 }]
            : cue === 'correct'
              ? [{ frequency: 659, duration: 0.1 }, { frequency: 784, duration: 0.1, offset: 0.1 }, { frequency: 1047, duration: 0.24, offset: 0.2 }]
              : []

    for (const tone of tones) this.tone(context, tone)
  }

  close() {
    void this.context?.close()
    this.context = null
  }

  private getContext() {
    if (typeof window === 'undefined') return null
    const Context = window.AudioContext
    if (!Context) return null
    this.context ??= new Context()
    return this.context
  }

  private tone(context: AudioContext, tone: Tone) {
    const start = context.currentTime + (tone.offset ?? 0)
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(tone.frequency, start)
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(tone.volume ?? 0.06, start + 0.008)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + tone.duration)
    oscillator.connect(gain).connect(context.destination)
    oscillator.start(start)
    oscillator.stop(start + tone.duration + 0.01)
  }
}
