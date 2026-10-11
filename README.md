# Opustia

Opustia is a mobile-first marketplace for booking trusted local service professionals. It is a TypeScript monorepo with a PostgreSQL-backed Express API, an Expo customer/professional app, and a React admin console.

The core workflow is server-enforced:

`discover → request booking → accept → quote → approve → arrive → OTP → complete → payment → review`

No client treats an action as authoritative. Booking transitions, quote changes, payment verification, role checks, ownership checks, and OTP verification are all handled by the API.

## Workspace layout

```
apps/
  api/       Express + Prisma + Socket.IO service
  mobile/    Expo Router React Native app
  admin/     Vite React administration console
packages/
  shared/    Shared client-facing TypeScript vocabulary
prisma/      PostgreSQL schema, migrations, and seed data
```

## What is included

- JWT access/refresh authentication with Argon2 password hashes and role checks.
- PostgreSQL/Prisma models for marketplace, trust, booking, payment, dispute, warranty, and subscription domains.
- Search backed by PostgreSQL queries, with service/category/rating/price/verification/location-related filters.
- A protected booking state machine, idempotent booking/payment handling, booking event history, and arrival OTP workflow.
- Quotes with immutable history and explicit customer acceptance for changes.
- Socket.IO conversation/message persistence, unread state, and notification persistence.
- Reliability metrics derived from platform activity rather than editable profile claims.
- Privacy-aware verification and admin workflows.
- Expo screens for customer and professional journeys, with loading, empty, error, and offline-aware states.
- A role-protected admin console whose data is fetched from the API.

## Requirements

- Node.js 20.18+ (Node 22 LTS is recommended)
- npm 10+
- PostgreSQL 16+ **or** Docker Desktop
- An Expo-compatible Android/iOS device or emulator for mobile development

The included `docker-compose.yml` runs PostgreSQL locally; it does not contain production secrets.

## First run

### Windows PowerShell quick start

Run npm commands from the folder that contains the root `package.json`:

```powershell
Set-Location "C:\Users\vishw\Documents\Codex\2026-10-07\files-pasted-by-the-user-build"
npm install
npm run dev:api
```

If PowerShell shows a path such as `C:\Windows\System32\package.json`, change directories first; npm always uses the current folder's `package.json`.

1. Install workspace dependencies:

   ```bash
   npm install
   ```

2. Copy configuration:

   ```bash
   cp .env.example .env
   ```

   In PowerShell use `Copy-Item .env.example .env`.

3. Start PostgreSQL. With Docker:

   ```bash
   docker compose up -d postgres
   ```

4. Generate Prisma Client, apply the migration, and load fictional development data:

   ```bash
   npm run db:generate
   npm run db:migrate
   npm run db:seed
   ```

5. Start the services in separate terminals:

   ```bash
   npm run dev:api
   npm run dev:admin
   npm run dev:mobile
   ```

The API defaults to `http://localhost:4000` and the admin console to `http://localhost:5173`.

### API health check

```bash
curl http://localhost:4000/health
```

Expected response:

```json
{ "success": true, "message": "Opustia API is running" }
```

## Environment variables

Begin from [`.env.example`](.env.example). Important values:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection used by Prisma and the API |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Separate high-entropy signing secrets |
| `WEB_ORIGIN` | Allowed browser origin for CORS |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Razorpay test-mode credentials (optional in local setup) |
| `RAZORPAY_WEBHOOK_SECRET` | Signature secret for payment webhook verification |
| `EXPO_ACCESS_TOKEN` | Optional token for sending Expo push notifications |

Never commit a populated `.env` file. Generate unique, long secrets outside local development.

For physical-device Expo testing, set `EXPO_PUBLIC_API_URL` in `apps/mobile/.env` to the LAN-reachable API URL, e.g. `http://192.168.x.x:4000/api`.

## Demo data

The seed creates ten fictional service categories, three professional profiles, and customer, professional, and administrator demo accounts. It is safe to run again; it upserts the demo records.

| Role | Email | Password |
| --- | --- | --- |
| Customer | `customer@opustia.demo` | `demo123` |
| Professional | `pro@opustia.demo` | `demo123` |
| Admin | `admin@opustia.demo` | `demo123` |

The API stores account passwords as salted scrypt hashes. Marketplace records are stored in PostgreSQL through Prisma. Apply the checked-in migrations before seeding with `npm run db:migrate` and `npm run db:seed`.

> The seed password and account names are intentionally development-only. Change or remove them before exposing any environment.

## Developer commands

| Command | What it does |
| --- | --- |
| `npm run dev:api` | Runs the API in watch mode |
| `npm run dev:admin` | Runs Vite admin development server |
| `npm run dev:mobile` | Starts Expo |
| `npm run db:generate` | Generates Prisma Client |
| `npm run db:migrate` | Runs Prisma migrations in development |
| `npm run db:seed` | Loads fictional sample records |
| `npm run typecheck` | Type checks packages that expose a type-check script |
| `npm run lint` | Runs package linters when configured |
| `npm run test` | Runs API/unit/integration tests |
| `npm run build` | Builds packages that expose a build script |

## API overview

All API responses use a consistent `success` envelope. Private endpoints require an access token in `Authorization: Bearer <token>`; refresh tokens are rotated and not exposed in normal profile responses.

| Area | Representative endpoints |
| --- | --- |
| Auth | `POST /api/auth/register`, `login`, `refresh`, `logout`; `GET /api/auth/me` |
| Discovery | `GET /api/categories`, `/api/services`, `/api/professionals`, `/api/professionals/:id` |
| Booking | `POST /api/bookings`; `GET /api/bookings/:id`; `PATCH /api/bookings/:id/status` |
| Quotes | `POST /api/quotes`; `PATCH /api/quotes/:id` |
| Messaging | `GET/POST /api/conversations`, `GET/POST /api/conversations/:id/messages` |
| Trust | reviews, favorites, verification, reliability, notifications, warranties, and disputes |
| Money | `POST /api/payments/create-order`, `POST /api/payments/verify`, subscriptions |
| Admin | role-protected administrative list/review/moderation endpoints |

See `apps/api/src/routes` for the complete route registry and request schemas.

## Booking lifecycle and trust safeguards

- State changes are defined in one server-side transition policy. Invalid transitions and changes from nonparticipants are rejected.
- The professional cannot start work until the server validates the customer-visible, expiring arrival OTP.
- Every important action writes an append-only `BookingEvent`; the timeline is not overwritten.
- A new quote supersedes an earlier open quote. Amount changes require the customer to decide again.
- Reviews require an eligible completed booking and enforce one review per booking.
- Reliability data is computed from completed/cancelled bookings, response/arrival evidence, and reviews only after minimum sample thresholds. Profiles cannot write their own score.
- Identity and credential documents are stored as protected references and are never exposed by public professional endpoints.

## Payments and subscriptions

The payment adapter is isolated from booking and subscription services. Razorpay operations use server-created orders and server-side signature verification. Client-reported payment success is not trusted. Request idempotency keys prevent duplicate payment/booking effects.

Razorpay should remain in test mode locally. Add test credentials to `.env`; do not put credentials in mobile or admin code.

## Testing

Run:

```bash
npm run typecheck
npm run test
npm run build
```

Integration tests need a disposable PostgreSQL database. Use a test-specific `DATABASE_URL` (never the production database). The suite covers authentication and authorization, discovery, booking conflict protection, quotes, OTP, reviews, favorites, disputes, warranties, reliability calculations, payment verification, and the core booking loop.

## Production notes

Before deploying, use managed PostgreSQL, object storage for uploads/documents, an Expo push credentials setup, HTTPS origins, a real secrets manager, CSP/CORS restrictions matching deployed clients, observability, backup/restore policies, and Razorpay webhooks. This repository is an application foundation, not a claim that a local `.env` is production-safe.
