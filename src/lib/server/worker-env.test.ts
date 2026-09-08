import { describe, expect, it, vi } from 'vitest'
import { withPrimaryD1Session, type DrawGuessEnv } from './worker-env'

vi.mock('cloudflare:workers', () => ({ env: {} }))

describe('withPrimaryD1Session', () => {
  it('anchors each game request to the D1 primary', () => {
    const session = { prepare: vi.fn(), batch: vi.fn() }
    const database = {
      prepare: vi.fn(),
      batch: vi.fn(),
      withSession: vi.fn(() => session),
    }
    const source = { DB: database } as unknown as DrawGuessEnv

    const result = withPrimaryD1Session(source)

    expect(database.withSession).toHaveBeenCalledWith('first-primary')
    expect(result.DB).toBe(session)
    expect(result).not.toBe(source)
  })

  it('supports lightweight database doubles without session support', () => {
    const source = {
      DB: { prepare: vi.fn(), batch: vi.fn() },
    } as unknown as DrawGuessEnv

    expect(withPrimaryD1Session(source)).toBe(source)
  })
})
