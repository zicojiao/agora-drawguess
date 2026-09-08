import { createFileRoute } from '@tanstack/react-router'
import { DrawGuessHome } from '#/components/draw-guess-home'
import { siteUrl } from '#/lib/site-config'

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [
      { property: 'og:url', content: siteUrl('/') },
      {
        'script:ld+json': {
          '@context': 'https://schema.org',
          '@type': 'WebApplication',
          name: 'Draw & Guess',
          url: siteUrl('/'),
          image: siteUrl('/og-draw-and-guess.png?v=20260904-3'),
          description: 'A free online multiplayer drawing game where friends race FastH3, an AI challenger that must guess the sketch and generate matching video proof.',
          applicationCategory: 'GameApplication',
          operatingSystem: 'Any',
          browserRequirements: 'Requires JavaScript and a modern web browser.',
          isAccessibleForFree: true,
          inLanguage: 'en',
          offers: {
            '@type': 'Offer',
            price: '0',
            priceCurrency: 'USD',
          },
        },
      },
    ],
    links: [
      { rel: 'canonical', href: siteUrl('/') },
      { rel: 'preload', as: 'image', href: '/assets/draw-guess-board-hero-v4.webp', type: 'image/webp', fetchPriority: 'high' },
    ],
  }),
  component: DrawGuessHome,
})
