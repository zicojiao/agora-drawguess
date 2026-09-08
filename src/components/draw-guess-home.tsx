import { useEffect, useState } from 'react'
import { AgoraCredit } from './agora-credit'
import { GameRulesDialog } from './game-rules-dialog'
import { ReactorCredit } from './reactor-credit'
import { createRandomNickname } from '../lib/random-nickname'

export function DrawGuessHome() {
  const [nickname, setNickname] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [rulesOpen, setRulesOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => setNickname(window.localStorage.getItem('drawguess.nickname') ?? ''), [])

  const remember = () => {
    const value = nickname.trim().replace(/\s+/g, ' ').slice(0, 24)
    if (!value) { setError('Enter your nickname first.'); return '' }
    window.localStorage.setItem('drawguess.nickname', value)
    return value
  }
  const createRoom = async () => {
    const name = remember()
    if (!name || busy) return
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/game/rooms', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nickname: name }) })
      const result = await response.json() as { roomId?: string; seatToken?: string; error?: string }
      if (!response.ok || !result.roomId || !result.seatToken) throw new Error(result.error || 'The room could not be created.')
      window.sessionStorage.setItem(`drawguess.seat.${result.roomId}`, result.seatToken)
      window.location.assign(`/room/${result.roomId}`)
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'The room could not be created.'); setBusy(false) }
  }
  const joinRoom = () => {
    if (!remember()) return
    const code = roomCode.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
    if (!/^[a-z][a-z0-9]{5}$/.test(code)) { setError('Enter the six-character room code.'); return }
    window.location.assign(`/room/${code}`)
  }
  const randomizeNickname = () => {
    setNickname((current) => createRandomNickname(current))
    setError('')
  }

  return (
    <main className="dg-home">
      <nav className="dg-nav">
        <a className="dg-brand" href="/" aria-label="Draw and Guess home"><span className="dg-brand__mark">✎</span><span>DRAW<br />& GUESS</span></a>
        <div className="dg-nav__actions">
          <div className="dg-nav__credits">
            <AgoraCredit placement="home_header" />
            <ReactorCredit placement="home_header" />
          </div>
          <button className="dg-nav-rules" onClick={() => setRulesOpen(true)}><span aria-hidden="true">?</span> How to play</button>
        </div>
      </nav>
      <section className="dg-hero">
        <div className="dg-hero__copy">
          <span className="dg-eyebrow">LIVE DRAWING PARTY · HUMAN VS AI</span>
          <div className="dg-hero__headline">
            <h1>DRAW IT. <span>GUESS IT.</span> BEAT FASTH3.</h1>
          </div>
        </div>
        <div className="dg-hero__play">
          <figure className="dg-hero-art">
            <img
              src="/assets/draw-guess-board-hero-v4.webp"
              alt="A Draw and Guess board where Maya guesses a cat sketch while FastH3 generates a realistic cat video as proof"
              width="1536"
              height="1024"
              fetchPriority="high"
              decoding="async"
            />
          </figure>
          <div className="dg-entry-card">
            <h2>Create your room</h2>
            <label>
              <span>Your nickname</span>
              <div className="dg-nickname-field">
                <input value={nickname} onChange={(event) => setNickname(event.target.value)} maxLength={24} placeholder="Mysterious Mango" autoComplete="nickname" />
                <button className="dg-random-name" type="button" onClick={randomizeNickname} aria-label="Generate a random nickname" title="Random nickname">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4" /><circle cx="8" cy="8" r="1.45" /><circle cx="16" cy="8" r="1.45" /><circle cx="12" cy="12" r="1.45" /><circle cx="8" cy="16" r="1.45" /><circle cx="16" cy="16" r="1.45" /></svg>
                </button>
              </div>
            </label>
            <button className="dg-button dg-button--blue dg-entry-card__create" onClick={createRoom} disabled={busy}>{busy ? 'Creating your room…' : 'Create a room'} <span aria-hidden="true">→</span></button>
            <div className="dg-entry-card__or"><span>Already have a code?</span></div>
            <div className="dg-join-row"><input value={roomCode} onChange={(event) => setRoomCode(event.target.value)} maxLength={6} placeholder="ROOM CODE" aria-label="Room code" onKeyDown={(event) => { if (event.key === 'Enter') joinRoom() }} /><button className="dg-button dg-button--yellow" onClick={joinRoom}>Join</button></div>
            {error && <p className="dg-form-error" role="alert">{error}</p>}
          </div>
        </div>
      </section>
      <section className="dg-how" aria-label="How to play the free online multiplayer Draw and Guess game">
        <p><b>01</b><span>Create a private room</span></p>
        <i aria-hidden="true">→</i>
        <p><b>02</b><span>Draw and guess online</span></p>
        <i aria-hidden="true">→</i>
        <p><b>03</b><span>Beat FastH3 + video proof</span></p>
      </section>
      <footer className="dg-home-footer"><a href="/terms" target="_blank" rel="noopener noreferrer">Terms</a><a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy</a></footer>
      <GameRulesDialog open={rulesOpen} onClose={() => setRulesOpen(false)} />
    </main>
  )
}
