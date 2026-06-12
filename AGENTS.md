# CoffeeAtlas Project Guide for AI Agents

> This file is the single source of truth for AI coding agents working on CoffeeAtlas. Read it before making any changes. All information below reflects the actual state of the repository.

---

## Project Overview

**CoffeeAtlas** is a specialty coffee bean, roaster, and origin exploration platform. It consists of a WeChat miniprogram frontend and a Next.js API backend, backed by Supabase (PostgreSQL).

- **Architecture**: Monorepo (pnpm workspace + Turborepo)
- **Package Manager**: pnpm `9.15.4` (required; do not use npm)
- **Node.js**: `>=20.9.0`
- **Main Language**: TypeScript (strict mode enabled)

### Workspace Packages

| Path | Package Name | Role |
|------|-------------|------|
| `apps/api` | `@coffeeatlas/api` | Next.js 16 API backend (Route Handlers) |
| `apps/miniprogram` | `@coffeeatlas/miniprogram` | Taro 3.6.30 WeChat miniprogram |
| `packages/shared-types` | `@coffee-atlas/shared-types` | Authoritative API contracts (active) |
| `packages/api-client` | `@coffee-atlas/api-client` | Cross-platform client helpers (preliminary) |
| `packages/domain` | `@coffee-atlas/domain` | Pure domain logic (preliminary) |

### Runtime Architecture

- **API**: Next.js 16 with React 19, deployed as an API-only service (`/api/*`). Uses App Router with Route Handlers.
- **Miniprogram**: Taro 3.6.30 + React 18.2.0, compiled to WeChat miniprogram.
- **Database**: Supabase (PostgreSQL) with Row Level Security (RLS).
- **External Integrations**: WeChat login (`jscode2session`), Taobao product sync (internal).

---

## Build and Development Commands

All commands run from the repository root unless noted otherwise.

### Install Dependencies
```bash
pnpm install
```

### Development
```bash
# Start miniprogram with auto-repush watcher (default dev command)
pnpm dev

# Start API backend only
pnpm dev:api

# Start miniprogram WeChat build in watch mode
pnpm --filter @coffeeatlas/miniprogram dev:weapp

# Start miniprogram auto-repush helper
pnpm dev:miniprogram:auto
```

The auto-repush helper (`scripts/miniprogram-auto-repush.mjs`) watches `apps/miniprogram` and related shared packages for changes, then automatically restarts the Taro WeChat build. This is useful because the WeChat Developer Tool often needs a fresh Taro push to show the latest preview.

### Build
```bash
# Build all packages via Turborepo
pnpm build

# Build specific package
pnpm --filter @coffeeatlas/api build
pnpm --filter @coffeeatlas/miniprogram build:weapp
```

### Type Checking
```bash
pnpm typecheck
```

### Linting
```bash
pnpm lint
```

### Testing
```bash
# API unit tests (node:test + node:assert/strict)
pnpm --filter @coffeeatlas/api test

# Miniprogram tests (node:test + experimental-strip-types)
pnpm --filter @coffeeatlas/miniprogram test

# API smoke test (requires running server)
cd apps/api && API_BASE_URL=http://127.0.0.1:3000 pnpm smoke:api
```

---

## Code Organization

### `apps/api` — Backend

Uses Next.js App Router with Route Handlers. No pages UI; it is API-only.

```
app/api/v1/          # Primary v1 API routes
app/api/admin/       # Admin API routes
app/api/beans/       # Legacy bean routes (compatibility layer)
app/api/roasters/    # Legacy roaster routes (compatibility layer)
lib/server/          # Service logic, auth, DTO assembly
lib/catalog*.ts      # Catalog reading, queries, sample fallback
lib/taobao-sync/     # Taobao product sync logic
lib/supabase.ts      # Supabase client setup
db/sql/              # Schema definitions (010_schema.sql, etc.)
db/migrations/       # Incremental SQL migrations
db/manual/           # One-off manual SQL patches
scripts/             # Import scripts, smoke tests, sync scripts
data/                # Static data files, roaster bindings
```

All v1 API routes use a unified response envelope defined in `packages/shared-types`:
```ts
{ ok: true, data: T, meta: { requestId, cached? } }
{ ok: false, error: { code, message }, meta: { requestId } }
```

### `apps/miniprogram` — WeChat Miniprogram

Built with Taro 3.6.30 and React 18.2.0.

```
src/pages/           # Miniprogram pages
  onboarding/        # Onboarding flow
  onboarding-guided/ # Guided onboarding
  all-beans/         # Bean catalog / discovery
  index/             # New arrivals (home)
  profile/           # User profile, favorites, badges
  bean-detail/       # Bean detail page
  roaster-detail/    # Roaster detail page
  debug/             # Debug utilities
src/components/      # Shared components (PascalCase)
src/utils/           # Utilities (api-config, auth, storage, formatters)
src/types/           # TypeScript declarations
```

Tab bar has three tabs: 选豆 (all-beans), 新品 (index), 我的 (profile).

### `packages/shared-types` — Active Contract Layer

The authoritative source for API DTOs and shared types. Must be built before packages that depend on it.

```
src/index.ts         # Re-exports all types
src/catalog/         # Bean/roaster catalog types
src/roasters/        # Roaster-specific types
src/favorites/       # Favorite types
src/common/          # Pagination, common structures
src/process.ts       # Coffee process enums/mappers
```

### `packages/api-client` and `packages/domain`

Preliminary abstractions. Do not move logic here unless it is truly cross-platform and stable. These packages compile to `dist/` via `tsc -b`.

---

## Key Configuration Files

| File | Purpose |
|------|---------|
| `package.json` | Root monorepo manifest, workspace scripts |
| `pnpm-workspace.yaml` | pnpm workspace definition |
| `turbo.json` | Turborepo pipeline (build, typecheck, lint, dev) |
| `tsconfig.base.json` | Shared TS config with `@coffee-atlas/*` path aliases |
| `tsconfig.json` (root) | Project references for `packages/*` |
| `eslint.config.mjs` | ESLint 9 flat config |
| `apps/api/next.config.ts` | Next.js config (minimal) |
| `apps/api/tsconfig.json` | API TS config with `@/*` alias |
| `apps/miniprogram/tsconfig.json` | Miniprogram TS config with `@/*` -> `src/*` |
| `apps/miniprogram/babel.config.cjs` | Babel config for Taro |
| `apps/miniprogram/project.config.json` | WeChat miniprogram project config |
| `.env.example` | Template for all required environment variables |

---

## Environment Variables

Copy `.env.example` to `.env.local` for local development.

### Required for API
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key (client-safe)
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key (server-only)
- `APP_JWT_SECRET` — JWT secret for WeChat auth
- `WECHAT_APP_ID` / `WECHAT_APP_SECRET` — WeChat miniprogram credentials

### Required for Miniprogram
- `TARO_APP_API_URL` — API base URL for miniprogram runtime
- `TARO_APP_SUPABASE_URL` / `TARO_APP_SUPABASE_ANON_KEY` — Supabase read-only access

### Internal Scripts
- `TAOBAO_MCP_URL` — Taobao MCP endpoint for product sync
- `TAOBAO_SYNC_MAX_ITEMS_PER_SHOP` / `TAOBAO_SYNC_DELAY_*` — Sync throttling
- `VISION_BASE_URL` / `VISION_API_KEY` / `VISION_MODEL` — Optional OCR fallback

**Security note**: Do not embed keys, domains, or local absolute paths in new scripts. Read sensitive config only through `process.env.*`. Client-visible configs must use `NEXT_PUBLIC_*` or `TARO_APP_*` prefixes.

---

## Code Style Guidelines

### Naming Conventions
- **Components**: PascalCase (`BeanCard`, `SearchBar`)
- **Route segments**: kebab-case directory names (`all-beans/page.tsx`)
- **Helpers / utils**: camelCase exports, kebab-case filenames
- **Constants**: `UPPER_SNAKE_CASE`
- **Types / interfaces**: PascalCase

### Monorepo Boundaries
- `packages/*` must remain platform-agnostic. Do not import `next/*` or `@tarojs/*` into packages.
- Cross-layer contracts must go through `@coffee-atlas/shared-types`.
- Apps do not directly import each other's internal files.

### TypeScript
- `strict: true` is required everywhere.
- Avoid `any`. Export functions and complex helpers with explicit type boundaries.
- Separate row shapes, internal models, and DTOs. Do not mix them.

### Route Handler Structure
- Route handlers (`route.ts`) handle: request parsing, auth, calling service, returning response.
- Complex queries and DTO assembly go into `apps/api/lib/server/**` or `apps/api/lib/catalog*.ts`.
- Do not stack large DB queries, auth, or transform logic directly inside `route.ts`.

### Copy / Text Change Policy
- **Do not modify existing UI text, descriptions, tooltips, onboarding copy, or button labels unless explicitly requested or the text becomes factually incorrect due to code changes.**
- Much of the copy has been human-reviewed and polished. Preserve original wording even when page structure changes.
- If new copy is absolutely necessary, keep it minimal, neutral, and functional.

---

## Testing Instructions

### API Tests
- **Runner**: Node.js built-in (`node:test` + `node:assert/strict`)
- **Location**: `apps/api/tests/**/*.test.ts`
- **Command**: `pnpm --filter @coffeeatlas/api test`
- Source files can be imported directly with `.ts` extensions (via `--experimental-strip-types`).

### When to Add Tests
| Scenario | Action |
|----------|--------|
| New or changed pure functions | Add unit test |
| Fixed parameter validation / parsing bug | Add regression test |
| Adjusted shared contract mapping logic | Add unit test if verifiable in pure function |
| Next.js route shell changes only | Type-check + manual smoke test |
| Real Supabase / WeChat dependent flows | Type-check + manual test + `smoke:api` |
| UI text or static style changes | Usually no test needed |

### Preferred Test Targets
Low-coupling modules such as:
- `apps/api/lib/server/api-primitives.ts`
- `apps/api/lib/sales.ts`
- `packages/domain/**` pure functions
- Independent mappers, sanitizers, and parsers

Avoid writing heavy integration tests that depend on Next.js runtime or real DB as the first line of coverage.

### Miniprogram Testing
- Automated tests exist in `apps/miniprogram/tests/**/*.test.ts` using `node:test`.
- Most miniprogram validation is done via `typecheck` and manual testing in WeChat Developer Tool.

---

## Database

- **Platform**: Supabase (PostgreSQL)
- **Schema**: `apps/api/db/sql/010_schema.sql` (385 lines)
- **Indexes**: `apps/api/db/sql/020_indexes.sql`
- **RLS**: `apps/api/db/sql/030_rls.sql`
- **Views & Functions**: `apps/api/db/sql/040_views_and_functions.sql`
- **Seed Data**: `apps/api/db/sql/050_seed_minimal.sql`
- **Migrations**: `apps/api/db/migrations/*.sql` (numbered, incremental)
- **Manual Patches**: `apps/api/db/manual/*.sql` (one-off fixes)

Key tables include: `roasters`, `beans`, `sources`, `app_users`, `favorites`, `taobao_roaster_bindings`, `user_badge_progress`, `import_jobs`. Custom enums include `publish_status`, `source_type`, `import_job_status`, etc.

Database triggers handle `updated_at` maintenance and coffee process normalization automatically.

---

## Deployment Process

- No CI/CD workflows are currently configured (`.github/workflows/` is empty).
- The API is a standard Next.js application that can be deployed to any platform supporting Node.js (e.g., Vercel, Docker).
- The miniprogram is built by Taro and uploaded via the WeChat Developer Tool.
- `apps/api/.env` is a symlink to `../../.env.production` for production configuration.

---

## Security Considerations

- **Service Role Key**: `SUPABASE_SERVICE_ROLE_KEY` must never be exposed client-side. Use it only in server-side API routes.
- **JWT Secret**: `APP_JWT_SECRET` must be a strong random string. It signs tokens for WeChat miniprogram users.
- **WeChat Credentials**: `WECHAT_APP_ID` and `WECHAT_APP_SECRET` are sensitive and server-only.
- **RLS**: Supabase Row Level Security is enabled. New tables should have appropriate RLS policies.
- **Env files**: `.env*.local` files are gitignored. Do not commit real secrets.
- **Historical debt**: Some existing env files and import scripts contain real/default sensitive values. New code must not continue this pattern.

---

## Important Real-World Constraints

- `apps/api/app/api/beans` and `apps/api/app/api/roasters` are legacy compatibility layers. The primary API surface is `/api/v1/**`.
- v1 contracts are defined in `packages/shared-types`. Miniprogram local types must stay in sync.
- Public catalog reads allow a sample fallback when the database is unavailable. Write interfaces, auth, and favorites do **not** allow fake writes.
- `packages/api-client` and `packages/domain` are partial abstractions. Do not migrate logic there unless it is genuinely stable and cross-platform.
- The Taobao sync subsystem (`apps/api/lib/taobao-sync/`, `apps/api/scripts/sync-*.ts`) is internal and depends on a local MCP server for data extraction.

---

## Communication Style (Agent Guidelines)

- Reply to users in **Chinese** by default.
- Keep explanations concise and direct. Avoid jargon.
- State results first, then explain what changed and why.
- When delivering changes, specify: what was done, which files were touched, why, and what the user should verify.
- Explicitly note whether any existing UI copy was modified. If new copy was added, describe what kind (tooltip, button label, empty state, etc.).

---

## Git Conventions

Use conventional commits:

```
feat(scope): description
fix(scope): description
docs(scope): description
refactor(scope): description
test(scope): description
chore(scope): description
```

Common scopes: `web`, `miniprogram`, `api`, `packages`, `db`.
