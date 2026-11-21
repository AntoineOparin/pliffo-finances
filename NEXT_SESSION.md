# Next session: Pliffo Financials

Paste this to start: **"Read NEXT_SESSION.md and follow it."**

## Where things stand (2026-11-21)

Live at https://finances.pliffo.com. Code is on GitHub (`AntoineOparin/pliffo-finances`, branch `main`).
It's an expense tracker for Pliffo's two co-owners, Antoine and Kiryl. Both use it on Mac and on their phones.

The makeover is done and deployed:
- React + shadcn frontend in `app/`, built by Vite into the Worker's assets
- settle-up, editing, editable categories, receipts in R2, recurring-cost reminders, CSV export
- light and dark mode, a phone layout, and a home-screen manifest

Read `README.md` for how it's built and deployed.

## How the money works (agreed with the owner, don't change it without asking)

- All **expenses are split 50/50** between Antoine and Kiryl.
- All **money coming in** (casino promo money, Pliffo's earnings, anything else) is **company money**, not personal. The `who` on an income entry means whoever is holding that money.
- **Out of pocket** per person = paid for Pliffo − Pliffo money they hold + transfers sent − transfers received. That is what Pliffo owes them back once it has its own bank account.
- **Settle up** = half the difference between their out-of-pocket amounts. Recording it adds a `transfer` entry. A leftover half-cent counts as settled.
- The logic lives in `summarize()` in `src/money.ts` and is tested in `src/money.test.ts`.
- The casino $185 was received by Antoine (corrected in production on 2026-11-21). With the current data, Antoine pays Kiryl $55.71.

## Do not break

- Login: `/api/*` returns 401 without a session, and `ALLOWED_EMAILS` is re-checked on every request.
- CSRF: JSON writes require `Content-Type: application/json`. Receipt PUT/DELETE rely on having no CORS. Any new write route needs the same protection.
- Server-side validation stays in `money.ts`. Money is stored as integer cents. No `innerHTML` with entry text.
- **$0 cost.** The owner does not want to pay anything. R2 is enabled with a payment method on file, so check free-tier limits before adding anything and tell the owner the worst-case cost.
- Back up before any migration or production data change: `bunx wrangler d1 export pliffo-finances --remote --output backups/<name>.sql` (`backups/` is gitignored). Never edit an existing migration. Add a new numbered file.
- Deploy and push only when the owner explicitly says so.

## Leftovers

### Owner to-dos (not code)
- Add real dates to the 4 old expenses: Domain, Claude credits, Apple Developer and the mic. The upcoming-renewals panel needs them. The casino income has no date either.
- Check for missing expenses. The owner said the casino money "was all spent and more", but Antoine's recorded expenses only add up to $150.73 of the $185.
- Optional: set a Cloudflare billing alert (Notifications) as a safety net.

### Not verified yet
- Safari on Mac, and a real iPhone, including "Add to Home Screen". Only Chrome has been tested so far, both headless and real.
- A real receipt upload in production. It was only tested locally, so the R2 bucket `pliffo-receipts` is still empty.
- The 10 MB receipt limit with a file that large.

### Features skipped on purpose (offer these, don't build without asking)
1. **Spending over time:** monthly totals or a running balance. Load the `dataviz` skill first.
2. **Filters and search** by person, category and month.
3. **Original currency:** the USD amount next to the CAD one. Amounts are CAD only for now.
4. **Company reimbursements:** once Pliffo has a bank account, a "Pliffo paid X back" transfer.
5. **Auto-created renewals:** a cron that adds recurring charges. Right now they're reminders only, and the owner chose that.
6. **Receipts ZIP for the accountant.** Today the CSV links to receipts, but the links need a login.

### Small known nits
- The JS bundle is about 157 KB gzipped, so Vite warns about chunk size. That's fine at this size. Code-split only if it grows.
- Headless Chrome shows emoji in black and white. Real browsers show them in colour, so it's a test artefact.

## Commands

`bun run dev` runs it locally at http://localhost:8787 and skips login via `DEV_USER` in `.dev.vars`.
The other commands are `bun test`, `bun run typecheck` and `bun run deploy`. Deploy builds the app, applies migrations, then deploys.
To screenshot or click through the app, use Claude in Chrome. If the extension isn't connected, use puppeteer-core against the installed Chrome from a scratchpad folder.
