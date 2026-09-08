import { afterEach, describe, expect, it, vi } from 'vitest'
import { guessDrawing, isSafeDataImage, verifyProof } from './openai-vision'
import type { DrawGuessEnv } from './worker-env'

const env = {
  OPENAI_API_KEY: 'test-key',
  AI_API_BASE_URL: 'https://open.bigmodel.cn/api/paas/v4',
  OPENAI_VISION_MODEL: 'glm-4.5v',
} as DrawGuessEnv

afterEach(() => vi.unstubAllGlobals())

describe('OpenAI-compatible vision', () => {
  it('sends a Zhipu-compatible image request and parses a drawing guess', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: '{"guess":"cat","confidence":0.91,"reason":"pointed ears"}' } }],
    }), { status: 200, headers: { 'content-type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(guessDrawing(env, 'data:image/jpeg;base64,YQ==')).resolves.toEqual({
      guess: 'cat', confidence: 0.91, reason: 'pointed ears',
    })
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(String(init.body))
    expect(url).toBe('https://open.bigmodel.cn/api/paas/v4/chat/completions')
    expect(body.model).toBe('glm-4.5v')
    expect(body.thinking).toEqual({ type: 'disabled' })
    expect(body.messages[0].content[1]).toEqual({ type: 'image_url', image_url: { url: 'data:image/jpeg;base64,YQ==' } })
  })

  it('asks for a new idea instead of repeating earlier generated candidates', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: '{"guess":"fox","confidence":0.7,"reason":"pointed face"}' } }],
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await guessDrawing(env, 'data:image/jpeg;base64,YQ==', ['cat', 'dog'])
    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body))
    expect(body.messages[0].content[0].text).toContain('Do not repeat these earlier ideas: cat, dog')
  })

  it('parses proof verification and strips fenced JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: '```json\n{"matches":true,"confidence":0.88,"reason":"same subject"}\n```' } }],
    }), { status: 200 })))
    await expect(verifyProof(env, 'cat', ['data:image/jpeg;base64,YQ=='])).resolves.toEqual({
      matches: true, confidence: 0.88, reason: 'same subject',
    })
  })

  it('preserves provider status for quota handling', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"error":{"code":"1113"}}', { status: 429 })))
    await expect(guessDrawing(env, 'data:image/jpeg;base64,YQ==')).rejects.toMatchObject({ status: 429, name: 'VisionProviderError' })
  })
})

describe('image validation', () => {
  it('accepts supported data images and rejects remote or oversized input', () => {
    expect(isSafeDataImage('data:image/png;base64,YQ==')).toBe(true)
    expect(isSafeDataImage('https://example.com/image.png')).toBe(false)
    expect(isSafeDataImage(`data:image/png;base64,${'a'.repeat(2_800_000)}`)).toBe(false)
  })
})
