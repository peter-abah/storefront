# Maison — Editorial Shop Monorepo

Maison is a single-store Home & Living shop ("an interiors magazine that happens to sell"): an editorial Next.js storefront with COD + Paystack checkout, an admin dashboard, and a native Expo client that shares the same backend and contracts.

## What's inside

| Path | What it is |
| --- | --- |
| `apps/web` | Next.js 15 App Router storefront + admin + the `/api/mobile/v1/*` API consumed by the app. Drizzle/Neon (Docker Postgres locally), Better Auth, Cloudinary, Mailgun, Paystack. |
| `apps/mobile` | Expo SDK 55 / React Native client (Expo Router, TypeScript) for iOS + Android. See `apps/mobile/README.md`. |
| `packages/shared` | Zod schemas, DTO types and money helpers shared by web and mobile (`@maison/shared`). |
| `docs/` | `PRD.md`, `ARCHITECTURE.md`, `DECISIONS.md` (ADRs), `BUSINESS_FACTS.md`. |

## Prerequisites

- **Node ≥ 22.12** (`package.json#engines`).
- **pnpm 11.4.0** — pinned via `packageManager`; run `corepack enable` once.
- **Docker** — local Postgres 16 (`docker compose up -d db`) for web development.
- **Android release builds** — JDK 17 + Android SDK (see `apps/mobile/README.md` § Release build).

## Setup

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local   # fill secrets you need; never commit
cp apps/mobile/.env.example apps/mobile/.env   # EXPO_PUBLIC_API_URL (prod URL by default)

docker compose up -d db
pnpm db:migrate:local   # apply migrations to local Postgres
pnpm db:setup           # migrate + seed (products, currencies, zones; cod on / paystack off)
```

Full env reference: `docs/ARCHITECTURE.md` §8 and the comments in `apps/web/.env.example`.

## Common commands

| Command | Does |
| --- | --- |
| `pnpm dev:web` | Next dev server on its default port (3000). To match the mobile dev convention, use `pnpm --filter @maison/web dev -- -p 4100`. |
| `pnpm dev:mobile` | `expo start` for the native app. |
| `pnpm build:web` / `pnpm start:web` | Production build / serve of the web app. |
| `pnpm android:mobile` | `expo run:android` (debug build on device/emulator). |
| `pnpm lint` | Web ESLint. |
| `pnpm db:generate` / `db:migrate` / `db:check` / `db:push` / `db:status` | Drizzle migration + status tooling. |
| `pnpm db:setup` | Migrate + seed the database. |

**Local ports:** mobile-first development uses **:4100** for the local web API (`pnpm --filter @maison/web dev -- -p 4100`, or `PORT=4100`). Point the app at it with `EXPO_PUBLIC_API_URL=http://localhost:4100` and `adb reverse tcp:4100 tcp:4100` on Android. Port 3000 is reserved by another worktree in this workspace — do not start or kill a server there.

## Deployment

- **Vercel:** import the repo, set **Root Directory = `apps/web`**. Vercel traces the pnpm workspace from the repo root, so `packages/shared` and the root lockfile are picked up automatically. No build command changes are needed (`next build`).
- **Env:** provision the variables from `apps/web/.env.example` in the Vercel project (Neon pooled + unpooled `DATABASE_URL`s, `BETTER_AUTH_SECRET`/`BETTER_AUTH_URL` = the prod URL, Google OAuth IDs, Cloudinary, Mailgun, Paystack). `BETTER_AUTH_URL` must equal the deployed origin or OAuth callbacks break.
- **Database:** run `drizzle-kit migrate` once against Neon (`docs/ARCHITECTURE.md` §9).
- **Mobile:** the release APK bundles `EXPO_PUBLIC_API_URL` (`https://ashgrove.peterabah.com` by default); Google sign-in works against the prod API out of the box (`maison://` is a Better Auth trusted origin). Rebuild steps in `apps/mobile/README.md`.

## Docs index

- [`docs/PRD.md`](docs/PRD.md) — product requirements, scope, non-goals.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — system diagram, data model, auth/checkout/email flows, env matrix, mobile app.
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — ADR log (stack, auth, Paystack, mobile client, monorepo).
- [`docs/BUSINESS_FACTS.md`](docs/BUSINESS_FACTS.md) — store facts and placeholders.
