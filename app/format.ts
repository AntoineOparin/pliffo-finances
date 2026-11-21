import { PEOPLE } from "../src/money";

const cad = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" });
/** $136.83, with a real minus sign. Totals can carry half cents from "Both" splits; this rounds them. */
export const money = (cents: number) => cad.format(cents / 100).replace("-", "−");

export const toDay = (d: Date) => d.toLocaleDateString("en-CA"); // local YYYY-MM-DD
export const today = () => toDay(new Date());
export const parseDay = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const DAY = 86_400_000;
export const daysFromToday = (s: string) => Math.round((parseDay(s).getTime() - parseDay(today()).getTime()) / DAY);

export function dayLabel(s: string | null, withYear = false) {
  if (!s) return "No date";
  const n = daysFromToday(s);
  if (n === 0) return "Today";
  if (n === -1) return "Yesterday";
  const d = parseDay(s);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString("en-CA", { month: "short", day: "numeric", ...((withYear || !sameYear) && { year: "numeric" }) });
}

export const monthLabel = (s: string | null) =>
  s ? parseDay(s).toLocaleDateString("en-CA", { month: "long", year: "numeric" }) : "No date";

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
export function relative(s: string) {
  const n = daysFromToday(s);
  return Math.abs(n) < 45 ? rtf.format(n, "day") : rtf.format(Math.round(n / 30), "month");
}

export const other = (who: string) => PEOPLE.find((p) => p !== who) ?? PEOPLE[0];

/** Static class names so Tailwind keeps them. Keys match COLORS in src/money.ts. */
export const TINT: Record<string, { tile: string; swatch: string }> = {
  gray: { tile: "bg-stone-500/15", swatch: "bg-stone-500" },
  red: { tile: "bg-red-500/15", swatch: "bg-red-500" },
  orange: { tile: "bg-orange-500/15", swatch: "bg-orange-500" },
  amber: { tile: "bg-amber-500/15", swatch: "bg-amber-500" },
  green: { tile: "bg-green-500/15", swatch: "bg-green-500" },
  teal: { tile: "bg-teal-500/15", swatch: "bg-teal-500" },
  blue: { tile: "bg-blue-500/15", swatch: "bg-blue-500" },
  violet: { tile: "bg-violet-500/15", swatch: "bg-violet-500" },
  pink: { tile: "bg-pink-500/15", swatch: "bg-pink-500" },
};
export const tint = (color: string | undefined) => TINT[color ?? "gray"] ?? TINT.gray;

// Per-device conveniences: who usually adds on this device, and the last category used.
export const remember = {
  get: (k: string) => {
    try {
      return localStorage.getItem(`pliffo.${k}`);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(`pliffo.${k}`, v);
    } catch {}
  },
};

/** Default payer: last one picked on this device, else a guess from the signed-in email. */
export const defaultWho = (me: string) =>
  remember.get("who") ?? PEOPLE.find((p) => me.toLowerCase().includes(p.toLowerCase())) ?? PEOPLE[0];
