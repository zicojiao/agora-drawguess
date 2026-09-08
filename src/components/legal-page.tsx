import type { ReactNode } from 'react'

export function LegalPage({ eyebrow, title, updated, children }: {
  eyebrow: string
  title: string
  updated: string
  children: ReactNode
}) {
  return (
    <main className="dg-legal-page">
      <article className="dg-legal-shell">
        <header className="dg-legal-header">
          <a className="dg-brand dg-brand--small" href="/" aria-label="Draw and Guess home">
            <span className="dg-brand__mark" aria-hidden="true">✎</span>
            <span>DRAW<br />&amp; GUESS</span>
          </a>
          <a className="dg-button dg-button--yellow dg-legal-play" href="/">Create a room <span aria-hidden="true">→</span></a>
        </header>

        <div className="dg-legal-hero">
          <p>{eyebrow}</p>
          <h1>{title}</h1>
          <span>Last updated {updated}</span>
        </div>

        <div className="dg-legal-content">{children}</div>

        <footer className="dg-legal-footer">
          <a href="/">Draw &amp; Guess home</a>
          <nav aria-label="Legal pages">
            <a href="/privacy">Privacy</a>
            <a href="/terms">Terms</a>
          </nav>
        </footer>
      </article>
    </main>
  )
}
