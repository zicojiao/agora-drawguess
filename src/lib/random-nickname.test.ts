import { describe, expect, it } from 'vitest'
import { createRandomNickname } from './random-nickname'

function sequence(...values: number[]) {
  let index = 0
  return () => values[index++] ?? values.at(-1) ?? 0
}

describe('createRandomNickname', () => {
  it('combines a playful adjective and animal', () => {
    expect(createRandomNickname('', sequence(0, 0))).toBe('Bouncy Badger')
  })

  it('does not return the same nickname twice in a row', () => {
    expect(createRandomNickname('Bouncy Badger', sequence(0, 0))).toBe('Bouncy Bunny')
  })

  it('always fits the nickname field', () => {
    for (let index = 0; index < 100; index += 1) {
      expect(createRandomNickname().length).toBeLessThanOrEqual(24)
    }
  })
})
