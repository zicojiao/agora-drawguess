export type VoiceControlState = 'off' | 'joining' | 'live' | 'leaving' | 'error'

export function voiceControlCopy(state: VoiceControlState, available: boolean) {
  if (!available) return { label: 'Voice unavailable', detail: 'Agora RTC offline', icon: '◖', action: 'none' as const }
  if (state === 'joining') return { label: 'Joining voice…', detail: 'Opening your microphone', icon: '…', action: 'none' as const }
  if (state === 'live') return { label: 'Leave voice', detail: 'Mic live · Agora RTC', icon: '×', action: 'leave' as const }
  if (state === 'leaving') return { label: 'Leaving voice…', detail: 'Releasing your microphone', icon: '…', action: 'none' as const }
  if (state === 'error') return { label: 'Retry voice', detail: 'Connection needs attention', icon: '↻', action: 'join' as const }
  return { label: 'Join voice', detail: 'Agora RTC audio', icon: '◖', action: 'join' as const }
}
