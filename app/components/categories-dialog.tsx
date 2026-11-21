import { Plus, Trash2 } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { api, type Cat, type Data } from "@/api";
import { sheetClass } from "@/components/entry-dialog";
import { tint } from "@/format";
import { cn } from "@/lib/utils";
import { COLORS } from "../../src/money";

export function CategoriesDialog({
  open,
  onOpenChange,
  data,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  data: Data;
  onChanged: () => void;
}) {
  const counts = new Map<number, number>();
  for (const e of data.entries) if (e.category_id) counts.set(e.category_id, (counts.get(e.category_id) ?? 0) + 1);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={sheetClass}>
        <DialogHeader className="text-left">
          <DialogTitle>Categories</DialogTitle>
          <DialogDescription>Changes save as you go.</DialogDescription>
        </DialogHeader>
        <ul className="grid gap-2">
          {data.categories.map((c) => (
            <CategoryRow key={`${c.id}-${c.name}-${c.emoji}-${c.color}`} cat={c} count={counts.get(c.id) ?? 0} onChanged={onChanged} />
          ))}
        </ul>
        <NewCategory onChanged={onChanged} />
      </DialogContent>
    </Dialog>
  );
}

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="icon" aria-label={`Color: ${value}`}>
          <span className={cn("size-4 rounded-full", tint(value).swatch)} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup value={value} onValueChange={onChange}>
          {COLORS.map((c) => (
            <DropdownMenuRadioItem key={c} value={c} className="capitalize">
              <span className={cn("size-3 rounded-full", tint(c).swatch)} /> {c}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function CategoryRow({ cat, count, onChanged }: { cat: Cat; count: number; onChanged: () => void }) {
  const [emoji, setEmoji] = useState(cat.emoji);
  const [name, setName] = useState(cat.name);

  async function save(next: Partial<Cat>) {
    const body = { name, emoji, color: cat.color, ...next };
    if (!body.name.trim() || !body.emoji.trim()) {
      setEmoji(cat.emoji); // an empty field puts the old value back
      setName(cat.name);
      return;
    }
    if (body.name === cat.name && body.emoji === cat.emoji && body.color === cat.color) return;
    try {
      await api(`/api/categories/${cat.id}`, { method: "PUT", json: body });
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function remove() {
    try {
      await api(`/api/categories/${cat.id}`, { method: "DELETE" });
      toast.success(`Deleted ${cat.name}`);
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <li className="flex items-center gap-1.5">
      <Input
        aria-label={`Emoji for ${cat.name}`}
        value={emoji}
        maxLength={16}
        onChange={(e) => setEmoji(e.target.value)}
        onBlur={() => save({ emoji })}
        className={cn("w-11 shrink-0 border-0 px-0 text-center text-lg", tint(cat.color).tile)}
      />
      <Input
        aria-label={`Name of ${cat.name}`}
        value={name}
        maxLength={40}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => save({ name })}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        className="min-w-0 flex-1"
      />
      <span className="num w-8 shrink-0 text-right text-xs text-muted-foreground" title={`${count} entries`}>
        {count || ""}
      </span>
      <ColorPicker value={cat.color} onChange={(color) => save({ color })} />
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button type="button" variant="ghost" size="icon" aria-label={`Delete ${cat.name}`} className="text-muted-foreground">
            <Trash2 />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{cat.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              {count ? `Its ${count} ${count === 1 ? "entry stays" : "entries stay"}, without a category.` : "No entries use it."}
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
    </li>
  );
}

function NewCategory({ onChanged }: { onChanged: () => void }) {
  const [emoji, setEmoji] = useState("🏷️");
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>("blue");

  async function add(ev: React.FormEvent) {
    ev.preventDefault();
    try {
      await api("/api/categories", { method: "POST", json: { name, emoji, color } });
      setName("");
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <form onSubmit={add} className="flex items-center gap-1.5 border-t pt-4">
      <Input
        aria-label="Emoji for new category"
        value={emoji}
        maxLength={16}
        required
        onChange={(e) => setEmoji(e.target.value)}
        className={cn("w-11 shrink-0 border-0 px-0 text-center text-lg", tint(color).tile)}
      />
      <Input
        aria-label="New category name"
        placeholder="New category"
        value={name}
        maxLength={40}
        required
        onChange={(e) => setName(e.target.value)}
        className="min-w-0 flex-1"
      />
      <ColorPicker value={color} onChange={setColor} />
      <Button type="submit" size="sm" variant="secondary">
        <Plus /> Add
      </Button>
    </form>
  );
}
