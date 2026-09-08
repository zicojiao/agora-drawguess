import { createFileRoute } from '@tanstack/react-router'
import { LegalPage } from '#/components/legal-page'
import { siteUrl } from '#/lib/site-config'

export const Route = createFileRoute('/terms')({
  head: () => ({
    meta: [
      { title: 'Terms — Draw & Guess' },
      { name: 'description', content: 'Rules for playing Draw & Guess with friends and the FastH3 AI challenger.' },
    ],
    links: [{ rel: 'canonical', href: siteUrl('/terms') }],
  }),
  component: TermsPage,
})

function TermsPage() {
  return (
    <LegalPage eyebrow="DRAW TOGETHER / PLAY FAIR" title="TERMS" updated="September 4, 2026">
      <section>
        <h2>Using Draw &amp; Guess</h2>
        <p>Draw &amp; Guess is an entertainment game for live drawing, guessing, voice chat, and an optional FastH3 AI challenger. Scores and wins have no cash value. You are responsible for using the game safely and legally.</p>
      </section>

      <section>
        <h2>Your room content</h2>
        <p>You keep ownership of drawings and messages you create. You give Draw &amp; Guess permission to process and display that content to run your room, synchronize the whiteboard, evaluate guesses, and show game results.</p>
      </section>

      <section>
        <h2>Fair play</h2>
        <ul>
          <li>Do not submit abusive, illegal, infringing, deceptive, or harmful drawings, guesses, speech, or nicknames.</li>
          <li>Do not manipulate requests, attack the service, evade rate limits, or interfere with another room.</li>
          <li>We may remove content, reset results, restrict access, or change anti-cheat checks when needed to protect the game.</li>
        </ul>
      </section>

      <section>
        <h2>FastH3 and AI results</h2>
        <p>FastH3 guesses and generated proof are automated game mechanics. They may be incomplete or wrong and should not be treated as factual, professional, or safety advice. We may tune the AI rules and proof checks as the demo evolves.</p>
      </section>

      <section>
        <h2>Voice and room safety</h2>
        <p>Voice is optional. Use headphones to reduce feedback, and leave or mute a room if another player makes you uncomfortable. Do not share sensitive personal information in a room.</p>
      </section>

      <section>
        <h2>Service limits</h2>
        <p>Draw &amp; Guess is provided as available without a promise that every whiteboard session, voice connection, AI guess, proof, or room update will be error-free. To the extent permitted by law, Draw &amp; Guess is not responsible for indirect losses arising from use of the game.</p>
      </section>

      <section>
        <h2>Changes</h2>
        <p>We may update these terms as Draw &amp; Guess evolves. Continuing to use the game after an update means the revised terms apply.</p>
      </section>
    </LegalPage>
  )
}
