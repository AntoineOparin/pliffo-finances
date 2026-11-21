# Next session: give Pliffo Financials a real UI/UX makeover

Paste this to start: **"Read NEXT_SESSION.md and follow it."**

## What this is

An internal expense tracker for Pliffo, a startup with two co-owners, Antoine and Kiryl. They pay company costs out of their own pockets for now. The app records:
- money coming in,
- what was paid, by whom, and for what,
- the totals: overall and per person.

Only those two people use it, on Mac (Safari/Chrome) and probably on their phones.

It's live at https://finances.pliffo.com, with Google login limited to two emails. It works, but it looks like a plain HTML form. The owner says it "needs a makeover", and native `<select>` dropdowns look especially bad on macOS. The owner has **no fixed idea of what it should do or look like**. Researching that is part of the job.

## How it's built today (read these files first)

- `src/index.ts`: the Worker. It handles Google login (`/login`, `/auth/callback`, `/logout`) and the JSON API: `GET/POST /api/entries`, `DELETE /api/entries/:id`.
- `src/auth.ts`: Google login and the session cookie. `src/money.ts`: input validation and totals. Tests are in `src/*.test.ts`.
- `public/index.html`: the whole frontend. Vanilla JS, inline CSS, no build step.
- `migrations/`: the D1 schema. Table `entries`: `date`, `kind` (in/out), `amount_cents`, `who` (Antoine/Kiryl/Both), `what`, `added_by`.
- `README.md`: deploy steps and secrets. It's on the Pliffo team Cloudflare account (pliffoteam@gmail.com).

Commands: `bun run dev` (local, login skipped via `DEV_USER` in `.dev.vars`), `bun test`, `bun run typecheck`, `bun run deploy`.
A schema change means a new numbered file in `migrations/`, applied with `bunx wrangler d1 migrations apply DB --remote`. Never edit `0001_init.sql`: it has already run in production.

## Do not break

- **Login and access:** API routes return 401 without a valid session, and `ALLOWED_EMAILS` is re-checked on every request.
- **CSRF protection:** POST requires `Content-Type: application/json`. Any new write route needs the same check.
- **Validation on the server:** keep it in `money.ts`, whatever the UI checks.
- **Money as integer cents:** never store or add floats.
- **No `innerHTML` with entry text:** entries are user input. (A framework that escapes for you is fine.)
- **The 5 existing entries in production.** Back up before any migration: `bunx wrangler d1 export pliffo-finances --remote --output backup.sql`.
- **Free tier:** everything stays on Cloudflare's free plan (Workers, D1, and R2 if receipts are added).

## How to run this session

1. **Research first.** Use web search, e.g. the `research` skill or a `web-search-agent`. Look at how good expense and shared-cost apps handle:
   - adding an expense fast,
   - "who owes whom",
   - categories,
   - receipts,
   - showing the totals.

   Good references: Splitwise and Tricount (settling up between two people), Ramp and Brex (startup expense UX, receipts), Lunch Money, Copilot Money and Actual Budget (clean personal finance UI, categories, charts), and Wave (small-business bookkeeping, exports for the accountant).

   Bring back a short summary: which patterns are worth copying, with screenshots or links.
2. **Agree on scope with the owner** before building. Use the `grill-me` (or `interview`) skill with the feature list below. The owner wants suggestions; don't build everything.
3. **Pick a design direction.** Use `taste-skill` (design-taste-frontend) and `redesign-skill` (redesign-existing-projects) to review the current page and choose a direction. `minimalist-skill` suits a calm, finance-tool look. `apple-design` helps it feel at home on a Mac.
4. **Decide the stack.** If scope stays small, keep the single HTML file. If it grows (edit dialogs, filters, charts, receipts), suggest moving the frontend to a Vite + React app served as Worker assets, keeping the same `/api`. The owner normally likes React Router + shadcn on Cloudflare. Ask before switching.
5. **Build, then polish.** Use `better-ui` for spacing, radius, icons and states. Use `animate` only where motion helps. Use `dataviz` before drawing any chart.
6. **Check it in a real browser.** Use the `run` and `claude-in-chrome` skills: light and dark mode, phone width, keyboard-only, Safari quirks. Then run `bun test` and `bun run typecheck`, and deploy only when the owner says so.

## UI problems already known

- Type (In/Out) and Who (Antoine/Kiryl/Both) use native `<select>`s. With only 2–3 options, **segmented buttons** are better and look the same on every OS.
- The date picker and amount field are browser defaults. There's no currency shown. The amounts look like **CAD** (Apple Developer: 119 + Quebec tax = 136.83); confirm with the owner.
- The summary cards are crowded, and "Antoine: in 92.50 · paid" is hard to read.
- No edit (only delete, which pops a browser `confirm()`), no empty or loading states, no success feedback.
- The 5 seed entries have no dates and show "—".

## Feature ideas to offer the owner (rough priority, short notes)

1. **Settle-up view:** "Kiryl owes Antoine X" (or the company owes each of them), plus a "mark reimbursed" action for when the company gets its own bank account. This is the main reason the app exists.
2. **Edit an entry**, including adding dates to the old ones.
3. **Categories:** software and subscriptions, hardware, domains, legal and fees, marketing. Show a breakdown, e.g. a bar list.
4. **Fast mobile add:** a big amount field first, then smart defaults (today, the signed-in person, the last category used). Can be added to the phone's home screen like an app (a PWA, via a small manifest).
5. **Receipts:** attach a photo or PDF, stored in R2 (free up to 10 GB). Useful for taxes and pre-incorporation expenses.
6. **Recurring costs:** Apple Developer yearly, the domain yearly, Claude credits monthly. Show upcoming renewals and monthly burn.
7. **Spending over time:** monthly totals or a running balance.
8. **Filters and search** by person, category and month. **CSV export** for an accountant.
9. **Original currency** for charges made in USD, alongside the amount in CAD.

Suggested first slice if the owner can't decide: segmented controls plus a visual refresh, edit, settle-up, and categories. Then receipts and recurring costs.
