export const PEOPLE = ["Antoine", "Kiryl"] as const;
const WHO = [...PEOPLE, "Both"];
export const COLORS = ["gray", "red", "orange", "amber", "green", "teal", "blue", "violet", "pink"] as const;
export const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;
/** Allowed receipt types → file extension. Nothing here renders as HTML, so serving them back is safe. */
export const RECEIPT_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "application/pdf": "pdf",
};

export type Kind = "in" | "out" | "transfer";
export type Repeat = "monthly" | "yearly";
export type Entry = {
  date: string | null;
  kind: Kind;
  amount_cents: number;
  who: string; // payer, or sender of a transfer
  to_who: string | null; // receiver of a transfer
  what: string;
  category_id: number | null;
  repeat: Repeat | null;
};
export type Category = { name: string; emoji: string; color: string };

const isPerson = (v: unknown): v is string => typeof v === "string" && (PEOPLE as readonly string[]).includes(v);
const blank = (v: unknown) => v == null || v === "";

/** Validates an entry posted by the page. Returns the entry, or an error message. */
export function parseEntry(body: unknown): Entry | string {
  if (!body || typeof body !== "object") return "Body must be a JSON object";
  const { date, kind, amount, who, to_who, what, category_id, repeat } = body as Record<string, unknown>;
  if (kind !== "in" && kind !== "out" && kind !== "transfer") return "kind must be 'in', 'out' or 'transfer'";
  if (typeof amount !== "string" && typeof amount !== "number") return "amount is required";
  const cents = Math.round(Number(amount) * 100);
  if (!Number.isFinite(cents) || cents <= 0 || cents > 1e9) return "amount must be a positive number";
  if (typeof who !== "string" || !WHO.includes(who)) return "who must be Antoine, Kiryl or Both";
  if (kind === "transfer") {
    if (!isPerson(who) || !isPerson(to_who) || who === to_who) return "a transfer goes from one person to the other";
  } else if (!blank(to_who)) return "to_who is only for transfers";
  if (typeof what !== "string" || !what.trim() || what.length > 200) return "what is required (max 200 chars)";
  if (!blank(date) && !(typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)))
    return "date must be YYYY-MM-DD";
  if (!blank(category_id) && !(Number.isInteger(category_id) && (category_id as number) > 0))
    return "category_id must be a category id";
  if (!blank(repeat) && repeat !== "monthly" && repeat !== "yearly") return "repeat must be monthly or yearly";
  const transfer = kind === "transfer";
  return {
    date: (date as string) || null,
    kind,
    amount_cents: cents,
    who,
    to_who: transfer ? (to_who as string) : null,
    what: what.trim(),
    // A transfer moves money between you two; it is not a company cost.
    category_id: transfer || blank(category_id) ? null : (category_id as number),
    repeat: transfer || blank(repeat) ? null : (repeat as Repeat),
  };
}

export function parseCategory(body: unknown): Category | string {
  if (!body || typeof body !== "object") return "Body must be a JSON object";
  const { name, emoji, color } = body as Record<string, unknown>;
  if (typeof name !== "string" || !name.trim() || name.length > 40) return "name is required (max 40 chars)";
  if (typeof emoji !== "string" || !emoji.trim() || emoji.length > 16) return "emoji is required";
  if (typeof color !== "string" || !(COLORS as readonly string[]).includes(color)) return "unknown color";
  return { name: name.trim(), emoji: emoji.trim(), color };
}

/**
 * Totals in cents. "Both" is split 50/50, so a person's share can end in half a cent.
 * owed = what the company owes that person: paid out − income they hold + transfers sent − received.
 * settle = who pays whom so you two have carried the same amount (half the difference of owed).
 */
export function summarize(entries: Pick<Entry, "kind" | "amount_cents" | "who" | "to_who">[]) {
  const per = Object.fromEntries(PEOPLE.map((p) => [p, { in: 0, out: 0, owed: 0 }]));
  let totalIn = 0;
  let totalOut = 0;
  for (const e of entries) {
    if (e.kind === "transfer") {
      per[e.who].owed += e.amount_cents;
      per[e.to_who!].owed -= e.amount_cents;
      continue;
    }
    if (e.kind === "in") totalIn += e.amount_cents;
    else totalOut += e.amount_cents;
    const payers = e.who === "Both" ? PEOPLE : [e.who];
    for (const p of payers) {
      const share = e.amount_cents / payers.length;
      per[p][e.kind] += share;
      per[p].owed += e.kind === "out" ? share : -share;
    }
  }
  const [a, b] = PEOPLE;
  const diff = (per[a].owed - per[b].owed) / 2;
  // "Both" splits leave half cents; a half cent can't be paid, so that counts as settled.
  const cents = Math.abs(diff) <= 0.5 ? 0 : Math.round(Math.abs(diff));
  const settle = cents ? { from: diff > 0 ? b : a, to: diff > 0 ? a : b, cents } : null;
  return { in: totalIn, out: totalOut, net: totalIn - totalOut, per, settle };
}

/** YYYY-MM-DD one period later; Jan 31 + 1 month = Feb 28/29. */
export function addPeriod(date: string, repeat: Repeat): string {
  const [y, m, d] = date.split("-").map(Number);
  const year = y + (repeat === "yearly" ? 1 : 0);
  const month = m - 1 + (repeat === "monthly" ? 1 : 0);
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(d, last))).toISOString().slice(0, 10);
}

/**
 * Recurring costs: for each cost name, the latest charge decides. If it repeats, it's listed with its next
 * date (null when the charge has no date). Turning repeat off on the latest charge ends the series.
 */
export function renewals<E extends Pick<Entry, "kind" | "date" | "what" | "repeat" | "amount_cents">>(entries: E[]) {
  const latest = new Map<string, E>();
  for (const e of entries) {
    if (e.kind !== "out") continue;
    const key = e.what.trim().toLowerCase();
    const cur = latest.get(key);
    if (!cur || (e.date ?? "") > (cur.date ?? "")) latest.set(key, e);
  }
  const items = [...latest.values()]
    .filter((e) => e.repeat)
    .map((e) => ({ ...e, next: e.date ? addPeriod(e.date, e.repeat!) : null }))
    .sort((x, y) => (x.next ?? "9999").localeCompare(y.next ?? "9999"));
  const monthly = items.reduce((s, e) => s + (e.repeat === "monthly" ? e.amount_cents : e.amount_cents / 12), 0);
  return { items, monthly_cents: Math.round(monthly) };
}

const csvCell = (v: string) => {
  const s = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v; // a spreadsheet would run =… as a formula
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export const toCsv = (rows: (string | number | null)[][]) =>
  rows.map((r) => r.map((v) => csvCell(String(v ?? ""))).join(",")).join("\r\n") + "\r\n";

export const dollars = (cents: number) => (cents / 100).toFixed(2);
