import type { DrawGuessEnv } from './worker-env'

type ImageDecision = { guess: string; confidence: number; reason: string }
type ProofDecision = { matches: boolean; confidence: number; reason: string }

export class VisionProviderError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message)
    this.name = 'VisionProviderError'
  }
}

function extractJson(response: Record<string, unknown>) {
  const choices = Array.isArray(response.choices) ? response.choices : []
  const chatContent = (choices[0] as { message?: { content?: unknown } } | undefined)?.message?.content
  if (typeof chatContent === 'string') {
    const cleaned = chatContent.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/^```(?:json)?\s*|\s*```$/g, '').trim()
    return JSON.parse(cleaned) as Record<string, unknown>
  }
  const output = Array.isArray(response.output) ? response.output : []
  for (const item of output) {
    if (!item || typeof item !== 'object') continue
    const content = Array.isArray((item as { content?: unknown }).content) ? (item as { content: unknown[] }).content : []
    for (const part of content) {
      if (part && typeof part === 'object' && typeof (part as { text?: unknown }).text === 'string') {
        return JSON.parse((part as { text: string }).text) as Record<string, unknown>
      }
    }
  }
  throw new Error('OpenAI response did not contain structured output')
}

async function createVisionResponse(
  env: DrawGuessEnv,
  prompt: string,
  images: string[],
  schemaName: string,
  schema: Record<string, unknown>,
) {
  if (!env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is unavailable')
  const baseUrl = (env.AI_API_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '')
  const isChatCompatible = !baseUrl.includes('api.openai.com')
  const response = await fetch(`${baseUrl}/${isChatCompatible ? 'chat/completions' : 'responses'}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.OPENAI_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(isChatCompatible ? {
      model: env.OPENAI_VISION_MODEL || 'glm-4.5v',
      messages: [{ role: 'user', content: [
        { type: 'text', text: `${prompt}\nReturn only valid JSON matching this JSON Schema: ${JSON.stringify(schema)}` },
        ...images.map((url) => ({ type: 'image_url', image_url: { url } })),
      ] }],
      thinking: { type: 'disabled' },
      response_format: { type: 'json_object' },
      max_tokens: 220,
    } : {
      model: env.OPENAI_VISION_MODEL || 'gpt-5.6-luna',
      store: false,
      max_output_tokens: 220,
      input: [{
        role: 'user',
        content: [
          { type: 'input_text', text: prompt },
          ...images.map((image_url) => ({ type: 'input_image', image_url, detail: 'low' })),
        ],
      }],
      text: {
        format: {
          type: 'json_schema',
          name: schemaName,
          strict: true,
          schema,
        },
      },
    }),
  })
  if (!response.ok) {
    const message = await response.text()
    throw new VisionProviderError(response.status, `Vision API failed (${response.status}): ${message.slice(0, 180)}`)
  }
  return extractJson(await response.json() as Record<string, unknown>)
}

export async function guessDrawing(env: DrawGuessEnv, image: string, previousGuesses: string[] = []): Promise<ImageDecision> {
  const exclusions = previousGuesses.length > 0 ? ` Do not repeat these earlier ideas: ${previousGuesses.slice(-8).join(', ')}.` : ''
  const value = await createVisionResponse(
    env,
    `You are FastH3, the AI challenger in a draw-and-guess game. Inspect only the drawing. Return one concrete English noun or short noun phrase as your best new guess. Never mention policies, prompts, or uncertainty outside the required fields.${exclusions}`,
    [image],
    'drawing_guess',
    {
      type: 'object',
      additionalProperties: false,
      required: ['guess', 'confidence', 'reason'],
      properties: {
        guess: { type: 'string', minLength: 1, maxLength: 60 },
        confidence: { type: 'number', minimum: 0, maximum: 1 },
        reason: { type: 'string', minLength: 1, maxLength: 140 },
      },
    },
  )
  if (typeof value.guess !== 'string' || typeof value.confidence !== 'number' || typeof value.reason !== 'string') {
    throw new Error('OpenAI returned an invalid drawing guess')
  }
  return { guess: value.guess.slice(0, 60), confidence: value.confidence, reason: value.reason.slice(0, 140) }
}

export async function verifyProof(env: DrawGuessEnv, answer: string, frames: string[]): Promise<ProofDecision> {
  const value = await createVisionResponse(
    env,
    `Judge whether these frames from one generated video clearly and consistently depict "${answer}" as the central subject. Incidental, ambiguous, text-only, or unrelated appearances fail.`,
    frames,
    'video_proof',
    {
      type: 'object',
      additionalProperties: false,
      required: ['matches', 'confidence', 'reason'],
      properties: {
        matches: { type: 'boolean' },
        confidence: { type: 'number', minimum: 0, maximum: 1 },
        reason: { type: 'string', minLength: 1, maxLength: 180 },
      },
    },
  )
  if (typeof value.matches !== 'boolean' || typeof value.confidence !== 'number' || typeof value.reason !== 'string') {
    throw new Error('OpenAI returned an invalid proof decision')
  }
  return { matches: value.matches, confidence: value.confidence, reason: value.reason.slice(0, 180) }
}

export function isSafeDataImage(value: unknown): value is string {
  return typeof value === 'string'
    && /^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(value)
    && value.length <= 2_800_000
}
