import { expect, test } from "bun:test";
import { addPeriod, parseCategory, parseEntry, renewals, summarize, toCsv } from "./money";

const ok = { kind: "out", amount: "5", who: "Kiryl", what: "x" };

test("parseEntry accepts a valid entry and converts to cents", () => {
  expect(parseEntry({ kind: "out", amount: "136.83", who: "Antoine", what: " Apple ", date: "", category_id: 1, repeat: "yearly" })).toEqual({
    date: null,
    kind: "out",
    amount_cents: 13683,
    who: "Antoine",
    to_who: null,
    what: "Apple",
    category_id: 1,
    repeat: "yearly",
  });
});

test("parseEntry rejects bad input", () => {
  for (const bad of [null, { ...ok, kind: "x" }, { ...ok, amount: "" }, { ...ok, amount: "-1" },
    { ...ok, amount: "abc" }, { ...ok, amount: true }, { ...ok, who: "Bob" }, { ...ok, what: "  " },
    { ...ok, date: "20/11/2026" }, { ...ok, category_id: "1" }, { ...ok, category_id: 1.5 },
    { ...ok, repeat: "weekly" }, { ...ok, to_who: "Antoine" },
    { ...ok, kind: "transfer" }, { ...ok, kind: "transfer", to_who: "Kiryl" },
    { ...ok, kind: "transfer", who: "Both", to_who: "Kiryl" }])
    expect(typeof parseEntry(bad)).toBe("string");
});

test("a transfer drops category and repeat", () => {
  expect(parseEntry({ ...ok, kind: "transfer", to_who: "Antoine", category_id: 2, repeat: "monthly" })).toMatchObject({
    who: "Kiryl", to_who: "Antoine", category_id: null, repeat: null,
  });
});

test("parseCategory", () => {
  expect(parseCategory({ name: " Ads ", emoji: "📣", color: "pink" })).toEqual({ name: "Ads", emoji: "📣", color: "pink" });
  for (const bad of [null, { name: "", emoji: "x", color: "pink" }, { name: "a", emoji: "", color: "pink" }, { name: "a", emoji: "x", color: "#f00" }])
    expect(typeof parseCategory(bad)).toBe("string");
});

const seed = [
  { kind: "in", amount_cents: 18500, who: "Both", to_who: null },
  { kind: "out", amount_cents: 551, who: "Antoine", to_who: null },
  { kind: "out", amount_cents: 839, who: "Antoine", to_who: null },
  { kind: "out", amount_cents: 13683, who: "Antoine", to_who: null },
  { kind: "out", amount_cents: 7715, who: "Kiryl", to_who: null },
] as const;

test("summarize matches the spreadsheet (-42.88), owed per person, and who settles", () => {
  expect(summarize([...seed])).toEqual({
    in: 18500,
    out: 22788,
    net: -4288,
    per: { Antoine: { in: 9250, out: 15073, owed: 5823 }, Kiryl: { in: 9250, out: 7715, owed: -1535 } },
    settle: { from: "Kiryl", to: "Antoine", cents: 3679 },
  });
});

test("settling up evens both views and leaves totals alone", () => {
  const s = summarize([...seed, { kind: "transfer", amount_cents: 3679, who: "Kiryl", to_who: "Antoine" }]);
  expect(s.settle).toBeNull();
  expect(s.per.Antoine.owed).toBe(2144);
  expect(s.per.Kiryl.owed).toBe(2144);
  expect(s.net).toBe(-4288);
});

test("a leftover half cent after settling counts as settled", () => {
  const odd = [{ kind: "out", amount_cents: 4999, who: "Antoine", to_who: null }, ...seed] as const;
  const before = summarize([...odd]).settle!;
  expect(before).toEqual({ from: "Kiryl", to: "Antoine", cents: 6179 }); // exact: 6178.5
  expect(summarize([...odd, { kind: "transfer", amount_cents: 6179, who: "Kiryl", to_who: "Antoine" }]).settle).toBeNull();
});

test("addPeriod clamps month ends", () => {
  expect(addPeriod("2026-01-31", "monthly")).toBe("2026-02-28");
  expect(addPeriod("2026-12-15", "monthly")).toBe("2027-01-15");
  expect(addPeriod("2028-02-29", "yearly")).toBe("2029-02-28");
});

test("renewals: latest charge per name decides, burn is monthly", () => {
  const e = (what: string, date: string | null, repeat: "monthly" | "yearly" | null, amount_cents = 1200) =>
    ({ kind: "out" as const, what, date, repeat, amount_cents });
  const r = renewals([
    e("Apple", "2025-03-01", "yearly"), e("apple ", "2026-03-01", "yearly"),
    e("Claude", "2026-11-02", "monthly", 839),
    e("Old SaaS", "2026-01-01", "monthly"), e("Old SaaS", "2026-02-01", null), // cancelled
    e("Domain", null, "yearly", 551),
  ]);
  expect(r.items.map((i) => [i.what, i.next])).toEqual([["Claude", "2026-12-02"], ["apple ", "2027-03-01"], ["Domain", null]]);
  expect(r.monthly_cents).toBe(Math.round(839 + 1200 / 12 + 551 / 12));
});

test("toCsv quotes and defuses formulas", () => {
  expect(toCsv([["a,b", 'say "hi"', "=SUM(A1)", null, 5]])).toBe('"a,b","say ""hi""",\'=SUM(A1),,5\r\n');
});
