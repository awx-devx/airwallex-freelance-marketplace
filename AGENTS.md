# AGENTS.md

Guidance for AI coding agents (and humans) working in this repo.

## What this is

A **demo** freelance escrow marketplace built on a single **Airwallex sandbox** platform account. The seller sends a milestone-based offer, the buyer pays up front, and each milestone's funds are **held** (Funds Split with `auto_release: false`) and **released** only when the buyer approves. Every user gets an Airwallex **connected account** with a wallet. It is not production-ready by design.

Stack: Next.js (App Router, TypeScript), MongoDB (Mongoose), Tailwind v4 + shadcn/ui, TanStack Query over a typed API library, react-hook-form, zod, `@airwallex/components-sdk`. No Redis, no global client store.

We build **UI-first**: the UI kit and every screen run on an in-memory mock transport (`NEXT_PUBLIC_API_MOCKS=true`) before the backend exists (see `docs/12`, Track U).

## Read before coding

| Need | Read |
| --- | --- |
| Overview and reading order | `docs/README.md` |
| Money flows, fee math, every Airwallex endpoint | `docs/03-airwallex-integration.md` |
| Schemas and state machines | `docs/04-data-model.md` |
| Flow-by-flow behaviour | `docs/05-user-flows.md` |
| REST contract (routes, DTOs, errors, `allowedActions`) | `docs/06-api-routes.md` |
| API library, React Query hooks, mocks, state management | `docs/14-frontend-architecture.md` |
| UI kit, design tokens, `/dev/ui-kit`, page specs | `docs/09-ui-pages.md` |
| Webhooks | `docs/07-webhooks.md` |
| Demo shortcuts and comment tags | `docs/10-demo-vs-production.md` |
| Build order | `docs/12-implementation-plan.md` |
| Unverified Airwallex behaviour | `docs/13-open-questions-and-risks.md` |

Focused rules live in `.cursor/rules/*.mdc`.

## Hard rules

1. **Airwallex is server-side only.** Never expose API keys or call Airwallex from client code.
2. **Integer minor units internally**; Airwallex takes decimal major units, not cents. Convert only in `src/lib/money.ts`.
3. **Status-guarded (conditional) updates** for every offer/milestone transition. Webhook updates are monotonic and idempotent.
4. **Deterministic `request_id`s** for all Airwallex create calls.
5. **Webhooks are the source of truth** for money state. Browser checkout success is provisional.
6. **Never** pass `funds_split_data` on PaymentIntent create (it auto-releases and breaks escrow).
7. Don't invent Airwallex endpoints or fields. Check `docs/03` or https://www.airwallex.com/docs/llms.txt.

## Comment tags (required)

Tag shortcuts where they live, and keep `docs/10-demo-vs-production.md` in sync:

- `DEMO-ONLY:` unsafe or incorrect in production, always followed by `PROD:` with the real approach
- `SANDBOX:` relies on sandbox-only Airwallex features (simulation endpoints, test cards, pre-funded wallet)
- `AIRWALLEX:` non-obvious API constraint, with a docs link

Audit with `rg -n "DEMO-ONLY:|SANDBOX:" src scripts`.

## Commits

**Ask the user before every commit** (show the message and files) unless they have explicitly said to keep committing without asking in the current conversation. Follow [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/). Commit **small and often**, one logical unit per commit, and each commit should typecheck so it can be reverted cleanly. Update docs in the same commit as the behaviour they describe. Format: `type(scope): summary`. Scopes and examples are in `.cursor/rules/git-commits.mdc`. Never commit secrets or `.env.local`. Don't push unless asked.

## Commands (once scaffolded)

```bash
npm run dev          # Next.js dev server
npm run seed         # idempotent sandbox + DB seed
npm run reset        # wipe demo data in Mongo (keeps Airwallex accounts)
npm run test         # unit tests
npm run typecheck && npm run lint
```

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

