# Pliffo Financials

Who put money in, who paid for what, who owes whom. One Worker + D1 (+ R2 for receipts), with Google login
limited to an email list. The page is a React + shadcn app in `app/`, built by Vite into the Worker's assets;
the Worker (`src/index.ts`) serves `/login`, `/auth/*` and the JSON API under `/api`.

- `bun run dev`: Vite + the Worker locally at http://localhost:8787. With `DEV_USER=you@local` in `.dev.vars`, it skips login.
- `bun test` / `bun run typecheck`
- `bun run deploy`: builds, applies new migrations to the remote D1, then deploys.
  Back up first when a migration is pending: `bunx wrangler d1 export pliffo-finances --remote --output backup.sql`.

## First deploy

1. **Google Cloud console** (console.cloud.google.com), new project "Pliffo Finances":
   - Google Auth Platform → Branding/Audience: External, and add both Gmail addresses as **test users**.
     It can stay in "Testing": it only asks for `openid email`, and only those test users can sign in anyway.
   - Clients → Create → Web application. Authorized redirect URIs:
     `https://finances.pliffo.com/auth/callback` (and `http://localhost:8787/auth/callback` to test locally).
   - Put the **Client ID** in `vars.GOOGLE_CLIENT_ID` in `wrangler.jsonc`. Keep the client secret for step 3.
2. `bunx wrangler login`, `bunx wrangler r2 bucket create pliffo-receipts`, then `bun run deploy`. This creates the D1 database, serves the app at
   `finances.pliffo.com`, and seeds the first entries.
3. Secrets (each command prompts for the value):
   ```sh
   bunx wrangler secret put GOOGLE_CLIENT_SECRET
   bunx wrangler secret put ALLOWED_EMAILS   # antoine@gmail.com,kiryl@gmail.com
   openssl rand -base64 32 | bunx wrangler secret put SESSION_SECRET
   ```
   Until these are set, `/login` answers 500 and nobody gets in.

To remove someone, update `ALLOWED_EMAILS`. They're locked out on their next request.
To sign everyone out, change `SESSION_SECRET`.
