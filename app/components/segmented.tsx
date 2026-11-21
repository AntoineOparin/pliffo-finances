import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

/** Mac-style segmented control: same look on every OS, unlike a native <select>. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: readonly (T | { value: T; label: React.ReactNode })[];
  label: string;
  className?: string;
}) {
  return (
    <ToggleGroup
      type="single"
      aria-label={label}
      value={value}
      onValueChange={(v) => v && onChange(v as T)} // a segmented control always has one selected
      className={cn("grid w-full auto-cols-fr grid-flow-col gap-0.5 rounded-[10px] bg-muted p-0.5", className)}
    >
      {options.map((o) => {
        const { value: v, label } = typeof o === "string" ? { value: o, label: o } : o;
        return (
          <ToggleGroupItem
            key={v}
            value={v}
            className="h-8 rounded-lg! px-3 text-[13px] font-medium text-muted-foreground transition-[background,color,box-shadow] duration-150 hover:bg-transparent hover:text-foreground data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-[0_1px_2px_rgba(0,0,0,0.12),0_0_0_0.5px_rgba(0,0,0,0.06)] dark:data-[state=on]:bg-white/18"
          >
            {label}
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}
