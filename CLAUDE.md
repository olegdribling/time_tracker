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
npx vitest run src/lib/calculations.test.ts  # Run single test file
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
| --- | --- |
| `src/App.tsx` | Main component (~2500 lines) — all views, state, modals, forms |
| `src/App.css` | All component styles (dark navy design system) |
| `src/index.css` | CSS variables, WheelPicker styles, auth page styles |
| `src/types.ts` | Domain types: `Shift`, `ShiftForm`, `Settings`, `Client`, `Product`, `InvoiceProfile`, `ArchivedInvoice` |
| `src/api.ts` | REST client with JWT refresh token rotation |
| `src/lib/calculations.ts` | Period ranges, pay totals, shift grouping logic |
| `src/lib/defaults.ts` | Default values for `Settings` and `InvoiceProfile` |
| `src/lib/format.ts` | `formatDate()`, `money()` helpers |
| `src/lib/invoice.ts` | Client-side PDF generation via pdf-lib |
| `src/components/CreateInvoiceModal.tsx` | Invoice builder modal + `calcLineItemAmount` |
| `src/components/InvoicesView.tsx` | Invoice archive list view |
| `src/components/ExpensesView.tsx` | Expenses list + add/edit form + receipt scan confirm flow |
| `src/components/BottomNav.tsx` | Bottom navigation bar (home / invoices / expenses / reports) |
| `src/components/GlobalFab.tsx` | Reusable FAB — supports `'action'` items and `'file'` picker items |
| `src/components/CameraCapture.tsx` | In-browser camera for capturing receipt photos |
| `src/hooks/useSettings.ts` | Settings modal state + save logic |
| `src/hooks/useProducts.ts` | Products CRUD state + plan-gating logic |
| `src/hooks/useExpenses.ts` | Expenses CRUD + receipt-scan state machine (`idle→scanning→confirming→saving`) |
| `src/pages/AppPage.tsx` | Thin wrapper that renders `<App>` behind `ProtectedRoute` |
| `src/pages/BillingPage.tsx` | Subscription management page |
| `src/auth/ProtectedRoute.tsx` | Redirects unauthenticated users to `/login` |
| `my-saas/server/src/app.js` | Express entry — middleware, route mounting, SPA fallback |
| `my-saas/server/src/routes/` | Auth, shifts, settings, clients, products, invoice-profile, billing, invoices |
| `my-saas/server/src/middleware/auth.js` | JWT verification, sets `req.userId` |

## Routing

`src/main.tsx` defines all routes via React Router. Public routes: `/login`, `/register`, `/forgot-password`, `/reset-password`, `/terms`, `/privacy`, `/refund`, `/delete-account`. Protected routes (wrapped in `ProtectedRoute`): `/app/*` → `AppPage` (renders `App`), `/app/billing` → `BillingPage`. Root `/` redirects to `/login`.

## App Views (activeView state)

`App.tsx` uses a single `activeView` state (`'home' | 'reports' | 'calendar' | 'clients' | 'products' | 'invoices' | 'expenses'`) to switch between views — there is no client-side routing for these. `InvoicesView` and `ExpensesView` are separate components; all other views render inline in `App.tsx`. Navigation between the four main tabs (home / invoices / expenses / reports) is via `BottomNav`.

## Billing / Subscription Plans

Plans: `'trial'` | `'solo'` | `'pro'`. Retrieved from `/api/billing/status` on load, stored as `billingPlan` state. Free-plan limits enforced client-side (e.g. max 1 client on trial/solo). `requireActive()` checks if the subscription is still valid before any mutation. Stripe price IDs come from `STRIPE_PRICE_SOLO` and `STRIPE_PRICE_PRO` env vars on the server.

## Key Patterns in App.tsx

- **`isMutatingRef`** — `useRef(false)` set to `true` during any CRUD operation; `syncData()` (background refresh) skips if `true` to avoid overwriting optimistic state.
- **`closeOverlays()`** — must be called before opening any modal/view to reset all open menus and overlays to a clean state.
- **`openMenu` state** — unified `{ type: 'shift' | 'product' | 'client', id }` replaces per-item `openMenuXxxId` pattern for context menus.

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

**Stripe webhook route** (`/api/billing/webhook`) must be registered before `express.json()` in `app.js` — it needs a raw `Buffer` body, not parsed JSON.

**PWA service worker** uses `navigateFallback: null` in `vite.config.ts` — this prevents the SW from intercepting `/api/*` requests and serving `index.html` instead.

## Deployment (Hostinger)

- **Auto-deploy:** `git push` to `main` → GitHub Actions SSH into Hostinger → `git reset --hard` + `touch tmp/restart.txt`
- **LiteSpeed (lsnode)** manages the Node process. Never start node manually (blocks the port → 503).
- **Restart:** `touch ~/domains/invairo.com.au/nodejs/tmp/restart.txt`
- **SSH:** `ssh -i ~/.ssh/hostinger_deploy -p 65002 u673267555@153.92.9.238`
- **Env config** lives at `~/domains/invairo.com.au/public_html/.builds/config/.env` — not in the git repo.
- If GitHub Actions SSH times out (i/o timeout) — it's Hostinger being temporarily unreachable; re-run the workflow or deploy manually via SSH.

## Expenses Feature

**Receipt scanning** — `POST /api/expenses/scan` (multipart, `receipt` field) sends the image/PDF to Claude claude-sonnet-4-6 via the Anthropic SDK (`ANTHROPIC_API_KEY` env var) and returns `{ vendor, amount, gst, category, expense_date }`. The client-side state machine lives in `useExpenses.ts` (`ScanState`: `idle → scanning → confirming → saving`). Duplicate detection runs client-side by comparing vendor + amount + date against existing expenses.

**FAB wiring** — `GlobalFab` receives `FabItem[]`. File-picker items (`kind: 'file'`) render hidden `<input type="file">` elements; the FAB manages click forwarding so no file input appears in the DOM hierarchy of the form.

## Environment Variables

| Variable | Where | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Server | Neon.tech PostgreSQL connection string |
| `JWT_SECRET` | Server | Access + refresh token signing key |
| `RESEND_API_KEY` | Server | Transactional email |
| `STRIPE_SECRET_KEY` | Server | Optional — server starts without it |
| `ANTHROPIC_API_KEY` | Server | Required for receipt scanning (`/api/expenses/scan`) |
| `APP_URL` | Server | `https://invairo.com.au` in production |
| `VITE_API_URL` | Frontend build | Must be empty string |
