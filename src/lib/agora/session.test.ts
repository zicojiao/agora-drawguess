import { describe, expect, it, vi } from 'vitest'
import { connectAgoraSession, normalizeAgoraSdpIceOptions, AGORA_RTC_JOIN_TIMEOUT_MS, type AgoraSessionDependencies, type AgoraAudioTrack, type AgoraVideoTrack } from './session'

function mockDependencies() {
  const rtcListeners = new Map<string, (...args: never[]) => void>()
  const rtmListeners = new Map<string, (...args: never[]) => void>()
  const calls: string[] = []
  const mediaStreamTrack = { kind: 'audio' } as MediaStreamTrack
  const audioTrack: AgoraAudioTrack = {
    getVolumeLevel: () => 0.2,
    getMediaStreamTrack: () => mediaStreamTrack,
    stop: vi.fn(() => calls.push('track.stop')),
    close: vi.fn(() => calls.push('track.close')),
  }
  const levelMeter = {
    getLevel: vi.fn(() => 0.42),
    close: vi.fn(async () => { calls.push('meter.close') }),
  }
  const videoTrack: AgoraVideoTrack = {
    stop: vi.fn(() => calls.push('video.stop')),
    close: vi.fn(() => calls.push('video.close')),
  }
  const rtc = {
    on: vi.fn((event: string, listener: (...args: never[]) => void) => { rtcListeners.set(event, listener) }),
    join: vi.fn(async () => { calls.push('rtc.join'); return '101' }),
    subscribe: vi.fn(async () => undefined),
    publish: vi.fn(async () => { calls.push('rtc.publish') }),
    unpublish: vi.fn(async () => { calls.push('rtc.unpublish') }),
    renewToken: vi.fn(async () => { calls.push('rtc.renew') }),
    leave: vi.fn(async () => { calls.push('rtc.leave') }),
  }
  const rtm = {
    addEventListener: vi.fn((event: string, listener: (...args: never[]) => void) => { rtmListeners.set(event, listener) }),
    login: vi.fn(async () => { calls.push('rtm.login') }),
    subscribe: vi.fn(async () => { calls.push('rtm.subscribe') }),
    publish: vi.fn(async () => undefined),
    renewToken: vi.fn(async () => { calls.push('rtm.renew') }),
    unsubscribe: vi.fn(async () => { calls.push('rtm.unsubscribe') }),
    logout: vi.fn(async () => { calls.push('rtm.logout') }),
    presence: {
      getOnlineUsers: vi.fn(async (): Promise<{ occupants: Array<{ userId: string }> }> => ({ occupants: [] })),
    },
  }
  const dependencies: AgoraSessionDependencies = {
    createRtcClient: () => rtc,
    createRtmClient: () => rtm,
    createAudioTrack: async () => { calls.push('track.create'); return audioTrack },
    createVideoTrack: () => { calls.push('video.create'); return videoTrack },
    createLevelMeter: async () => { calls.push('meter.create'); return levelMeter },
  }
  return { dependencies, calls, rtc, rtm, rtcListeners, rtmListeners, levelMeter, mediaStreamTrack, videoTrack }
}

const credentials = { appId: 'app', channelName: 'drawguess_room', token: 'token', uid: '101' }

describe('connectAgoraSession', () => {
  it('removes unsupported extra ICE options without changing the rest of the SDP', () => {
    const sdp = 'v=0\r\na=ice-options:trickle goog-sped-v1\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n'
    expect(normalizeAgoraSdpIceOptions(sdp)).toBe('v=0\r\na=ice-options:trickle\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n')
  })

  it('registers listeners before joining and initializes RTC before RTM', async () => {
    const mock = mockDependencies()
    const handlers = {
      onOpponentJoined: vi.fn(), onOpponentLeft: vi.fn(), onMessage: vi.fn(), onConnectionState: vi.fn(),
      renewToken: vi.fn(async () => 'renewed'),
    }
    const connected = await connectAgoraSession(credentials, handlers, mock.dependencies)

    expect(mock.rtc.on).toHaveBeenCalledBefore(mock.rtc.join)
    expect(mock.rtm.addEventListener).toHaveBeenCalledBefore(mock.rtm.login)
    expect(mock.calls).toEqual(['rtc.join', 'rtm.login', 'rtm.subscribe', 'track.create', 'meter.create', 'rtc.publish'])

    mock.rtcListeners.get('token-privilege-will-expire')?.()
    await vi.waitFor(() => expect(mock.calls).toContain('rtm.renew'))
    expect(handlers.renewToken).toHaveBeenCalledOnce()

    await connected.close()
    expect(mock.calls.slice(-5)).toEqual(['track.stop', 'track.close', 'rtc.leave', 'rtm.unsubscribe', 'rtm.logout'])
  })

  it('cleans up joined services when microphone creation fails', async () => {
    const mock = mockDependencies()
    mock.dependencies.createAudioTrack = async () => { throw new Error('mic denied') }
    const handlers = {
      onOpponentJoined: vi.fn(), onOpponentLeft: vi.fn(), onMessage: vi.fn(), onConnectionState: vi.fn(),
      renewToken: vi.fn(async () => 'renewed'),
    }

    await expect(connectAgoraSession(credentials, handlers, mock.dependencies)).rejects.toThrow('mic denied')
    expect(mock.calls).toEqual(['rtc.join', 'rtm.login', 'rtm.subscribe', 'rtc.leave', 'rtm.unsubscribe', 'rtm.logout'])
    expect(mock.rtc.publish).not.toHaveBeenCalled()
  })

  it('times out a stuck RTC join before opening the microphone', async () => {
    vi.useFakeTimers()
    try {
      const mock = mockDependencies()
      mock.rtc.join.mockImplementation(() => new Promise(() => undefined))
      const handlers = {
        onOpponentJoined: vi.fn(), onOpponentLeft: vi.fn(), onMessage: vi.fn(), onConnectionState: vi.fn(),
        renewToken: vi.fn(async () => 'renewed'),
      }

      const connecting = connectAgoraSession(credentials, handlers, mock.dependencies)
      const assertion = expect(connecting).rejects.toThrow('Realtime voice timed out while joining the voice channel')
      await vi.advanceTimersByTimeAsync(AGORA_RTC_JOIN_TIMEOUT_MS)
      await assertion

      expect(mock.calls).toEqual([])
    } finally {
      vi.useRealTimers()
    }
  })

  it('leaves immediately when a timed-out RTC join resolves late', async () => {
    vi.useFakeTimers()
    try {
      const mock = mockDependencies()
      let finishJoin: ((uid: string) => void) | undefined
      mock.rtc.join.mockImplementation(() => new Promise((resolve) => { finishJoin = resolve }))
      const handlers = {
        onOpponentJoined: vi.fn(), onOpponentLeft: vi.fn(), onMessage: vi.fn(), onConnectionState: vi.fn(),
        renewToken: vi.fn(async () => 'renewed'),
      }

      const connecting = connectAgoraSession(credentials, handlers, mock.dependencies)
      const assertion = expect(connecting).rejects.toThrow('Realtime voice timed out while joining the voice channel')
      await vi.advanceTimersByTimeAsync(AGORA_RTC_JOIN_TIMEOUT_MS)
      await assertion
      finishJoin?.('101')
      await vi.runAllTimersAsync()

      expect(mock.rtc.leave).toHaveBeenCalledOnce()
    } finally {
      vi.useRealTimers()
    }
  })

  it('subscribes remote audio and relays matching RTM presence and messages', async () => {
    const mock = mockDependencies()
    const handlers = {
      onOpponentJoined: vi.fn(), onOpponentLeft: vi.fn(), onMessage: vi.fn(), onConnectionState: vi.fn(),
      renewToken: vi.fn(async () => 'renewed'),
    }
    const connected = await connectAgoraSession(credentials, handlers, mock.dependencies)

    expect(mock.rtm.login).toHaveBeenCalledBefore(mock.rtm.subscribe)
    expect(mock.rtm.subscribe).toHaveBeenCalledWith('drawguess_room', { withMessage: true, withPresence: true })
    expect(mock.rtm.presence.getOnlineUsers).toHaveBeenCalledWith(
      'drawguess_room',
      'MESSAGE',
      { includedUserId: true },
    )

    const remoteTrack = { play: vi.fn(), getVolumeLevel: () => 0.4 }
    const published = mock.rtcListeners.get('user-published') as unknown as (user: { uid: string; audioTrack: typeof remoteTrack }, mediaType: string) => Promise<void>
    await published({ uid: '202', audioTrack: remoteTrack }, 'audio')
    expect(mock.rtc.subscribe).toHaveBeenCalledWith({ uid: '202', audioTrack: remoteTrack }, 'audio')
    expect(remoteTrack.play).toHaveBeenCalledOnce()
    await vi.waitFor(() => expect(handlers.onOpponentJoined).toHaveBeenCalledWith('202'))

    const message = mock.rtmListeners.get('message') as unknown as (event: { message: string; publisher: string; channelName: string }) => void
    message({ message: 'ignored', publisher: '202', channelName: 'another_room' })
    message({ message: '{"type":"fighter","breed":"pug"}', publisher: '202', channelName: 'drawguess_room' })
    expect(handlers.onMessage).toHaveBeenCalledOnce()
    expect(handlers.onMessage).toHaveBeenCalledWith('{"type":"fighter","breed":"pug"}', '202')

    const presence = mock.rtmListeners.get('presence') as unknown as (event: { eventType: string; publisher: string; snapshot?: Array<{ userId: string }> }) => void
    presence({ eventType: 'SNAPSHOT', publisher: '', snapshot: [{ userId: '101' }, { userId: '202' }] })
    expect(handlers.onOpponentJoined).toHaveBeenCalledWith('202')
    expect(handlers.onOpponentJoined).not.toHaveBeenCalledWith('101')

    await connected.publish('ready', 'drawguess.refresh')
    expect(mock.rtm.publish).toHaveBeenCalledWith('drawguess_room', 'ready', { customType: 'drawguess.refresh' })
    await connected.close()
  })

  it('can join realtime before asking for microphone permission', async () => {
    const mock = mockDependencies()
    const handlers = {
      onOpponentJoined: vi.fn(), onOpponentLeft: vi.fn(), onMessage: vi.fn(), onConnectionState: vi.fn(),
      renewToken: vi.fn(async () => 'renewed'),
    }

    const connected = await connectAgoraSession(credentials, handlers, mock.dependencies, { deferMicrophone: true })

    expect(mock.calls).toEqual(['rtc.join', 'rtm.login', 'rtm.subscribe'])
    expect(connected.audioTrack).toBeNull()
    expect(connected.getLevel()).toBe(0)

    await connected.enableMicrophone()
    expect(connected.audioTrack).not.toBeNull()
    expect(mock.calls.slice(-3)).toEqual(['track.create', 'meter.create', 'rtc.publish'])

    await connected.disableMicrophone()
    expect(connected.audioTrack).toBeNull()
    expect(mock.calls.slice(-4)).toEqual(['rtc.unpublish', 'meter.close', 'track.stop', 'track.close'])
    await connected.close()
  })

  it('subscribes to the shared FastH3 video and can relay a source track', async () => {
    const mock = mockDependencies()
    const onRemoteVideoTrack = vi.fn()
    const handlers = {
      onOpponentJoined: vi.fn(), onOpponentLeft: vi.fn(), onMessage: vi.fn(), onConnectionState: vi.fn(), onRemoteVideoTrack,
      renewToken: vi.fn(async () => 'renewed'),
    }
    const connected = await connectAgoraSession(credentials, handlers, mock.dependencies, { deferMicrophone: true })
    const remoteMediaTrack = { kind: 'video' } as MediaStreamTrack
    const remoteVideoTrack = { getMediaStreamTrack: () => remoteMediaTrack }
    const published = mock.rtcListeners.get('user-published') as unknown as (user: { uid: string; videoTrack: typeof remoteVideoTrack }, mediaType: 'video') => Promise<void>

    await published({ uid: '202', videoTrack: remoteVideoTrack }, 'video')
    expect(mock.rtc.subscribe).toHaveBeenCalledWith({ uid: '202', videoTrack: remoteVideoTrack }, 'video')
    expect(onRemoteVideoTrack).toHaveBeenCalledWith(remoteMediaTrack, '202')

    const relayClone = { kind: 'video' } as MediaStreamTrack
    const source = { kind: 'video', clone: vi.fn(() => relayClone) } as unknown as MediaStreamTrack
    await connected.setPublishedVideoTrack(source)
    expect(source.clone).toHaveBeenCalledOnce()
    expect(mock.calls.slice(-2)).toEqual(['video.create', 'rtc.publish'])

    await connected.setPublishedVideoTrack(null)
    expect(mock.calls.slice(-3)).toEqual(['rtc.unpublish', 'video.stop', 'video.close'])
    await connected.close()
  })

  it('scores from measured microphone RMS rather than the SDK volume level', async () => {
    const mock = mockDependencies()
    const handlers = {
      onOpponentJoined: vi.fn(), onOpponentLeft: vi.fn(), onMessage: vi.fn(), onConnectionState: vi.fn(),
      renewToken: vi.fn(async () => 'renewed'),
    }

    const connected = await connectAgoraSession(credentials, handlers, mock.dependencies)

    expect(connected.getLevel()).toBe(0.42)
    expect(mock.levelMeter.getLevel).toHaveBeenCalled()
    await connected.close()
    expect(mock.calls).toContain('meter.close')
  })

  it('falls back to the SDK level instead of failing the match when Web Audio is unavailable', async () => {
    const mock = mockDependencies()
    mock.dependencies.createLevelMeter = async () => { throw new Error('no AudioContext') }
    const handlers = {
      onOpponentJoined: vi.fn(), onOpponentLeft: vi.fn(), onMessage: vi.fn(), onConnectionState: vi.fn(),
      renewToken: vi.fn(async () => 'renewed'),
    }

    const connected = await connectAgoraSession(credentials, handlers, mock.dependencies)

    expect(connected.getLevel()).toBe(0.2)
    await connected.close()
  })

  it('discovers an already-online opponent even when the join event was missed', async () => {
    const mock = mockDependencies()
    mock.rtm.presence.getOnlineUsers.mockResolvedValue({
      occupants: [{ userId: '101' }, { userId: '202' }],
    })
    const handlers = {
      onOpponentJoined: vi.fn(), onOpponentLeft: vi.fn(), onMessage: vi.fn(), onConnectionState: vi.fn(),
      renewToken: vi.fn(async () => 'renewed'),
    }

    const connected = await connectAgoraSession(credentials, handlers, mock.dependencies)

    expect(handlers.onOpponentJoined).toHaveBeenCalledWith('202')
    expect(handlers.onOpponentJoined).not.toHaveBeenCalledWith('101')
    await connected.close()
  })

  it('restores the message-channel subscription after a non-resumed reconnect', async () => {
    const mock = mockDependencies()
    const handlers = {
      onOpponentJoined: vi.fn(), onOpponentLeft: vi.fn(), onMessage: vi.fn(), onConnectionState: vi.fn(),
      renewToken: vi.fn(async () => 'renewed'),
    }
    const connected = await connectAgoraSession(credentials, handlers, mock.dependencies)
    const linkState = mock.rtmListeners.get('linkState') as unknown as (event: { currentState: string; isResumed: boolean }) => void

    linkState({ currentState: 'CONNECTED', isResumed: false })

    await vi.waitFor(() => expect(mock.rtm.subscribe).toHaveBeenCalledTimes(2))
    await connected.close()
  })

  it('surfaces same-UID login conflicts instead of pretending voice is live', async () => {
    const mock = mockDependencies()
    const handlers = {
      onOpponentJoined: vi.fn(), onOpponentLeft: vi.fn(), onMessage: vi.fn(), onConnectionState: vi.fn(),
      renewToken: vi.fn(async () => 'renewed'),
    }
    const connected = await connectAgoraSession(credentials, handlers, mock.dependencies)
    const linkState = mock.rtmListeners.get('linkState') as unknown as (event: { currentState: string; reasonCode: string }) => void

    linkState({ currentState: 'FAILED', reasonCode: 'SAME_UID_LOGIN' })

    expect(handlers.onConnectionState).toHaveBeenLastCalledWith('SAME_UID_LOGIN')
    await connected.close()
  })
})
