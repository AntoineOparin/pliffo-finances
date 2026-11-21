import { CalendarIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { dayLabel, parseDay, toDay, today } from "@/format";

export function DateField({ id, value, onChange }: { id?: string; value: string | null; onChange: (v: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const pick = (v: string | null) => {
    onChange(v);
    setOpen(false);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button id={id} variant="outline" className="w-full justify-start font-normal">
          <CalendarIcon className="text-muted-foreground" />
          <span className={value ? "" : "text-muted-foreground"}>{dayLabel(value, true)}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value ? parseDay(value) : undefined}
          defaultMonth={value ? parseDay(value) : undefined}
          onSelect={(d) => d && pick(toDay(d))}
          autoFocus
        />
        <div className="flex justify-between border-t p-2">
          <Button size="sm" variant="ghost" onClick={() => pick(null)}>
            No date
          </Button>
          <Button size="sm" variant="ghost" onClick={() => pick(today())}>
            Today
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
