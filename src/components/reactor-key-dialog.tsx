import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  createReactorSession,
  readReactorApiKey,
  reactorSessionErrorMessage,
  saveReactorApiKey,
  type ReactorSession,
} from '#/lib/reactor-session'

export type ReactorKeyDialogMode = 'invite' | 'start' | 'reconnect'

export function ReactorKeyDialog({ mode, initialError = '', onVerified, onContinue, onClose }: {
  mode: ReactorKeyDialogMode
  initialError?: string
  onVerified: (session: ReactorSession) => Promise<boolean>
  onContinue: () => void
  onClose: () => void
}) {
  const [apiKey, setApiKey] = useState(() => readReactorApiKey(window.localStorage))
  const [status, setStatus] = useState<'idle' | 'checking' | 'ready' | 'error'>(initialError ? 'error' : 'idle')
  const [message, setMessage] = useState(initialError)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && status !== 'checking') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, status])

  const verify = async (event: FormEvent) => {
    event.preventDefault()
    if (status === 'checking') return
    setStatus('checking')
    setMessage('Checking this key directly with Reactor…')
    try {
      const session = await createReactorSession(apiKey)
      saveReactorApiKey(window.localStorage, apiKey)
      setStatus('ready')
      setMessage('Key verified. FastH3 is ready to join.')
      if (!await onVerified(session)) {
        setStatus('error')
        setMessage('The key works, but FastH3 could not join this room. Try again.')
      }
    } catch (error) {
      setStatus('error')
      setMessage(reactorSessionErrorMessage(error))
    }
  }

  return (
    <div className="dg-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && status !== 'checking') onClose() }}>
      <section className="dg-modal dg-reactor-key" role="dialog" aria-modal="true" aria-labelledby="reactor-key-title" data-ph-no-capture>
        <button className="dg-icon-button dg-modal__close" onClick={onClose} disabled={status === 'checking'} aria-label="Close Reactor key setup">×</button>
        <h2 id="reactor-key-title">FastH3 needs<br />your credits.</h2>
        <p className="dg-reactor-key__lede">The shared demo credits have been used up. Add your own Reactor API key to invite FastH3, or keep playing with humans only.</p>
        <form onSubmit={(event) => void verify(event)}>
          <div className="dg-reactor-key__label-row">
            <label htmlFor="reactor-api-key">Reactor API key</label>
            <a href="https://www.reactor.inc/account/api-keys" target="_blank" rel="noreferrer">Create or manage keys ↗</a>
          </div>
          <input
            ref={inputRef}
            id="reactor-api-key"
            name="reactor-api-key"
            type="password"
            value={apiKey}
            onChange={(event) => { setApiKey(event.target.value); setStatus('idle'); setMessage('') }}
            placeholder="rk_…"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            data-ph-no-capture
          />
          <div className="dg-reactor-key__privacy"><span aria-hidden="true">⌂</span><p><strong>Saved only in this browser.</strong> Draw &amp; Guess never sends the key to its server. Your browser sends it directly to Reactor only to create a short-lived FastH3 session.</p></div>
          {message && <p className={`dg-reactor-key__status is-${status}`} role="status"><i aria-hidden="true" />{message}</p>}
          <div className="dg-modal-actions">
            <button type="button" className="dg-button dg-button--paper" disabled={status === 'checking'} onClick={onContinue}>{mode === 'start' ? 'Start humans-only' : mode === 'reconnect' ? 'Continue humans-only' : 'Keep humans-only'}</button>
            <button type="submit" className="dg-button dg-button--blue" disabled={status === 'checking' || !apiKey.trim()}>{status === 'checking' ? 'Verifying with Reactor…' : mode === 'reconnect' ? 'Verify & reconnect ✦' : mode === 'start' ? 'Verify, invite & start ✦' : 'Verify key & invite ✦'}</button>
          </div>
        </form>
      </section>
    </div>
  )
}
