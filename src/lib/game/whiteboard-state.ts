export type DrawingTool = 'pencil' | 'eraser' | 'rectangle' | 'ellipse'
export type DrawingColor = [number, number, number]
export type DrawingColorOption = { name: string; rgb: DrawingColor }
export type WhiteboardConnectionStatus = 'loading' | 'agora' | 'local' | 'error'

export const DRAWING_COLOR_OPTIONS: DrawingColorOption[] = [
  { name: 'Ink black', rgb: [23, 26, 31] },
  { name: 'Graphite', rgb: [100, 109, 119] },
  { name: 'Agora blue', rgb: [9, 157, 253] },
  { name: 'Deep blue', rgb: [47, 87, 214] },
  { name: 'Coral', rgb: [255, 107, 87] },
  { name: 'Cherry red', rgb: [221, 55, 68] },
  { name: 'Mint', rgb: [84, 214, 160] },
  { name: 'Leaf green', rgb: [39, 166, 92] },
  { name: 'Sunshine', rgb: [255, 216, 77] },
  { name: 'Orange', rgb: [255, 132, 42] },
  { name: 'Purple', rgb: [158, 100, 255] },
  { name: 'Hot pink', rgb: [237, 91, 169] },
  { name: 'Brown', rgb: [139, 88, 57] },
  { name: 'White', rgb: [255, 255, 255] },
]
export const DRAWING_WIDTHS = [3, 7, 14] as const

type WhiteboardHistoryController = {
  canUndoSteps: number
  disableSerialization: boolean
  cleanCurrentScene: (retainPpt?: boolean) => void
  clearUndoHistory: (includeRedo?: boolean) => void
}

export function enableWhiteboardUndo(room: Pick<WhiteboardHistoryController, 'canUndoSteps' | 'disableSerialization'>, writable = true) {
  // Agora rejects disableSerialization mutations in a reader session. Readers
  // still receive every remote scene update; only the active writer needs a
  // local undo history.
  if (!writable) return 0
  room.disableSerialization = false
  return room.canUndoSteps
}

export function resetWhiteboardForRound(room: Pick<WhiteboardHistoryController, 'cleanCurrentScene' | 'clearUndoHistory'>) {
  room.cleanCurrentScene(false)
  room.clearUndoHistory(true)
}

export function isWhiteboardReady(status: WhiteboardConnectionStatus) {
  return status !== 'loading'
}

export function colorsMatch(left: DrawingColor, right: DrawingColor) {
  return left.every((channel, index) => channel === right[index])
}

export function shouldClearForRound(options: { canDraw: boolean; roundId: string; clearedRoundId: string | null; boardReady: boolean }) {
  return options.canDraw && options.boardReady && Boolean(options.roundId) && options.roundId !== options.clearedRoundId
}

export function hasVisibleDrawing(pixels: Uint8ClampedArray, minimumSamples = 24) {
  const buckets = new Map<number, number>()
  const samples: number[] = []

  // Sample every fourth pixel. Transparent pixels are their own background
  // bucket; opaque colors are quantized to ignore renderer noise.
  for (let index = 0; index < pixels.length; index += 16) {
    const alpha = pixels[index + 3]
    const bucket = alpha <= 24
      ? -1
      : ((pixels[index] >> 4) << 8) | ((pixels[index + 1] >> 4) << 4) | (pixels[index + 2] >> 4)
    samples.push(bucket)
    buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1)
  }

  let background = -1
  let backgroundSamples = 0
  for (const [bucket, count] of buckets) {
    if (count > backgroundSamples) {
      background = bucket
      backgroundSamples = count
    }
  }

  const requiredSamples = Math.max(minimumSamples, Math.ceil(samples.length * 0.0005))
  let drawingSamples = 0
  for (const bucket of samples) {
    if (bucket !== background && ++drawingSamples >= requiredSamples) return true
  }
  return false
}
