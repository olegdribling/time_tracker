# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development (two terminals)
npm run dev                          # Frontend on :5173 (Vite, proxies /api → :3001)
cd my-saas/server && npm run dev     # Backend on :3001 (nodemon)

# Build & deploy
npm run build                        # tsc + vite build → dist/
npm run deploy                       # build + git commit + push (GitHub Actions deploys to Hostinger)

# Test & lint
npm run test                         # Vitest (src/lib/calculations.test.ts)
npm run lint                         # ESLint
```

## Architecture

Full-stack SaaS for work shift tracking, pay calculation, and invoice generation.

**Frontend:** React 19 + TypeScript + Vite (`src/`). Single-page app — all routes fall through to `index.html`.

**Backend:** Node.js/Express 5 + PostgreSQL (`my-saas/server/src/`). Serves the built `dist/` as static files and exposes `/api/*` routes.

**Database:** PostgreSQL on Neon.tech (AWS Sydney), accessed via `DATABASE_URL` env var. Schema managed by individual migration scripts in `my-saas/server/src/db/migrate-*.js` — run them manually when adding new tables/columns.

**IndexedDB (Dexie):** `src/db.ts` — used as local cache for shifts, settings, invoice profile. Backend is source of truth.

## Key Files

| File | Purpose |
|------|---------|
| `src/App.tsx` | Main component (~1900 lines) — all views, state, modals, forms |
| `src/App.css` | All component styles (dark navy design system) |
| `src/index.css` | CSS variables, WheelPicker styles, auth page styles |
| `src/types.ts` | Domain types: `Shift`, `ShiftForm`, `Settings`, `Client`, `Product`, `InvoiceProfile` |
| `src/api.ts` | REST client with JWT refresh token rotation |
| `src/lib/calculations.ts` | Period ranges, pay totals, shift grouping logic |
| `src/lib/invoice.ts` | Client-side PDF generation via pdf-lib |
| `my-saas/server/src/app.js` | Express entry — middleware, route mounting, SPA fallback |
| `my-saas/server/src/routes/` | Auth, shifts, settings, clients, products, invoice-profile, billing |
| `my-saas/server/src/middleware/auth.js` | JWT verification, sets `req.userId` |

## Design System

- Primary: `--header-bg: #1a2b42` (dark navy)
- Background: `--app-bg: #f0f2f5` (light gray)
- Icon badge colors: clock=`#eef0f6`, lunch=`#fff8e6`/amber, money=`#e8f8ee`/green
- Modal pattern: `.modal-header-dark` + `.modal-title-dark` + `.modal-close-btn`
- Shift cards: `.shift-card` > `.shift-card__header` + `.shift-info-row` > `.shift-icon-badge`
- Context menus: `openMenuXxxId` state pattern, `.shift-menu-btn` (circle) + `.shift-context-menu`
- Right-side menu panel: `.menu-panel` + `.menu-overlay` (not a dropdown)
- FAB: `.floating-btn` (58px circle, bottom-right), `.fab-menu` above it
- Bottom-sheet pickers: `.picker-sheet-backdrop` (z-index 300) + `.picker-sheet` (z-index 301)

## Important Constraints

**`dist/` is committed to git.** The Hostinger server cannot rebuild (no tsc/esbuild access). Always run `npm run build` locally before deploying.

**`VITE_API_URL` must be empty** in `.env`. The API client uses relative URLs (`''`) so requests go to the same origin. Setting it to `localhost:3001` bakes it into the frontend bundle.

**`postinstall`** only runs `cd my-saas/server && npm install` — no build step. Adding a build to postinstall breaks Hostinger deployments (it wipes `dist/`).

**Express 5 syntax** required for the catch-all route: `app.get('/{*path}', ...)` — not `app.get('*', ...)`.

**Shifts have UUID `id`** (string), not integer — used for offline-first compatibility.

**Overnight shifts** (end < start) are handled in `minutesBetween()` by adding 24h.

**After login/register** use `window.location.href = '/app'` (not `navigate('/app')`) to force a full page reload and clear stale React state from a previous session.

## Deployment (Hostinger)

- **Auto-deploy:** `git push` to `main` → GitHub Actions SSH into Hostinger → `git reset --hard` + `touch tmp/restart.txt`
- **LiteSpeed (lsnode)** manages the Node process. Never start node manually (blocks the port → 503).
- **Restart:** `touch ~/domains/invairo.com.au/nodejs/tmp/restart.txt`
- **SSH:** `ssh -i ~/.ssh/hostinger_deploy -p 65002 u673267555@153.92.9.238`
- **Env config** lives at `~/domains/invairo.com.au/public_html/.builds/config/.env` — not in the git repo.
- If GitHub Actions SSH times out (i/o timeout) — it's Hostinger being temporarily unreachable; re-run the workflow or deploy manually via SSH.

## Environment Variables

| Variable | Where | Notes |
|----------|-------|-------|
| `DATABASE_URL` | Server | Neon.tech PostgreSQL connection string |
| `JWT_SECRET` | Server | Access + refresh token signing key |
| `RESEND_API_KEY` | Server | Transactional email |
| `STRIPE_SECRET_KEY` | Server | Optional — server starts without it |
| `APP_URL` | Server | `https://invairo.com.au` in production |
| `VITE_API_URL` | Frontend build | Must be empty string |
