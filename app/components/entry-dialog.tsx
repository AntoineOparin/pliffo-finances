import { FileText, Paperclip, Trash2, X } from "lucide-react";
import { useState } from "react";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { api, type Data, type Row } from "@/api";
import { DateField } from "@/components/date-field";
import { Segmented } from "@/components/segmented";
import { defaultWho, money, other, remember, today } from "@/format";
import { dollars, MAX_RECEIPT_BYTES, PEOPLE, RECEIPT_TYPES, type Kind, type Repeat } from "../../src/money";

const KIND_LABEL = { out: "Expense", in: "Income", transfer: "Transfer" } as const;
// Some browsers give HEIC files an empty type; fall back on the extension.
const typeOf = (f: File) =>
  f.type || { heic: "image/heic", heif: "image/heif", pdf: "application/pdf" }[f.name.split(".").pop()!.toLowerCase()] || "";

/** Bottom sheet on phones, centred dialog on desktop. */
export const sheetClass =
  "max-h-[92dvh] overflow-y-auto rounded-2xl border-0 bg-card p-5 shadow-2xl sm:p-6 max-sm:top-auto max-sm:bottom-0 max-sm:max-w-full max-sm:translate-y-0 max-sm:rounded-b-none max-sm:pb-[calc(1.25rem+env(safe-area-inset-bottom))]";

export function EntryDialog({
  target,
  data,
  onClose,
  onSaved,
}: {
  target: Row | "new" | null;
  data: Data;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  return (
    <Dialog open={target !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={sheetClass}>
        {target && <EntryForm entry={target === "new" ? null : target} data={data} onSaved={onSaved} />}
      </DialogContent>
    </Dialog>
  );
}

function EntryForm({ entry, data, onSaved }: { entry: Row | null; data: Data; onSaved: (message: string) => void }) {
  const [kind, setKind] = useState<Kind>(entry?.kind ?? "out");
  const [amount, setAmount] = useState(entry ? dollars(entry.amount_cents) : "");
  const [what, setWhat] = useState(entry?.what ?? "");
  const [who, setWho] = useState(entry?.who ?? defaultWho(data.me));
  const lastCat = Number(remember.get("category"));
  const [categoryId, setCategoryId] = useState<number | null>(
    entry ? entry.category_id : data.categories.some((c) => c.id === lastCat) ? lastCat : null,
  );
  const [date, setDate] = useState<string | null>(entry ? entry.date : today());
  const [repeat, setRepeat] = useState<Repeat | "none">(entry?.repeat ?? "none");
  const [file, setFile] = useState<File | null>(null);
  const [dropReceipt, setDropReceipt] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const transfer = kind === "transfer";
  const setKindSafe = (k: Kind) => {
    setKind(k);
    if (k === "transfer" && who === "Both") setWho(defaultWho(data.me) === "Both" ? PEOPLE[0] : defaultWho(data.me));
  };

  const pickFile = (f: File | undefined) => {
    if (!f) return;
    if (!RECEIPT_TYPES[typeOf(f)]) return setError("Receipts must be a photo (JPG, PNG, HEIC) or a PDF.");
    if (f.size > MAX_RECEIPT_BYTES) return setError("That file is over 10 MB.");
    setError("");
    setFile(f);
  };

  async function save(ev: React.FormEvent) {
    ev.preventDefault();
    setSaving(true);
    setError("");
    try {
      const body = {
        kind,
        amount: amount.replace(",", "."), // accept 5,51
        who,
        to_who: transfer ? other(who) : null,
        what: what.trim() || (transfer ? "Transfer" : ""),
        category_id: kind === "out" ? categoryId : null,
        date,
        repeat: kind === "out" && repeat !== "none" ? repeat : null,
      };
      const res = await api(entry ? `/api/entries/${entry.id}` : "/api/entries", {
        method: entry ? "PUT" : "POST",
        json: body,
      });
      const id = entry?.id ?? (await res.json()).id;
      if (!transfer) remember.set("who", who);
      if (kind === "out" && categoryId) remember.set("category", String(categoryId));
      try {
        if (file) await api(`/api/entries/${id}/receipt`, { method: "PUT", body: file, headers: { "Content-Type": typeOf(file) } });
        else if (dropReceipt) await api(`/api/entries/${id}/receipt`, { method: "DELETE" });
      } catch (e) {
        toast.error(`Saved, but the receipt didn't upload: ${(e as Error).message}`);
      }
      onSaved(entry ? "Changes saved" : `${KIND_LABEL[kind]} added`);
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  }

  async function remove() {
    try {
      await api(`/api/entries/${entry!.id}`, { method: "DELETE" });
      onSaved("Entry deleted");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const hasReceipt = entry?.receipt_key && !dropReceipt;

  return (
    <form onSubmit={save} className="grid gap-5">
      <DialogHeader className="text-left">
        <DialogTitle>{entry ? `Edit ${KIND_LABEL[kind].toLowerCase()}` : `New ${KIND_LABEL[kind].toLowerCase()}`}</DialogTitle>
        <DialogDescription className="sr-only">Amounts are in Canadian dollars.</DialogDescription>
      </DialogHeader>

      <label className="flex items-baseline gap-1.5 rounded-xl bg-muted px-4 py-3 transition-shadow focus-within:ring-[3px] focus-within:ring-ring/50">
        <span className="text-2xl font-medium text-muted-foreground">$</span>
        <input
          aria-label="Amount in Canadian dollars"
          inputMode="decimal"
          autoComplete="off"
          required
          autoFocus
          pattern="\s*\d+([.,]\d{1,2})?\s*"
          title="An amount like 12.50"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="num w-full min-w-0 bg-transparent text-3xl font-semibold tracking-tight outline-none placeholder:text-muted-foreground/50"
        />
        <span className="text-sm font-medium text-muted-foreground">CAD</span>
      </label>

      <Segmented
        label="Type"
        value={kind}
        onChange={setKindSafe}
        options={(["out", "in", "transfer"] as const).map((k) => ({ value: k, label: KIND_LABEL[k] }))}
      />

      <div className="grid gap-2">
        <Label htmlFor="what">{transfer ? "Note" : "What for"}</Label>
        <Input
          id="what"
          required={!transfer}
          maxLength={200}
          placeholder={transfer ? "Transfer" : kind === "in" ? "e.g. Client payment" : "e.g. Domain renewal"}
          value={what}
          onChange={(e) => setWhat(e.target.value)}
        />
      </div>

      <div className="grid gap-2">
        <Label>{transfer ? "From" : kind === "in" ? "Received by" : "Paid by"}</Label>
        {transfer ? (
          <Segmented
            label="From"
            value={who}
            onChange={setWho}
            options={PEOPLE.map((p) => ({ value: p, label: `${p} → ${other(p)}` }))}
          />
        ) : (
          <Segmented
            label={kind === "in" ? "Received by" : "Paid by"}
            value={who}
            onChange={setWho}
            options={[...PEOPLE, { value: "Both", label: kind === "in" ? "Both" : "Split" }]}
          />
        )}
      </div>

      {kind === "out" && data.categories.length > 0 && (
        <div className="grid gap-2">
          <Label>Category</Label>
          <ToggleGroup
            type="single"
            aria-label="Category"
            value={categoryId ? String(categoryId) : ""}
            onValueChange={(v) => setCategoryId(v ? Number(v) : null)}
            className="flex w-full flex-wrap justify-start gap-1.5"
          >
            {data.categories.map((c) => (
              <ToggleGroupItem
                key={c.id}
                value={String(c.id)}
                className="h-8 flex-none rounded-full! border border-border px-3 text-[13px] font-normal hover:bg-accent data-[state=on]:border-primary data-[state=on]:bg-primary/10 data-[state=on]:text-foreground"
              >
                <span aria-hidden>{c.emoji}</span>
                {c.name}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="date">Date</Label>
          <DateField id="date" value={date} onChange={setDate} />
        </div>
        {kind === "out" && (
          <div className="grid gap-2">
            <Label>Repeats</Label>
            <Segmented
              label="Repeats"
              value={repeat}
              onChange={setRepeat}
              options={[
                { value: "none", label: "Once" },
                { value: "monthly", label: "Monthly" },
                { value: "yearly", label: "Yearly" },
              ]}
            />
          </div>
        )}
      </div>

      <div className="grid gap-2">
        <Label>Receipt</Label>
        {file || hasReceipt ? (
          <div className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
            <FileText className="size-4 shrink-0 text-muted-foreground" />
            {file ? (
              <span className="min-w-0 flex-1 truncate">{file.name}</span>
            ) : (
              <a href={`/api/entries/${entry!.id}/receipt`} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-primary hover:underline">
                View receipt
              </a>
            )}
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label="Remove receipt"
              onClick={() => (file ? setFile(null) : setDropReceipt(true))}
            >
              <X />
            </Button>
          </div>
        ) : (
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent focus-within:ring-[3px] focus-within:ring-ring/50">
            <Paperclip className="size-4" />
            Attach a photo or PDF
            <input
              type="file"
              accept="image/*,application/pdf,.heic,.heif"
              className="sr-only"
              onChange={(e) => pickFile(e.target.files?.[0])}
            />
          </label>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex items-center gap-2 pt-1">
        {entry && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="ghost" className="text-destructive hover:text-destructive">
                <Trash2 /> Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete “{entry.what}”?</AlertDialogTitle>
                <AlertDialogDescription>
                  {money(entry.amount_cents)}
                  {entry.receipt_key ? ", and its receipt." : "."} This can’t be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep it</AlertDialogCancel>
                <AlertDialogAction onClick={remove} className="bg-destructive text-white hover:bg-destructive/90">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
        <Button type="submit" className="ml-auto min-w-24" disabled={saving}>
          {saving ? "Saving…" : entry ? "Save" : "Add"}
        </Button>
      </div>
    </form>
  );
}
