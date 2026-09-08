import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import { useEffect, useState, type ReactNode } from 'react'
import { Toaster } from 'sonner'
import { DrawGuessPostHogProvider } from '#/components/posthog-provider'
import { siteUrl } from '#/lib/site-config'
import sonnerCss from 'sonner/dist/styles.css?url'
import appCss from '../draw-and-guess.css?url'
import brandCss from '../brand-icon.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
      { title: 'Draw & Guess — Free Online Drawing Game vs FastH3' },
      { name: 'description', content: 'Play a free online multiplayer draw-and-guess game with friends. Draw live on Agora Whiteboard and beat FastH3, the AI challenger with video proof.' },
      { name: 'theme-color', content: '#099DFD' },
      { property: 'og:title', content: 'Draw & Guess — Free Online Drawing Game vs FastH3' },
      { property: 'og:description', content: 'Play with friends on a live Agora whiteboard and beat FastH3, the AI challenger with video proof.' },
      { property: 'og:type', content: 'website' },
      { property: 'og:site_name', content: 'Draw & Guess' },
      { property: 'og:locale', content: 'en_US' },
      { property: 'og:image', content: siteUrl('/og-draw-and-guess.png?v=20260904-3') },
      { property: 'og:image:secure_url', content: siteUrl('/og-draw-and-guess.png?v=20260904-3') },
      { property: 'og:image:type', content: 'image/png' },
      { property: 'og:image:width', content: '1200' },
      { property: 'og:image:height', content: '630' },
      { property: 'og:image:alt', content: 'A hand-drawn cat transforms into FastH3 video proof in Draw & Guess' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: 'Draw & Guess — Free Online Drawing Game vs FastH3' },
      { name: 'twitter:description', content: 'Play with friends on a live Agora whiteboard and beat FastH3, the AI challenger with video proof.' },
      { name: 'twitter:image', content: siteUrl('/og-draw-and-guess.png?v=20260904-3') },
      { name: 'twitter:image:alt', content: 'A hand-drawn cat transforms into FastH3 video proof in Draw & Guess' },
    ],
    links: [
      { rel: 'icon', type: 'image/svg+xml', href: '/draw-and-guess-icon.svg' },
      { rel: 'shortcut icon', href: '/favicon.ico' },
      { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/favicon-16x16.png' },
      { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32x32.png' },
      { rel: 'icon', type: 'image/png', sizes: '48x48', href: '/favicon-48x48.png' },
      { rel: 'icon', type: 'image/png', sizes: '192x192', href: '/favicon-192x192.png' },
      { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
      { rel: 'manifest', href: '/site.webmanifest' },
      { rel: 'sitemap', type: 'application/xml', href: '/sitemap.xml' },
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
      { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Bowlby+One+SC&family=IBM+Plex+Mono:wght@500;600;700&family=Nunito+Sans:opsz,wght@6..12,500;6..12,700;6..12,900&display=optional' },
      { rel: 'stylesheet', href: sonnerCss },
      { rel: 'stylesheet', href: appCss },
      { rel: 'stylesheet', href: brandCss },
    ],
  }),
  notFoundComponent: DrawGuessNotFound,
  shellComponent: RootDocument,
})

function DrawGuessNotFound() {
  return (
    <main className="not-found-page">
      <section className="not-found-card">
        <a className="dg-brand" href="/" aria-label="Draw and Guess home">
          <span className="dg-brand__mark">✎</span><span>DRAW<br />& GUESS</span>
        </a>
        <span className="dg-eyebrow">404 · OUTSIDE THE LINES</span>
        <h1>THIS PAGE<br />WAS ERASED.</h1>
        <p>The room link may be old, expired, or mistyped.</p>
        <div className="not-found-actions">
          <a href="/">MAKE A ROOM →</a>
        </div>
      </section>
    </main>
  )
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><HeadContent /></head>
      <body suppressHydrationWarning>
        <DrawGuessPostHogProvider>{children}</DrawGuessPostHogProvider>
        <ClientToaster />
        <Scripts />
      </body>
    </html>
  )
}

function ClientToaster() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return mounted ? <Toaster position="top-right" closeButton duration={2600} toastOptions={{ className: 'dg-toast-sonner' }} /> : null
}
