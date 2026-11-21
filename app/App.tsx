import { ArrowDownLeft, ArrowLeftRight, CheckCircle2, Download, Info, LogOut, Paperclip, Plus, Receipt, Tags } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Toaster } from "@/components/ui/sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { api, type Cat, type Data, type Row } from "@/api";
import { CategoriesDialog } from "@/components/categories-dialog";
import { EntryDialog } from "@/components/entry-dialog";
import { dayLabel, daysFromToday, money, monthLabel, relative, tint, today } from "@/format";
import { cn } from "@/lib/utils";
import { PEOPLE } from "../src/money";

const card = "rounded-2xl bg-card shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-border";

export function App() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Row | "new" | null>(null);
  const [catsOpen, setCatsOpen] = useState(false);
  const [settleOpen, setSettleOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await (await api("/api/entries")).json());
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => void load(), [load]);

  // N adds an entry, like most Mac apps' "new" shortcut, without stealing keys from fields or dialogs.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "n" || e.metaKey || e.ctrlKey || e.altKey) return;
      if ((e.target as HTMLElement).closest("input, textarea, [contenteditable], [role=dialog], [role=alertdialog]")) return;
      e.preventDefault();
      setEditing("new");
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);

  const saved = (message: string) => {
    setEditing(null);
    toast.success(message);
    load();
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className="min-h-dvh pb-24 sm:pb-10">
        <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur-xl backdrop-saturate-150">
          <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-4">
            <img src="/icon.svg" alt="" className="size-7 rounded-[7px]" />
            <h1 className="text-[17px] font-semibold tracking-tight">
              Pliffo <span className="font-normal text-muted-foreground">Financials</span>
            </h1>
            <div className="ml-auto flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" asChild>
                    <a href="/api/export.csv" download aria-label="Export CSV">
                      <Download />
                    </a>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Export CSV for the accountant</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Categories" onClick={() => setCatsOpen(true)} disabled={!data}>
                    <Tags />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Categories</TooltipContent>
              </Tooltip>
              {data && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label="Account">
                      <span className="flex size-7 items-center justify-center rounded-full bg-muted text-xs font-semibold uppercase">
                        {data.me[0]}
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel className="font-normal text-muted-foreground">{data.me}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <a href="/logout">
                        <LogOut /> Sign out
                      </a>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              <Button className="ml-1 hidden sm:inline-flex" onClick={() => setEditing("new")} disabled={!data}>
                <Plus /> Add
                <kbd className="ml-0.5 rounded bg-white/20 px-1.5 text-[11px] font-medium">N</kbd>
              </Button>
            </div>
          </div>
        </header>

        {!data ? (
          error ? (
            <div className="mx-auto mt-24 max-w-sm px-4 text-center">
              <p className="font-medium">Couldn’t load your entries</p>
              <p className="mt-1 text-sm text-muted-foreground">{error}</p>
              <Button className="mt-4" variant="outline" onClick={load}>
                Try again
              </Button>
            </div>
          ) : (
            <Skeleton />
          )
        ) : (
          <main className="mx-auto grid max-w-5xl gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="grid content-start gap-6">
              <Balance data={data} onSettle={() => setSettleOpen(true)} />
              <Activity data={data} onOpen={setEditing} onAdd={() => setEditing("new")} />
            </div>
            <aside className="grid content-start gap-6">
              <Breakdown data={data} />
              <Renewals data={data} onOpen={setEditing} />
            </aside>
          </main>
        )}

        <Button
          size="icon"
          aria-label="Add entry"
          onClick={() => setEditing("new")}
          disabled={!data}
          className="fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-20 size-14 rounded-full shadow-lg active:scale-95 sm:hidden [&_svg:not([class*='size-'])]:size-6"
        >
          <Plus />
        </Button>

        {data && (
          <>
            <EntryDialog target={editing} data={data} onClose={() => setEditing(null)} onSaved={saved} />
            <CategoriesDialog open={catsOpen} onOpenChange={setCatsOpen} data={data} onChanged={load} />
            <SettleDialog open={settleOpen} onOpenChange={setSettleOpen} data={data} onDone={saved} />
          </>
        )}
        <Toaster position="bottom-center" />
      </div>
    </TooltipProvider>
  );
}

function Balance({ data, onSettle }: { data: Data; onSettle: () => void }) {
  const { settle, per } = data.summary;
  return (
    <section className={cn(card, "p-5 sm:p-6")} aria-label="Balance">
      {settle ? (
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">
              {settle.from} owes {settle.to}
            </p>
            <p className="num mt-1 text-4xl font-semibold tracking-tight">{money(settle.cents)}</p>
          </div>
          <Button onClick={onSettle}>Settle up</Button>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <CheckCircle2 className="size-8 text-positive" />
          <div>
            <p className="text-lg font-semibold tracking-tight">All settled up</p>
            <p className="text-sm text-muted-foreground">You’ve both carried the same share of the costs.</p>
          </div>
        </div>
      )}

      <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 border-t pt-5 sm:grid-cols-4">
        {PEOPLE.map((p) => {
          const owed = per[p].owed;
          const label = Math.round(owed) > 0 ? `Pliffo owes ${p}` : Math.round(owed) < 0 ? `${p} holds` : `${p}`;
          return <Stat key={p} label={label} value={Math.round(owed) ? money(Math.abs(owed)) : "Even"} />;
        })}
        <Stat label="Income" value={money(data.summary.in)} />
        <Stat label="Spent" value={money(data.summary.out)} />
      </dl>
      <p className="mt-4 flex items-start gap-1.5 text-xs text-muted-foreground">
        <Info className="mt-px size-3.5 shrink-0" />
        “Pliffo owes” is what each of you has paid for the company, minus company money you hold. It’s paid back once Pliffo has its own account.
      </p>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-xs text-muted-foreground">{label}</dt>
      <dd className="num mt-0.5 text-[17px] font-medium tracking-tight">{value}</dd>
    </div>
  );
}

function EntryIcon({ entry, cat }: { entry: Row; cat?: Cat }) {
  const base = "flex size-9 shrink-0 items-center justify-center rounded-[10px] text-lg";
  if (entry.kind === "in")
    return (
      <span className={cn(base, "bg-green-500/15 text-positive")}>
        <ArrowDownLeft className="size-4.5" />
      </span>
    );
  if (entry.kind === "transfer")
    return (
      <span className={cn(base, "bg-blue-500/15 text-primary")}>
        <ArrowLeftRight className="size-4.5" />
      </span>
    );
  return cat ? (
    <span className={cn(base, tint(cat.color).tile)} aria-hidden>
      {cat.emoji}
    </span>
  ) : (
    <span className={cn(base, "bg-muted text-muted-foreground")}>
      <Receipt className="size-4.5" />
    </span>
  );
}

function Activity({ data, onOpen, onAdd }: { data: Data; onOpen: (e: Row) => void; onAdd: () => void }) {
  const cats = new Map(data.categories.map((c) => [c.id, c]));
  const groups = new Map<string, Row[]>();
  for (const e of data.entries) {
    const key = e.date?.slice(0, 7) ?? "none";
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }

  if (!data.entries.length)
    return (
      <section className={cn(card, "px-6 py-12 text-center")}>
        <p className="font-medium">No entries yet</p>
        <p className="mt-1 text-sm text-muted-foreground">Add the first thing one of you paid for.</p>
        <Button className="mt-4" onClick={onAdd}>
          <Plus /> Add entry
        </Button>
      </section>
    );

  return (
    <section aria-label="Activity" className="grid gap-5">
      {[...groups].map(([key, rows]) => (
        <div key={key}>
          <h2 className="mb-1.5 px-1 text-[13px] font-medium text-muted-foreground">
            {key === "none" ? "No date" : monthLabel(rows[0].date)}
          </h2>
          <ul className={cn(card, "divide-y overflow-hidden")}>
            {rows.map((e) => {
              const cat = e.category_id ? cats.get(e.category_id) : undefined;
              const sub =
                e.kind === "transfer"
                  ? `${e.who} → ${e.to_who}`
                  : [
                      e.kind === "in" ? `Received · ${e.who}` : e.who === "Both" ? "Split" : e.who,
                      cat?.name,
                      e.repeat && (e.repeat === "monthly" ? "Monthly" : "Yearly"),
                    ]
                      .filter(Boolean)
                      .join(" · ");
              return (
                <li key={e.id}>
                  <button
                    onClick={() => onOpen(e)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors outline-none hover:bg-accent/60 focus-visible:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset active:bg-accent"
                  >
                    <EntryIcon entry={e} cat={cat} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-medium">{e.what}</p>
                      <p className="flex items-center gap-1 truncate text-[13px] text-muted-foreground">
                        {sub}
                        {e.receipt_key && <Paperclip className="size-3 shrink-0" aria-label="Has receipt" />}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p
                        className={cn(
                          "num text-[15px] font-medium",
                          e.kind === "in" && "text-positive",
                          e.kind === "transfer" && "text-muted-foreground",
                        )}
                      >
                        {e.kind === "out" ? "−" : e.kind === "in" ? "+" : ""}
                        {money(e.amount_cents)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {e.date ? dayLabel(e.date) : "Add date"}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </section>
  );
}

function Breakdown({ data }: { data: Data }) {
  const totals = new Map<number | null, number>();
  for (const e of data.entries) if (e.kind === "out") totals.set(e.category_id, (totals.get(e.category_id) ?? 0) + e.amount_cents);
  const cats = new Map(data.categories.map((c) => [c.id, c]));
  const rows = [...totals]
    .map(([id, cents]) => ({ id, cents, cat: id ? cats.get(id) : undefined }))
    .sort((a, b) => b.cents - a.cents);
  const max = rows[0]?.cents ?? 0;
  const spent = data.summary.out;

  return (
    <section className={cn(card, "p-5")} aria-labelledby="breakdown-title">
      <h2 id="breakdown-title" className="text-[15px] font-semibold">
        Spending by category
      </h2>
      {rows.length ? (
        <ul className="mt-4 grid gap-3.5">
          {rows.map((r) => (
            <li key={r.id ?? "none"} title={`${Math.round((r.cents / spent) * 100)}% of spending`}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate">
                  <span aria-hidden className="mr-1.5">
                    {r.cat?.emoji ?? "·"}
                  </span>
                  {r.cat?.name ?? "Uncategorised"}
                </span>
                <span className="num shrink-0 text-muted-foreground">{money(r.cents)}</span>
              </div>
              <div className="mt-1.5 h-1.5 rounded-full bg-muted">
                <div className="h-full rounded-full bg-bar" style={{ width: `${Math.max(2, (r.cents / max) * 100)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">No spending yet.</p>
      )}
    </section>
  );
}

function Renewals({ data, onOpen }: { data: Data; onOpen: (e: Row) => void }) {
  const { items, monthly_cents } = data.renewals;
  const cats = new Map(data.categories.map((c) => [c.id, c]));
  return (
    <section className={cn(card, "p-5")} aria-labelledby="renewals-title">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="renewals-title" className="text-[15px] font-semibold">
          Upcoming renewals
        </h2>
        {items.length > 0 && (
          <span className="num text-sm text-muted-foreground" title="Monthly costs plus yearly costs divided by 12">
            ≈ {money(monthly_cents)}/mo
          </span>
        )}
      </div>
      {items.length ? (
        <ul className="-mx-2 mt-3 grid">
          {items.map((r) => {
            const due = r.next && daysFromToday(r.next) <= 0;
            return (
              <li key={r.id}>
                <button
                  onClick={() => onOpen(r)}
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left outline-none hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span aria-hidden className="text-base">
                    {(r.category_id && cats.get(r.category_id)?.emoji) || "🔁"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{r.what}</span>
                    <span className="block text-xs text-muted-foreground">
                      {r.repeat === "monthly" ? "Monthly" : "Yearly"} · {money(r.amount_cents)}
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-xs">
                    {r.next ? (
                      <>
                        <span className={cn("block font-medium", due && "text-amber-600 dark:text-amber-400")}>
                          {due ? "Due" : dayLabel(r.next)}
                        </span>
                        <span className="block text-muted-foreground">{r.next === today() ? "today" : relative(r.next)}</span>
                      </>
                    ) : (
                      <span className="text-amber-600 dark:text-amber-400">Add a date</span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          Mark an expense as monthly or yearly to see when it renews.
        </p>
      )}
    </section>
  );
}

function SettleDialog({
  open,
  onOpenChange,
  data,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  data: Data;
  onDone: (message: string) => void;
}) {
  const s = data.summary.settle;
  if (!s) return null;
  const record = async () => {
    try {
      await api("/api/entries", {
        method: "POST",
        json: { kind: "transfer", amount: (s.cents / 100).toFixed(2), who: s.from, to_who: s.to, what: "Settle up", date: today() },
      });
      onDone("Settled up");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Record that {s.from} paid {s.to} {money(s.cents)}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Do this once the money has actually moved. It adds a transfer dated today, which you can edit or delete later.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Not yet</AlertDialogCancel>
          <AlertDialogAction onClick={record}>Record payment</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function Skeleton() {
  const block = "animate-pulse rounded-2xl bg-muted";
  return (
    <div className="mx-auto grid max-w-5xl gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_320px]" aria-busy="true" aria-label="Loading">
      <div className="grid content-start gap-6">
        <div className={cn(block, "h-52")} />
        <div className={cn(block, "h-72")} />
      </div>
      <div className="grid content-start gap-6">
        <div className={cn(block, "h-48")} />
        <div className={cn(block, "h-40")} />
      </div>
    </div>
  );
}
