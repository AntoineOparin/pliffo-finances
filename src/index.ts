import { googleEmail, isAllowed, readSession, SESSION_SECONDS, signSession } from "./auth";
import {
  dollars,
  MAX_RECEIPT_BYTES,
  parseCategory,
  parseEntry,
  RECEIPT_TYPES,
  renewals,
  summarize,
  toCsv,
  type Entry,
} from "./money";

const ENTRY_COLUMNS = "date, kind, amount_cents, who, to_who, what, category_id, repeat";
const entryValues = (e: Entry) =>
  [e.date, e.kind, e.amount_cents, e.who, e.to_who, e.what, e.category_id, e.repeat] as const;
/** Runs a write; returns null when it points at a category that doesn't exist. */
const write = (stmt: D1PreparedStatement) =>
  stmt.run().catch((err: unknown) => {
    if (String(err).includes("FOREIGN KEY")) return null;
    throw err;
  });

// Set with `wrangler secret put` (or .dev.vars locally), never in wrangler.jsonc.
type Secrets = {
  GOOGLE_CLIENT_SECRET: string;
  SESSION_SECRET: string;
  ALLOWED_EMAILS: string; // comma-separated
  DEV_USER?: string; // .dev.vars only: skips login locally
};
type AppEnv = Env & Secrets;

const cookie = (req: Request, name: string) =>
  req.headers.get("Cookie")?.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`))?.[1];
const setCookie = (name: string, value: string, maxAge: number, path = "/") =>
  `${name}=${value}; Path=${path}; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
const redirect = (location: string, ...cookies: string[]) => {
  const headers = new Headers({ Location: location });
  for (const c of cookies) headers.append("Set-Cookie", c);
  return new Response(null, { status: 302, headers });
};

async function currentUser(req: Request, env: AppEnv): Promise<string | null> {
  if (env.DEV_USER) return env.DEV_USER;
  const email = await readSession(cookie(req, "session"), env.SESSION_SECRET);
  // Re-checked on every request so removing someone from the list locks them out at once.
  return email && isAllowed(email, env.ALLOWED_EMAILS ?? "") ? email : null;
}

export default {
  async fetch(req, env): Promise<Response> {
    const url = new URL(req.url);
    const { pathname } = url;
    const redirectUri = `${url.origin}/auth/callback`;

    if (pathname === "/login") {
      if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.SESSION_SECRET)
        return new Response("Login is not configured", { status: 500 });
      const state = crypto.randomUUID();
      const google = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      google.search = new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "openid email",
        state,
        prompt: "select_account",
      }).toString();
      return redirect(google.href, setCookie("oauth_state", state, 600, "/auth"));
    }

    if (pathname === "/auth/callback") {
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      // state must match the cookie set by /login, so nobody can log you in to their session.
      if (!code || !state || state !== cookie(req, "oauth_state"))
        return new Response("Login failed. Go to /login to try again.", { status: 400 });
      const email = await googleEmail(code, redirectUri, env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET);
      if (!email || !isAllowed(email, env.ALLOWED_EMAILS ?? ""))
        return new Response(`${email ?? "This account"} is not allowed.`, { status: 403 });
      return redirect(
        "/",
        setCookie("session", await signSession(email, env.SESSION_SECRET), SESSION_SECONDS),
        setCookie("oauth_state", "", 0, "/auth"),
      );
    }

    if (pathname === "/logout") return redirect("/", setCookie("session", "", 0));

    const me = await currentUser(req, env);
    if (!me) return new Response("Not signed in", { status: 401 });

    const { method } = req;
    // A cross-site HTML form cannot send this content type, so this blocks CSRF on JSON writes.
    const notJson = () =>
      req.headers.get("Content-Type")?.startsWith("application/json")
        ? null
        : Response.json({ error: "Expected JSON" }, { status: 415 });
    const bad = (error: string, status = 400) => Response.json({ error }, { status });

    if (pathname === "/api/entries" && method === "GET") {
      const [entries, categories] = await env.DB.batch([
        env.DB.prepare(`SELECT id, ${ENTRY_COLUMNS}, receipt_key, added_by FROM entries ORDER BY date IS NULL, date DESC, id DESC`),
        env.DB.prepare("SELECT id, name, emoji, color FROM categories ORDER BY sort, id"),
      ]);
      const rows = entries.results as (Entry & { id: number })[];
      return Response.json({
        me,
        entries: rows,
        categories: categories.results,
        summary: summarize(rows),
        renewals: renewals(rows),
      });
    }

    if (pathname === "/api/entries" && method === "POST") {
      const entry = notJson() ?? parseEntry(await req.json().catch(() => null));
      if (entry instanceof Response) return entry;
      if (typeof entry === "string") return bad(entry);
      const ok = await write(
        env.DB.prepare(`INSERT INTO entries (${ENTRY_COLUMNS}, added_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
          ...entryValues(entry),
          me,
        ),
      );
      return ok ? Response.json({ id: ok.meta.last_row_id }, { status: 201 }) : bad("Unknown category");
    }

    const entryMatch = pathname.match(/^\/api\/entries\/(\d+)$/);
    if (entryMatch && method === "PUT") {
      const entry = notJson() ?? parseEntry(await req.json().catch(() => null));
      if (entry instanceof Response) return entry;
      if (typeof entry === "string") return bad(entry);
      const ok = await write(
        env.DB.prepare(
          "UPDATE entries SET date = ?, kind = ?, amount_cents = ?, who = ?, to_who = ?, what = ?, category_id = ?, repeat = ? WHERE id = ?",
        ).bind(...entryValues(entry), Number(entryMatch[1])),
      );
      if (!ok) return bad("Unknown category");
      return ok.meta.changes ? new Response(null, { status: 204 }) : bad("Not found", 404);
    }

    if (entryMatch && method === "DELETE") {
      const row = await env.DB.prepare("DELETE FROM entries WHERE id = ? RETURNING receipt_key")
        .bind(Number(entryMatch[1]))
        .first<{ receipt_key: string | null }>();
      if (row?.receipt_key) await env.RECEIPTS.delete(row.receipt_key);
      return new Response(null, { status: 204 });
    }

    // Receipts. PUT/DELETE can't come from a cross-site form, and a cross-site fetch would need a CORS
    // preflight this Worker never approves, so no JSON check here (the body is the file itself).
    const receiptMatch = pathname.match(/^\/api\/entries\/(\d+)\/receipt$/);
    if (receiptMatch) {
      const id = Number(receiptMatch[1]);
      const row = await env.DB.prepare("SELECT receipt_key FROM entries WHERE id = ?")
        .bind(id)
        .first<{ receipt_key: string | null }>();
      if (!row) return bad("Not found", 404);

      if (method === "GET") {
        const obj = row.receipt_key ? await env.RECEIPTS.get(row.receipt_key) : null;
        if (!obj) return bad("No receipt", 404);
        return new Response(obj.body, {
          headers: {
            "Content-Type": obj.httpMetadata?.contentType ?? "application/octet-stream",
            "Content-Disposition": `inline; filename="${row.receipt_key}"`,
            "Content-Security-Policy": "sandbox",
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "private, max-age=3600",
          },
        });
      }

      if (method === "PUT") {
        const type = req.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase() ?? "";
        const ext = RECEIPT_TYPES[type];
        if (!ext) return bad("Receipts must be a photo (JPG, PNG, HEIC) or a PDF", 415);
        if (Number(req.headers.get("Content-Length")) > MAX_RECEIPT_BYTES) return bad("Max 10 MB", 413);
        const body = await req.arrayBuffer();
        if (!body.byteLength || body.byteLength > MAX_RECEIPT_BYTES) return bad("Max 10 MB", 413);
        const key = `entry-${id}-${crypto.randomUUID()}.${ext}`;
        await env.RECEIPTS.put(key, body, { httpMetadata: { contentType: type } });
        await env.DB.prepare("UPDATE entries SET receipt_key = ? WHERE id = ?").bind(key, id).run();
        if (row.receipt_key) await env.RECEIPTS.delete(row.receipt_key);
        return Response.json({ receipt_key: key });
      }

      if (method === "DELETE") {
        await env.DB.prepare("UPDATE entries SET receipt_key = NULL WHERE id = ?").bind(id).run();
        if (row.receipt_key) await env.RECEIPTS.delete(row.receipt_key);
        return new Response(null, { status: 204 });
      }
    }

    if (pathname === "/api/categories" && method === "POST") {
      const cat = notJson() ?? parseCategory(await req.json().catch(() => null));
      if (cat instanceof Response) return cat;
      if (typeof cat === "string") return bad(cat);
      const res = await env.DB.prepare(
        "INSERT INTO categories (name, emoji, color, sort) VALUES (?, ?, ?, (SELECT COALESCE(MAX(sort), 0) + 1 FROM categories))",
      )
        .bind(cat.name, cat.emoji, cat.color)
        .run();
      return Response.json({ id: res.meta.last_row_id }, { status: 201 });
    }

    const catMatch = pathname.match(/^\/api\/categories\/(\d+)$/);
    if (catMatch && method === "PUT") {
      const cat = notJson() ?? parseCategory(await req.json().catch(() => null));
      if (cat instanceof Response) return cat;
      if (typeof cat === "string") return bad(cat);
      const res = await env.DB.prepare("UPDATE categories SET name = ?, emoji = ?, color = ? WHERE id = ?")
        .bind(cat.name, cat.emoji, cat.color, Number(catMatch[1]))
        .run();
      return res.meta.changes ? new Response(null, { status: 204 }) : bad("Not found", 404);
    }

    if (catMatch && method === "DELETE") {
      const id = Number(catMatch[1]);
      // Entries keep existing, uncategorised (explicit, rather than relying on the FK's ON DELETE).
      await env.DB.batch([
        env.DB.prepare("UPDATE entries SET category_id = NULL WHERE category_id = ?").bind(id),
        env.DB.prepare("DELETE FROM categories WHERE id = ?").bind(id),
      ]);
      return new Response(null, { status: 204 });
    }

    if (pathname === "/api/export.csv" && method === "GET") {
      const { results } = await env.DB.prepare(
        `SELECT e.id, e.date, e.kind, e.amount_cents, e.who, e.to_who, e.what, c.name AS category, e.repeat,
                e.receipt_key, e.added_by
         FROM entries e LEFT JOIN categories c ON c.id = e.category_id ORDER BY e.date IS NULL, e.date, e.id`,
      ).all<Entry & { id: number; category: string | null; receipt_key: string | null; added_by: string | null }>();
      const csv = toCsv([
        ["Date", "Type", "Amount", "Currency", "Paid by", "To", "What", "Category", "Repeats", "Receipt", "Added by"],
        ...results.map((e) => [
          e.date,
          e.kind,
          dollars(e.amount_cents),
          "CAD",
          e.who,
          e.to_who,
          e.what,
          e.category,
          e.repeat,
          e.receipt_key ? `${url.origin}/api/entries/${e.id}/receipt` : "",
          e.added_by,
        ]),
      ]);
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="pliffo-finances-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<AppEnv>;
