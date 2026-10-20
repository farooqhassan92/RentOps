# RentOps

A focused car rental ERP built with Next.js App Router, TypeScript, Tailwind CSS, Clerk, Prisma, and PostgreSQL. Public signup creates an independent business with **one owner and one branch**. There are no invitations, staff roles, or shared company accounts.

## What works

The interface uses a modern SaaS design with a navy sidebar, light workspace, blue accents, and locally hosted Geist typography. Fleet supports searchable table and card views. Mobile navigation uses a keyboard-accessible dialog, and wide data tables scroll inside their panels.

UI source follows the repository Prettier configuration. Use `npm run format` to format pages, components, and CSS, or `npm run format:check` to verify formatting.

- Public Clerk signup/sign-in, protected resources, and business onboarding.
- Owner-derived workspace isolation on every read and mutation; composite tenant foreign keys protect relationships in PostgreSQL.
- Vehicle records, rates, document expiry, servicing reminders, readiness, and archival.
- Customers with driving licence details, private files, and rental history.
- Quotes, pricing review, vehicle-specific reservations, availability search, and 14-day calendar.
- Confirm, cancel, no-show, checkout, extend, replace vehicle, return, and financial closeout.
- Mobile-friendly inspections, fuel/charge and odometer readings, condition notes, photos, and signed document uploads.
- Daily, weekly, and anchored calendar-month billing; partial months are prorated.
- Invoices, credit notes, externally collected payments, receipts, deposits, refunds, deposit application/restoration, and balances.
- Printable PDF contracts, invoices, credit notes, and receipts. Invoice customer/business details are snapshotted at issue.
- Maintenance scheduling with booking conflicts, work completion, recorded costs, and overdue-work blocking.
- Dashboard, operational reports, CSV accounting exports, and append-only audit/financial records.
- A separate **read-only sample workspace** at `/demo`; it has no authentication bypass, write forms, or access to live data.

## Run locally

Requirements: Node.js 22.12+ (Node 24 recommended), npm, PostgreSQL 17+, and a Clerk application with public signup enabled.

```powershell
npm install
npm run db:generate
Copy-Item .env.example .env.local
```

Edit `.env.local` locally. Supply `DATABASE_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, and `CLERK_SECRET_KEY`. For Neon, use its pooled connection string for `DATABASE_URL` and its non-pooled **Direct connection** string for `DIRECT_URL`; Prisma uses the latter for schema migrations when it is available. Keep secrets out of Git. The Clerk publishable key is intentionally public; the secret key is server-only.

Use an existing PostgreSQL database or start the bundled development-only PostgreSQL in another terminal:

```powershell
npm run db:local
```

This binds to `127.0.0.1:55432`, creates a local `fleetora` database, and uses the development credentials in `.env.example`. Keep that terminal running. Never use these credentials or the bundled local database for production. On npm versions that block dependency lifecycle scripts, approve the embedded PostgreSQL platform package's hydration script or run it from that package before starting. The standard npm 10 installation runs it automatically.

Then:

```powershell
npm run db:migrate
npm run dev
```

Open `http://127.0.0.1:3000`. Sign up, then complete the business name, branch, country, currency, timezone, and invoice defaults. No seed data is added to a real business.

Without service configuration, `/` and `/demo` still work; private routes lead to `/setup`. No development login endpoint or mock authentication exists.

### Clerk configuration

1. Create a Clerk application and enable public signups with your chosen sign-in method. Invitations and Clerk Organizations are not used.
2. Add the development keys to `.env.local` and restart Next.js. Configure production keys and domains separately when deploying.
3. Keep sign-in/sign-up paths set to `/sign-in` and `/sign-up`; fallbacks point to `/dashboard` and `/onboarding`.
4. Enable email verification and configure MFA in Clerk according to your needs and plan.

The app uses `auth()` on the server to find a unique `Business.ownerClerkId`. Business identifiers and owner identities are never accepted from forms. Onboarding uses a unique owner constraint. New Clerk accounts do not inherit data from an account that happens to have the same email address. Webhooks are not required to provision a business.

## Your first rental

1. Add a vehicle with daily/weekly/monthly rates and valid insurance/registration expiry dates.
2. Add a customer with a valid driving licence.
3. Create a quote, review its total, and confirm the reservation.
4. Record the required deposit, then perform checkout during the reserved period.
5. Record invoice payments externally collected through cash, bank, or a card terminal.
6. Inspect and return the vehicle. It becomes **turnaround**, even if the customer still owes money.
7. Apply or refund the deposit and settle each invoice. Close the rental financially.
8. Mark the vehicle ready after cleaning and inspection.

### Billing policies

- All stored money is integer minor units; the currency's decimal precision is respected. Amounts are capped at 2 billion minor units per entry.
- Rates and tax are frozen on the quote. Daily units are elapsed 24-hour blocks; weekly units are elapsed seven-day blocks. Started blocks round up.
- Monthly boundaries retain the pickup's day/time in the business timezone, clamping short months without shifting the original anchor. Partial months use elapsed-time proration. Monthly discounts must fit in the first period.
- Extras and discount apply to the first monthly invoice. Invoice tax rounds per period; aggregate estimates may differ by minor units.
- Early returns retain the agreed charges. Issue a credit note for any approved reduction. Late daily/weekly returns add newly started agreed units; late monthly returns add started days at 1/30 monthly rate.
- Included kilometres cover the **whole rental**, including both vehicles if replaced. Extensions retain the same allowance; change the agreed allowance before confirmation if necessary.
- Refundable deposits are not rental income. Deposit deductions require an invoice and a reason.
- To refund a paid invoice: issue a credit note, then refund the resulting overpayment. If it was paid from a deposit, restore that credited portion to held deposits, then refund the deposit.
- Financial closeout requires zero held deposit and a zero balance on every invoice. Closed rentals reject new financial entries.
- Issued invoices, transactions, and audit events cannot be updated or deleted, including by Prisma. Corrections are additive.
- One inspected vehicle replacement is supported per rental; agreed rates stay unchanged. Multi-replacement workflows are outside this first release.

## Monthly billing job

Run the following at least hourly from a trusted scheduler on the server with `DATABASE_URL` set:

```powershell
npm run billing:run
```

It catches up due periods for active monthly rentals. Unique billing keys and business row locks make retries safe. Billing stops at the agreed end, with overdue charges added on physical return. Monitor failures in your scheduler; there is no public cron endpoint or background scheduler automatically installed by this project.

## Files and deployment

Uploads live under `PRIVATE_STORAGE_PATH`, defaulting to `.data/uploads`. The path must remain outside `public/`. Files are limited to 10 MB; JPG, PNG, WebP, and PDF signatures are checked. Downloads recheck workspace ownership and disable caching. Files are attachments, not executable HTML/SVG. PDFs use a locally bundled Noto Sans font; font licensing is in `assets/OFL.txt`.

Deploy as a **Node.js application with a persistent private volume**, behind HTTPS, backed by managed PostgreSQL. An ephemeral/serverless filesystem is unsuitable for the current upload adapter. An S3 adapter is not implemented. Keep a single app instance initially; scale only with shared durable storage. Use a separate staging database and Clerk instance.

```powershell
npm ci
npm run db:generate
npm run db:migrate
npm run build
npm run start
```

The CLI loads `.env.local` then `.env`; deployment environment variables take precedence. Regenerate Prisma Client after schema changes. Production dependencies need the generated client from the build.

Back up both PostgreSQL and the upload volume. Configure database point-in-time recovery and demonstrate a restore before live use. Provide application/error and scheduled-job monitoring through your host. Backup automation, uptime monitoring, and country-specific fiscal integrations are deployment work, not installed services in this repository.

## Tests

```powershell
npm run typecheck
npm test
npm run test:integration
npm run build
npm run test:e2e
```

Unit checks cover currency precision, tax rounding, daily/weekly/monthly pricing, timezone validation, deposit balances, CSV injection protection, and PDF generation.

PostgreSQL integration checks create a uniquely named **disposable database**, apply every migration, exercise tenant isolation and the complete rental/financial lifecycle, and drop only that generated database. They default to the local development cluster. Set `TEST_DATABASE_URL` to a dedicated test-cluster administrative connection if using another host; the role needs permission to create test databases. They never clear an existing application database.

Browser checks cover public navigation, the read-only demo, mobile overflow, and unauthenticated protection. Install Playwright Chromium with `npx playwright install chromium`, or set `PLAYWRIGHT_CHROME_PATH` to an installed Chrome executable. Live Clerk signup and authenticated browser flows need configured Clerk keys and manual verification; they have not been tested against a real Clerk account in this environment.

### Before live use

- Verify signup, verification, signout, session expiry, and account recovery with your real Clerk application.
- Create two accounts and confirm that each sees only its own records and attachments.
- Perform a complete real test rental, including deposit collection, return, refund, and PDF review.
- Confirm tax, invoice numbering, contract wording, document retention, and privacy requirements for the launch country with the appropriate local advisers.
- Configure persistent storage, backups/restores, HTTPS, monitoring, and the billing scheduler.

## Hydration troubleshooting

If the development overlay reports unexpected `bis_skin_checked`, `bis_register`, or `__processed_*` attributes, a browser extension has modified the page before React hydrates it. These attributes are not generated by RentOps. Disable the extension's access to `localhost` and `127.0.0.1`, then reload. A fresh browser profile with extensions disabled can confirm the cause; incognito only helps when extensions are not allowed there.

The browser suite checks for React hydration errors while opening the public preview and navigating the mobile menu with a different browser locale and timezone. Keep hydration warnings enabled so real application mismatches remain visible.

## Boundaries

No public customer booking portal, invitations, team roles, multiple branches per business, payment gateway, e-signature provider, GPS, full accounting, payroll, offline mode, or native apps. Spreadsheet migration/import tooling is not implemented; initial records are entered through forms. Accounting and vehicle CSV exports are provided.

The reports distinguish net billed revenue from cash collection and deposits. Direct contribution subtracts recorded completed maintenance only; it is not statutory profit. Vehicle utilization uses actual inspection intervals and maintenance windows. Historical archival/turnaround time is not reconstructed, and replacement-rental revenue is attributed to the final vehicle. Reports describe these limitations in the interface. The bundled PDF font uses the Latin subset of Noto Sans; extend font coverage before using customer names in other writing systems.

This is an initial working application, not a claim that production compliance, the 500-vehicle/30-user performance target, backup recovery targets, or live authentication acceptance testing have been certified.

