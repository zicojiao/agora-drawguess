import { describe, expect, it } from 'vitest'
import { colorsMatch, DRAWING_COLOR_OPTIONS, enableWhiteboardUndo, hasVisibleDrawing, isWhiteboardReady, resetWhiteboardForRound, shouldClearForRound } from './whiteboard-state'

describe('whiteboard round lifecycle', () => {
  it('clears exactly once when the artist enters a new ready board', () => {
    expect(shouldClearForRound({ canDraw: true, roundId: 'round-2', clearedRoundId: 'round-1', boardReady: true })).toBe(true)
    expect(shouldClearForRound({ canDraw: true, roundId: 'round-2', clearedRoundId: 'round-2', boardReady: true })).toBe(false)
    expect(shouldClearForRound({ canDraw: false, roundId: 'round-2', clearedRoundId: 'round-1', boardReady: true })).toBe(false)
    expect(shouldClearForRound({ canDraw: true, roundId: 'round-2', clearedRoundId: 'round-1', boardReady: false })).toBe(false)
  })

  it('identifies the active color by RGB value', () => {
    expect(colorsMatch([9, 157, 253], [9, 157, 253])).toBe(true)
    expect(colorsMatch([9, 157, 253], [255, 107, 87])).toBe(false)
  })

  it('offers a broad palette with unique accessible names', () => {
    expect(DRAWING_COLOR_OPTIONS).toHaveLength(14)
    expect(new Set(DRAWING_COLOR_OPTIONS.map(({ name }) => name)).size).toBe(14)
    expect(DRAWING_COLOR_OPTIONS.some(({ name }) => name === 'White')).toBe(true)
  })

  it('enables Agora serialization so undo history is recorded', () => {
    const room = { canUndoSteps: 2, disableSerialization: true }
    expect(enableWhiteboardUndo(room)).toBe(2)
    expect(room.disableSerialization).toBe(false)
  })

  it('does not mutate writer-only history settings for whiteboard readers', () => {
    let mutations = 0
    const room = {
      canUndoSteps: 0,
      get disableSerialization() { return true },
      set disableSerialization(_value: boolean) { mutations += 1 },
    }
    expect(enableWhiteboardUndo(room, false)).toBe(0)
    expect(mutations).toBe(0)
  })

  it('clears the scene and its history between rounds', () => {
    const calls: string[] = []
    resetWhiteboardForRound({
      cleanCurrentScene: (retainPpt) => calls.push(`clean:${retainPpt}`),
      clearUndoHistory: (includeRedo) => calls.push(`history:${includeRedo}`),
    })
    expect(calls).toEqual(['clean:false', 'history:true'])
  })

  it('blocks drawing only while the remote whiteboard is connecting', () => {
    expect(isWhiteboardReady('loading')).toBe(false)
    expect(isWhiteboardReady('agora')).toBe(true)
    expect(isWhiteboardReady('local')).toBe(true)
    expect(isWhiteboardReady('error')).toBe(true)
  })

  it('ignores transparent, white, and black blank scenes', () => {
    const transparent = new Uint8ClampedArray(1_600)
    const white = new Uint8ClampedArray(1_600).fill(255)
    const black = new Uint8ClampedArray(1_600)
    for (let index = 3; index < black.length; index += 4) black[index] = 255
    expect(hasVisibleDrawing(transparent)).toBe(false)
    expect(hasVisibleDrawing(white)).toBe(false)
    expect(hasVisibleDrawing(black)).toBe(false)
  })

  it('accepts meaningful strokes against either a light or dark background', () => {
    const whiteWithInk = new Uint8ClampedArray(3_200).fill(255)
    const blackWithColor = new Uint8ClampedArray(3_200)
    for (let index = 3; index < blackWithColor.length; index += 4) blackWithColor[index] = 255
    for (let sample = 0; sample < 32; sample += 1) {
      const index = sample * 16
      whiteWithInk[index] = 23
      whiteWithInk[index + 1] = 26
      whiteWithInk[index + 2] = 31
      blackWithColor[index] = 9
      blackWithColor[index + 1] = 157
      blackWithColor[index + 2] = 253
    }
    expect(hasVisibleDrawing(whiteWithInk)).toBe(true)
    expect(hasVisibleDrawing(blackWithColor)).toBe(true)
  })

  it('ignores tiny renderer artifacts before the first real stroke', () => {
    const noisyBlank = new Uint8ClampedArray(3_200).fill(255)
    for (let sample = 0; sample < 8; sample += 1) noisyBlank[sample * 16] = 240
    expect(hasVisibleDrawing(noisyBlank)).toBe(false)
  })
})
