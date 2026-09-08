import { createFileRoute } from '@tanstack/react-router'
import { LegalPage } from '#/components/legal-page'
import { siteUrl } from '#/lib/site-config'

export const Route = createFileRoute('/privacy')({
  head: () => ({
    meta: [
      { title: 'Privacy — Draw & Guess' },
      { name: 'description', content: 'How Draw & Guess handles room activity, whiteboard data, voice, AI processing, and analytics.' },
    ],
    links: [{ rel: 'canonical', href: siteUrl('/privacy') }],
  }),
  component: PrivacyPage,
})

function PrivacyPage() {
  return (
    <LegalPage eyebrow="YOUR ROOM / YOUR CHOICE" title="PRIVACY" updated="September 4, 2026">
      <section>
        <h2>The short version</h2>
        <p>Draw &amp; Guess uses your nickname, room activity, and whiteboard data to run the game. Voice is sent only after you choose to join voice. When FastH3 is invited, drawing snapshots are processed by an AI vision service so it can guess.</p>
      </section>

      <section>
        <h2>What Draw &amp; Guess collects</h2>
        <ul>
          <li>Your chosen nickname, an anonymous room seat, room settings, guesses, scores, and game timestamps.</li>
          <li>Whiteboard room data and drawing snapshots needed to synchronize play and run FastH3&apos;s visual guesses.</li>
          <li>Anonymous product analytics such as page views, button clicks, game state, browser/device information, and error events.</li>
          <li>Temporary, coarse network identifiers used to prevent spam and enforce rate limits.</li>
        </ul>
      </section>

      <section>
        <h2>How voice and AI work</h2>
        <p>When you join voice, live microphone audio is transmitted to other room participants through Agora RTC. The game does not intentionally publish room voice as a replay.</p>
        <p>If FastH3 is active, snapshots of the shared drawing are sent to an OpenAI-compatible vision service for guesses. A correct guess can trigger the FastH3 proof service to generate and verify the visual proof required by the game rules.</p>
        <p>The host&apos;s Reactor API key is saved in that host&apos;s browser storage. Draw &amp; Guess does not send the key to its Worker, database, or analytics service. The browser sends it directly to Reactor to exchange it for a short-lived token restricted to one FastH3 session.</p>
      </section>

      <section>
        <h2>Storage and services</h2>
        <p>Draw &amp; Guess uses browser storage for preferences and room access, Cloudflare for hosting and game records, Agora for realtime voice and the shared whiteboard, an OpenAI-compatible service for visual guesses, FastH3 for proof generation, and PostHog for product analytics. These providers process limited data needed to deliver their part of the game.</p>
      </section>

      <section>
        <h2>Your controls</h2>
        <ul>
          <li>Do not join voice if you do not want microphone audio transmitted to the room.</li>
          <li>Use your browser controls to mute or revoke microphone permission and clear local Draw &amp; Guess data.</li>
          <li>Clear this site&apos;s browser storage to remove a Reactor API key saved on this device.</li>
          <li>Avoid using a nickname that reveals personal information.</li>
        </ul>
      </section>

      <section>
        <h2>Changes</h2>
        <p>We may update this notice as the game adds features or services. The date at the top shows the latest revision.</p>
      </section>
    </LegalPage>
  )
}
