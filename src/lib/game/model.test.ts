import { describe, expect, it } from 'vitest'
import {
  artistAssistScore,
  canSettleWinner,
  createGameRoomId,
  editDistance,
  gameStartGate,
  gameChannelName,
  guesserScore,
  isCloseGuess,
  isCorrectGuess,
  isAiProofAccepted,
  isDrawingRoundExpired,
  normalizeGuess,
  progressiveHintIndexes,
  roundWordForViewer,
  wordHint,
} from './model'

describe('game model', () => {
  it('creates URL-safe room IDs that cannot be parsed as numbers', () => {
    expect(createGameRoomId(new Uint8Array([0, 1, 2, 3, 4, 5]))).toMatch(/^[a-z][a-z0-9]{5}$/)
  })

  it('normalizes punctuation, whitespace, case, and curated aliases', () => {
    expect(normalizeGuess('  CELL-phone!! ')).toBe('phone')
    expect(isCorrectGuess('Bike', 'bicycle')).toBe(true)
  })

  it('finds close guesses without accepting them as correct', () => {
    expect(editDistance('elefant', 'elephant')).toBe(2)
    expect(isCloseGuess('aplpe', 'apple')).toBe(false)
    expect(isCloseGuess('appl', 'apple')).toBe(true)
    expect(isCloseGuess('apple', 'apple')).toBe(false)
  })

  it('requires both the right idea and matching video for an AI win', () => {
    expect(isAiProofAccepted('cat', 'cat', true, .9)).toBe(true)
    expect(isAiProofAccepted('dog', 'cat', true, .9)).toBe(false)
    expect(isAiProofAccepted('cat', 'cat', false, .9)).toBe(false)
    expect(isAiProofAccepted('cat', 'cat', true, .64)).toBe(false)
  })

  it('builds hints without hiding separators', () => {
    expect(wordHint('ice-cream', new Set([0, 4]))).toBe('I _ _ - C _ _ _ _')
  })

  it('reveals progressive hint letters halfway through a turn', () => {
    expect([...progressiveHintIndexes('birthday cake', 0, 60_000, 29_999)]).toEqual([])
    expect([...progressiveHintIndexes('birthday cake', 0, 60_000, 30_000)]).toEqual([4])
    expect([...progressiveHintIndexes('birthday cake', 0, 60_000, 45_000)]).toEqual([4, 9])
  })

  it('rewards earlier guesses and prevents late winner settlement', () => {
    expect(guesserScore(1_000, 1_000, 2_000, 0)).toBe(1_000)
    expect(guesserScore(2_000, 1_000, 2_000, 0)).toBe(300)
    expect(guesserScore(1_010, 1_000, 2_000, 0)).toBeGreaterThan(guesserScore(1_900, 1_000, 2_000, 0))
    expect(artistAssistScore(1_000)).toBe(400)
    expect(artistAssistScore(100)).toBe(100)
    expect(canSettleWinner(null, 2_000, 2_000)).toBe(true)
    expect(canSettleWinner(null, 2_001, 2_000)).toBe(false)
    expect(canSettleWinner('player', 1_500, 2_000)).toBe(false)
  })

  it('derives one validated Agora channel name', () => {
    expect(gameChannelName('a23456')).toBe('drawguess_a23456')
    expect(() => gameChannelName('123456')).toThrow('Invalid game room ID')
  })

  it('detects expiry only for active drawing rounds', () => {
    expect(isDrawingRoundExpired({ phase: 'drawing', endsAt: 1_000 }, 1_000)).toBe(true)
    expect(isDrawingRoundExpired({ phase: 'drawing', endsAt: 1_001 }, 1_000)).toBe(false)
    expect(isDrawingRoundExpired({ phase: 'result', endsAt: 900 }, 1_000)).toBe(false)
  })

  it('requires another connected human before offering the optional FastH3 seat', () => {
    const host = { id: 'host', role: 'host' as const, connected: true }
    const guest = { id: 'guest', role: 'player' as const, connected: true }
    const offlineGuest = { ...guest, connected: false }
    const ai = { id: 'ai', role: 'ai' as const, connected: true }

    expect(gameStartGate([host], host.id, false)).toBe('needs-player')
    expect(gameStartGate([host, ai], host.id, true)).toBe('needs-player')
    expect(gameStartGate([host, offlineGuest], host.id, false)).toBe('needs-player')
    expect(gameStartGate([host, guest], host.id, false)).toBe('needs-ai')
    expect(gameStartGate([host, guest, ai], host.id, true)).toBe('ready')
  })

  it('never leaks the fallback word while the artist is choosing', () => {
    expect(roundWordForViewer({ phase: 'choosing', isArtist: true, secretWord: 'cat', revealed: new Set() })).toBe('CHOOSE A WORD')
    expect(roundWordForViewer({ phase: 'choosing', isArtist: false, secretWord: 'cat', revealed: new Set() })).toBe('CHOOSING…')
    expect(roundWordForViewer({ phase: 'drawing', isArtist: false, secretWord: 'cat', revealed: new Set() })).toBe('_ _ _')
    expect(roundWordForViewer({ phase: 'result', isArtist: false, secretWord: 'cat', revealed: new Set() })).toBe('c a t')
  })
})
