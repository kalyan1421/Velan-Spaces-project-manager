import { ChevronDown } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * Native <select> styled like the shadcn Input. Used for short enumerations
 * (status, priority, room, assignee): fully keyboard/screen-reader friendly,
 * the platform picker on phones, and works with labels/RHF without adapters.
 */
export function NativeSelect({
  className,
  wrapperClassName,
  size = "default",
  ...props
}: Omit<ComponentProps<"select">, "size"> & { wrapperClassName?: string; size?: "default" | "sm" }) {
  return (
    <div className={cn("relative min-w-0", wrapperClassName)}>
      <select
        className={cn(
          "w-full min-w-0 cursor-pointer appearance-none rounded-lg border border-input bg-background pr-8 pl-2.5 text-base text-foreground transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm",
          size === "sm" ? "h-7" : "h-8",
          className,
        )}
        {...props}
      />
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-2 size-4 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  );
}
