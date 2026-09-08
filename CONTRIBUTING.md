# Contributing

Thanks for helping improve Draw & Guess.

## Development

1. Fork the repository and create a focused branch.
2. Copy `.env.example`, `.dev.vars.example`, and `wrangler.example.jsonc` to their local counterparts.
3. Install dependencies with `pnpm install`.
4. Run `pnpm db:migrate:local` and `pnpm dev`.
5. Before opening a pull request, run:

```bash
pnpm test
pnpm typecheck
pnpm build
```

Keep credentials out of commits. Add tests for behavior changes, keep database migrations forward-only, and describe any Agora, model-provider, or Cloudflare setup required to review the change.

## Pull requests

Prefer small pull requests with one clear purpose. Include the problem, the approach, verification steps, and screenshots or recordings for user-interface changes.
