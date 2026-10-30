# QUBA CAFE & RESTAURANT

Owner-only cafe management in Sorani Kurdish and Arabic, backed by Firebase Authentication and Cloud Firestore.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/quba-cafe run dev` — run the QUBA web app
- `pnpm --filter @workspace/quba-cafe run typecheck` — typecheck the QUBA web app
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- QUBA Firebase setup: see `artifacts/quba-cafe/FIREBASE_SETUP.md` and `.env.example`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 (shared workspace service; QUBA data uses Firebase directly)
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- QUBA web: React + Vite + Firebase Auth/Firestore client SDK

## Where things live

- `artifacts/quba-cafe/src/App.tsx` — owner dashboard and management screens
- `artifacts/quba-cafe/src/lib/firebase.ts` — Firebase client configuration and owner sign-in
- `artifacts/quba-cafe/src/lib/cafe-data.ts` — live Firestore subscriptions and mutations
- `artifacts/quba-cafe/src/lib/types.ts` — cafe record contracts
- `artifacts/quba-cafe/firestore.rules` — owner-scoped Firestore security rules
- `artifacts/quba-cafe/FIREBASE_SETUP.md` — Firebase configuration and rules deployment steps

## Architecture decisions

- Sorani is the default locale; Arabic is available as a second RTL locale.
- Firebase Auth has no sign-up path. The configured owner UID is checked by the app, and Firestore paths are scoped by UID.
- QUBA must not use sample records or Firebase test-mode/public rules.
- Order item names and unit prices are stored on each order line so later menu edits do not rewrite order history.
- Payments are recorded as separate entries on the order; paid orders are not deleted or cancelled.

## Product

The owner can manage the menu, categories, tables, orders and payments, expenses, customers, date-filtered reports, and restaurant settings. The app uses IQD and supports phone-sized screens.

## User preferences

- Do not use fake data or weaken Firebase security rules.
- Do not request the owner's password or a Firebase service-account key.

## Gotchas

- Firebase web app values and the owner UID are read from the variables listed in `artifacts/quba-cafe/.env.example`; restart the web workflow after changing them.
- `artifacts/quba-cafe/firestore.rules` must be published in the owner's Firebase console. Rules are not deployed automatically by this app.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
