import { describe, expect, it } from 'vitest'
import { cleanText, json } from './http'

describe('game HTTP helpers', () => {
  it('normalizes nickname whitespace and length', () => {
    expect(cleanText('  Sketch   Master  ', 28)).toBe('Sketch Master')
    expect(cleanText('x'.repeat(40), 28)).toBe('x'.repeat(28))
  })

  it('returns private JSON responses', async () => {
    const response = json({ ready: true }, { status: 201 })

    expect(response.status).toBe(201)
    expect(response.headers.get('content-type')).toBe('application/json; charset=utf-8')
    expect(response.headers.get('cache-control')).toBe('no-store')
    await expect(response.json()).resolves.toEqual({ ready: true })
  })
})
