import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * The logo is black line-art on white, so on dark surfaces it sits in a white tile.
 * `tone` controls the wordmark colour.
 */
export function BrandMark({
  tone = "dark",
  showName = true,
  size = 36,
  className,
}: {
  tone?: "dark" | "light";
  showName?: boolean;
  size?: number;
  className?: string;
}) {
  return (
    <span className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <span
        className="grid shrink-0 place-items-center overflow-hidden rounded-lg bg-white ring-1 ring-black/5"
        style={{ width: size, height: size }}
      >
        <Image src="/brand/logo.png" alt="" width={size} height={size} priority />
      </span>
      {showName && (
        <span
          className={cn(
            "truncate font-heading text-base font-semibold tracking-tight",
            tone === "light" ? "text-white" : "text-ink",
          )}
        >
          Velan Spaces
        </span>
      )}
    </span>
  );
}
