import { useEffect, useRef } from 'react'

export function GameRulesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="dg-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="dg-modal dg-rules" role="dialog" aria-modal="true" aria-labelledby="rules-title">
        <button ref={closeRef} className="dg-icon-button dg-modal__close" onClick={onClose} aria-label="Close rules">×</button>
        <span className="dg-eyebrow">HOW TO PLAY</span>
        <h2 id="rules-title">Draw it. Guess it.<br />Prove it.</h2>
        <div className="dg-rules__grid">
          <article>
            <span className="dg-rule-number">01</span>
            <h3>Humans draw & guess</h3>
            <ul>
              <li>Take turns choosing one of three secret words.</li>
              <li>Draw without writing letters, numbers, or the answer.</li>
              <li>Type guesses in chat before the room timer ends.</li>
              <li>Letters appear as hints halfway through the turn.</li>
              <li>The correct guesser scores more for speed; the artist earns assist points.</li>
              <li>A brief disconnect keeps your seat. If fewer than two humans remain, the game pauses for up to one minute.</li>
              <li>If the host leaves, the next active player becomes host automatically. If the artist leaves, that turn is skipped.</li>
            </ul>
          </article>
          <article className="dg-rules__ai">
            <span className="dg-rule-number">AI</span>
            <h3>FastH3 has to prove it</h3>
            <ul>
              <li>FastH3 sees periodic snapshots, never the secret word.</li>
              <li>Only a correct FastH3 guess starts a video proof attempt.</li>
              <li>An independent vision check confirms that the generated video matches.</li>
              <li>FastH3 wins only when its text guess is correct and its matching video proof passes.</li>
              <li>A verified FastH3 win scores points for FastH3 and assist points for the artist.</li>
              <li>Humans keep guessing while FastH3 generates.</li>
              <li>FastH3 is optional. The host supplies a Reactor API key and can always run a humans-only room instead.</li>
            </ul>
            <a className="dg-rules__reactor-link" href="https://www.reactor.inc/account/api-keys" target="_blank" rel="noreferrer">Create or manage a Reactor key ↗</a>
          </article>
        </div>
        <p className="dg-privacy-note"><strong>AI room notice:</strong> Whiteboard snapshots and generated-video frames are sent to OpenAI for judging. A host&apos;s Reactor key is saved only in that browser and sent directly to Reactor—not to the Draw &amp; Guess server. Humans-only rooms do not use FastH3.</p>
        <button className="dg-button dg-button--dark dg-rules__done" onClick={onClose}>Got it</button>
      </section>
    </div>
  )
}
