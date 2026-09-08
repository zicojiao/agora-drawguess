import type { LevelMeter } from '../audio/level-meter'

type AgoraRemoteUser = {
  uid: string | number
  audioTrack?: { play: () => void; getVolumeLevel: () => number }
  videoTrack?: { getMediaStreamTrack: () => MediaStreamTrack }
}

export type AgoraSessionCredentials = {
  appId: string
  channelName: string
  token: string
  uid: string
}

type RtcEvent = 'user-joined' | 'user-left' | 'user-published' | 'user-unpublished' | 'token-privilege-will-expire'
type RtmEvent = 'message' | 'presence' | 'tokenPrivilegeWillExpire' | 'linkState'

export type AgoraAudioTrack = {
  getVolumeLevel: () => number
  getMediaStreamTrack: () => MediaStreamTrack
  stop: () => void
  close: () => void
}

export type AgoraVideoTrack = {
  stop: () => void
  close: () => void
}

type AgoraRtcClient = {
  on: (event: RtcEvent, listener: (...args: never[]) => void) => void
  join: (appId: string, channel: string, token: string, uid: string) => Promise<string | number>
  subscribe: (user: AgoraRemoteUser, mediaType: 'audio' | 'video') => Promise<unknown>
  publish: (tracks: Array<AgoraAudioTrack | AgoraVideoTrack>) => Promise<unknown>
  unpublish: (tracks: Array<AgoraAudioTrack | AgoraVideoTrack>) => Promise<unknown>
  renewToken: (token: string) => Promise<unknown>
  leave: () => Promise<unknown>
}

type AgoraRtmClient = {
  addEventListener: (event: RtmEvent, listener: (...args: never[]) => void) => void
  login: (options: { token: string }) => Promise<unknown>
  subscribe: (channel: string, options: { withMessage: boolean; withPresence: boolean }) => Promise<unknown>
  publish: (channel: string, message: string, options?: { customType?: string }) => Promise<unknown>
  renewToken: (token: string) => Promise<unknown>
  unsubscribe: (channel: string) => Promise<unknown>
  logout: () => Promise<unknown>
  presence: {
    getOnlineUsers: (
      channel: string,
      channelType: 'MESSAGE',
      options?: { includedUserId?: boolean },
    ) => Promise<{ occupants: Array<{ userId: string }> }>
  }
}

export type AgoraSessionDependencies = {
  createRtcClient: () => AgoraRtcClient
  createRtmClient: (appId: string, uid: string) => AgoraRtmClient
  createAudioTrack: () => Promise<AgoraAudioTrack>
  createVideoTrack: (track: MediaStreamTrack) => AgoraVideoTrack
  createLevelMeter: (track: MediaStreamTrack) => Promise<LevelMeter>
}

export type AgoraSessionHandlers = {
  onOpponentJoined: (uid: string) => void
  onOpponentLeft: (uid: string) => void
  onMessage: (message: string, publisher: string) => void
  onConnectionState: (state: string) => void
  onRemoteVideoTrack?: (track: MediaStreamTrack | null, publisher: string) => void
  renewToken: () => Promise<string>
}

export type ConnectedAgoraSession = {
  readonly audioTrack: AgoraAudioTrack | null
  /** Microphone RMS on the same scale the score engine was tuned for. */
  getLevel: () => number
  enableMicrophone: () => Promise<void>
  disableMicrophone: () => Promise<void>
  setPublishedVideoTrack: (track: MediaStreamTrack | null) => Promise<void>
  publish: (message: string, customType?: string) => Promise<unknown>
  close: () => Promise<void>
}

export type ConnectAgoraSessionOptions = {
  /** Join RTC and RTM without requesting microphone permission yet. */
  deferMicrophone?: boolean
}

export const AGORA_RTC_JOIN_TIMEOUT_MS = 12_000

export function normalizeAgoraSdpIceOptions(sdp: string) {
  return sdp.replace(/^a=ice-options:trickle(?: [^\r\n]+)+$/gm, 'a=ice-options:trickle')
}

function installAgoraSdpCompatibility() {
  if (typeof RTCPeerConnection === 'undefined') return
  type PatchablePeerConnection = {
    __drawGuessAgoraSdpPatched?: boolean
    createOffer: (options?: RTCOfferOptions) => Promise<RTCSessionDescriptionInit>
  }
  const prototype = RTCPeerConnection.prototype as unknown as PatchablePeerConnection
  if (prototype.__drawGuessAgoraSdpPatched) return
  prototype.__drawGuessAgoraSdpPatched = true

  const originalCreateOffer = prototype.createOffer
  prototype.createOffer = async function (options) {
    const description = await originalCreateOffer.call(this, options)
    const sdp = description.sdp ? normalizeAgoraSdpIceOptions(description.sdp) : description.sdp
    return sdp === description.sdp ? description : { ...description, sdp }
  }
}

function withConnectionTimeout<T>(promise: Promise<T>, step: string, timeoutMs: number) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Realtime voice timed out while ${step}. Check your connection and try again.`))
    }, timeoutMs)

    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

export async function loadAgoraSessionDependencies(): Promise<AgoraSessionDependencies> {
  // Some Chromium builds append a second proprietary ICE option. Agora's SDP
  // parser rejects that otherwise valid space-separated attribute before join.
  installAgoraSdpCompatibility()
  const [rtcModule, { default: AgoraRTM }, { createLevelMeter }] = await Promise.all([
    import('agora-rtc-sdk-ng/esm'),
    import('agora-rtm'),
    import('../audio/level-meter'),
  ])

  return {
    createRtcClient: () => rtcModule.createClient({ mode: 'rtc', codec: 'vp8' }) as unknown as AgoraRtcClient,
    createRtmClient: (appId, uid) => new AgoraRTM.RTM(appId, uid, {
      logLevel: 'warn',
      presenceTimeout: 10,
    }) as unknown as AgoraRtmClient,
    createAudioTrack: () => rtcModule.createMicrophoneAudioTrack({
      encoderConfig: 'high_quality',
      AEC: true,
      ANS: false,
      AGC: false,
    }) as unknown as Promise<AgoraAudioTrack>,
    // Reactor supplies an already-live remote MediaStreamTrack. Adding camera
    // capture constraints here makes Chromium reject the relay as overconstrained.
    createVideoTrack: (track) => rtcModule.createCustomVideoTrack({ mediaStreamTrack: track }) as unknown as AgoraVideoTrack,
    createLevelMeter,
  }
}

export async function connectAgoraSession(
  credentials: AgoraSessionCredentials,
  handlers: AgoraSessionHandlers,
  dependencies: AgoraSessionDependencies,
  options: ConnectAgoraSessionOptions = {},
): Promise<ConnectedAgoraSession> {
  const rtc = dependencies.createRtcClient()
  const rtm = dependencies.createRtmClient(credentials.appId, credentials.uid)
  let audioTrack: AgoraAudioTrack | null = null
  let levelMeter: LevelMeter | null = null
  let publishedVideoTrack: AgoraVideoTrack | null = null
  let publishedVideoSource: MediaStreamTrack | null = null
  let rtcJoined = false
  let rtmLoggedIn = false
  let rtmSubscribed = false
  let closed = false
  let restorePromise: Promise<void> | null = null
  const discoveryTimers = new Set<ReturnType<typeof setTimeout>>()

  const discoverOnlinePeers = async () => {
    if (!rtmSubscribed || closed) return
    try {
      const online = await rtm.presence.getOnlineUsers(
        credentials.channelName,
        'MESSAGE',
        { includedUserId: true },
      )
      for (const occupant of online.occupants) {
        if (occupant.userId !== credentials.uid) handlers.onOpponentJoined(occupant.userId)
      }
    } catch {
      // Presence events and RTC callbacks remain active; a later retry self-heals discovery.
    }
  }

  const scheduleDiscovery = (delayMs: number) => {
    const timer = setTimeout(() => {
      discoveryTimers.delete(timer)
      void discoverOnlinePeers()
    }, delayMs)
    discoveryTimers.add(timer)
  }

  const restoreMessageChannel = () => {
    if (!rtmSubscribed || closed) return Promise.resolve()
    restorePromise ??= rtm.subscribe(credentials.channelName, { withMessage: true, withPresence: true })
      .then(() => discoverOnlinePeers())
      .then(() => undefined)
      .finally(() => { restorePromise = null })
    return restorePromise
  }

  const renewBoth = async () => {
    const token = await handlers.renewToken()
    await Promise.all([rtc.renewToken(token), rtm.renewToken(token)])
  }

  rtc.on('user-joined', ((user: AgoraRemoteUser) => handlers.onOpponentJoined(String(user.uid))) as (...args: never[]) => void)
  rtc.on('user-left', ((user: AgoraRemoteUser) => {
    handlers.onRemoteVideoTrack?.(null, String(user.uid))
    handlers.onOpponentLeft(String(user.uid))
  }) as (...args: never[]) => void)
  rtc.on('user-published', (async (user: AgoraRemoteUser, mediaType: 'audio' | 'video') => {
    await rtc.subscribe(user, mediaType)
    if (mediaType === 'audio') user.audioTrack?.play()
    if (mediaType === 'video') handlers.onRemoteVideoTrack?.(user.videoTrack?.getMediaStreamTrack() ?? null, String(user.uid))
    handlers.onOpponentJoined(String(user.uid))
  }) as (...args: never[]) => void)
  rtc.on('user-unpublished', ((user: AgoraRemoteUser, mediaType: 'audio' | 'video') => {
    if (mediaType === 'video') handlers.onRemoteVideoTrack?.(null, String(user.uid))
  }) as (...args: never[]) => void)
  rtc.on('token-privilege-will-expire', (() => { void renewBoth() }) as (...args: never[]) => void)

  rtm.addEventListener('message', ((event: { message: string | Uint8Array; publisher: string; channelName: string }) => {
    if (event.channelName !== credentials.channelName || typeof event.message !== 'string') return
    handlers.onMessage(event.message, event.publisher)
  }) as (...args: never[]) => void)
  rtm.addEventListener('presence', ((event: { eventType: string; publisher: string; snapshot?: Array<{ userId: string }> | null }) => {
    if (event.eventType === 'SNAPSHOT') {
      for (const user of event.snapshot ?? []) if (user.userId !== credentials.uid) handlers.onOpponentJoined(user.userId)
    } else if (event.publisher && event.publisher !== credentials.uid) {
      if (event.eventType === 'REMOTE_JOIN') handlers.onOpponentJoined(event.publisher)
      if (event.eventType === 'REMOTE_LEAVE' || event.eventType === 'REMOTE_TIMEOUT') handlers.onOpponentLeft(event.publisher)
    }
  }) as (...args: never[]) => void)
  rtm.addEventListener('linkState', ((event: { currentState: string; reasonCode?: string; isResumed?: boolean; unrestoredChannels?: string[] }) => {
    if (event.reasonCode === 'SAME_UID_LOGIN') {
      handlers.onConnectionState('SAME_UID_LOGIN')
      return
    }
    handlers.onConnectionState(event.currentState)
    if (event.currentState === 'CONNECTED' && rtmSubscribed && event.isResumed === false) {
      void restoreMessageChannel()
    } else if (event.currentState === 'CONNECTED') {
      void discoverOnlinePeers()
    }
  }) as (...args: never[]) => void)
  rtm.addEventListener('tokenPrivilegeWillExpire', (() => { void renewBoth() }) as (...args: never[]) => void)

  const disableMicrophone = async () => {
    const track = audioTrack
    const meter = levelMeter
    audioTrack = null
    levelMeter = null
    if (track && rtcJoined) await rtc.unpublish([track]).catch(() => undefined)
    await meter?.close().catch(() => undefined)
    track?.stop()
    track?.close()
  }

  const enableMicrophone = async () => {
    if (audioTrack) return
    const track = await dependencies.createAudioTrack()
    let meter: LevelMeter | null = null
    try {
      meter = await dependencies.createLevelMeter(track.getMediaStreamTrack())
    } catch {
      // Fall back to the SDK's own level rather than losing voice entirely.
    }
    try {
      await rtc.publish([track])
      audioTrack = track
      levelMeter = meter
    } catch (error) {
      await meter?.close().catch(() => undefined)
      track.stop()
      track.close()
      throw error
    }
  }

  const setPublishedVideoTrack = async (source: MediaStreamTrack | null) => {
    if (source === publishedVideoSource) return
    const previous = publishedVideoTrack
    publishedVideoTrack = null
    publishedVideoSource = null
    if (previous && rtcJoined) await rtc.unpublish([previous]).catch(() => undefined)
    previous?.stop()
    previous?.close()
    if (!source) return
    const relaySource = source.clone()
    const track = dependencies.createVideoTrack(relaySource)
    try {
      await rtc.publish([track])
      publishedVideoSource = source
      publishedVideoTrack = track
    } catch (error) {
      track.stop()
      track.close()
      throw error
    }
  }

  const close = async () => {
    if (closed) return
    closed = true
    for (const timer of discoveryTimers) clearTimeout(timer)
    discoveryTimers.clear()
    await disableMicrophone()
    await setPublishedVideoTrack(null)
    if (rtcJoined) await rtc.leave().catch(() => undefined)
    if (rtmSubscribed) await rtm.unsubscribe(credentials.channelName).catch(() => undefined)
    if (rtmLoggedIn) await rtm.logout().catch(() => undefined)
  }

  try {
    const rtcJoin = rtc.join(credentials.appId, credentials.channelName, credentials.token, credentials.uid)
      .then((uid) => {
        rtcJoined = true
        // The SDK cannot cancel a join already in flight. If our timeout fired,
        // leave as soon as a late join resolves instead of leaking a ghost user.
        if (closed) void rtc.leave().catch(() => undefined)
        return uid
      })
    await withConnectionTimeout(rtcJoin, 'joining the voice channel', AGORA_RTC_JOIN_TIMEOUT_MS)
    await rtm.login({ token: credentials.token })
    rtmLoggedIn = true
    await rtm.subscribe(credentials.channelName, { withMessage: true, withPresence: true })
    rtmSubscribed = true
    void discoverOnlinePeers()
    scheduleDiscovery(800)
    scheduleDiscovery(2_000)
    scheduleDiscovery(4_000)
    if (!options.deferMicrophone) await enableMicrophone()
  } catch (error) {
    await close()
    throw error
  }

  return {
    get audioTrack() { return audioTrack },
    getLevel: () => levelMeter ? levelMeter.getLevel() : audioTrack?.getVolumeLevel() ?? 0,
    enableMicrophone,
    disableMicrophone,
    setPublishedVideoTrack,
    publish: (message, customType = 'drawguess.state') => rtm.publish(credentials.channelName, message, { customType }),
    close,
  }
}
