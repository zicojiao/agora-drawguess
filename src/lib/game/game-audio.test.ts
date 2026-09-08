import { describe, expect, it } from 'vitest'
import { countdownCue } from './game-audio'

describe('countdownCue', () => {
  it('is quiet before the final ten seconds', () => {
    expect(countdownCue(60)).toBe('none')
    expect(countdownCue(11)).toBe('none')
  })

  it('ticks for ten seconds and intensifies for the final three', () => {
    expect(countdownCue(10)).toBe('tick')
    expect(countdownCue(4)).toBe('tick')
    expect(countdownCue(3)).toBe('urgent')
    expect(countdownCue(1)).toBe('urgent')
  })

  it('plays a distinct final cue only at zero', () => {
    expect(countdownCue(0)).toBe('final')
    expect(countdownCue(-1)).toBe('none')
  })
})
