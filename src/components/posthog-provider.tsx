import { PostHogProvider } from '@posthog/react'
import type { ReactNode } from 'react'

const projectToken = import.meta.env.VITE_POSTHOG_PROJECT_TOKEN
const posthogOptions = {
  api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com',
  defaults: '2026-05-30',
  capture_pageview: true,
  capture_pageleave: true,
} as const

export function DrawGuessPostHogProvider({ children }: { children: ReactNode }) {
  if (!projectToken) return children

  return (
    <PostHogProvider apiKey={projectToken} options={posthogOptions}>
      {children}
    </PostHogProvider>
  )
}
