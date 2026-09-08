import { describe, expect, it } from 'vitest'
import { voiceControlCopy } from './voice-control'

describe('voice room control', () => {
  it('turns the connected state into an explicit leave action', () => {
    expect(voiceControlCopy('live', true)).toEqual({
      label: 'Leave voice',
      detail: 'Mic live · Agora RTC',
      icon: '×',
      action: 'leave',
    })
  })

  it('prevents duplicate actions while joining or leaving', () => {
    expect(voiceControlCopy('joining', true).action).toBe('none')
    expect(voiceControlCopy('leaving', true).action).toBe('none')
  })

  it('offers retry after a connection error and disables unavailable RTC', () => {
    expect(voiceControlCopy('error', true).action).toBe('join')
    expect(voiceControlCopy('off', true)).toMatchObject({ detail: 'Agora RTC audio', action: 'join' })
    expect(voiceControlCopy('off', false)).toMatchObject({ detail: 'Agora RTC offline', action: 'none' })
  })
})
