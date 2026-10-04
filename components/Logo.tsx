// The logo is a signboard (DESIGN.md §1, §6).
import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoPlacard({ size = "md", className }: { size?: "md" | "sm"; className?: string }) {
  return (
    <span
      className={cn(
        "inline-block rounded-[4px] border-ink bg-signboard font-display leading-none tracking-[0.5px] text-ink uppercase",
        size === "md" ? "border-2 px-2 py-1 text-[20px]" : "rounded-[3px] border-[1.5px] px-1.5 py-0.5 text-[13px]",
        className,
      )}
    >
      B.AI
    </span>
  );
}

export function Logo() {
  return (
    <Link href="/" className="flex min-h-11 items-center gap-2.5 rounded-sm" aria-label="B.AI, commute buddy, home">
      <LogoPlacard />
      <span className="text-xs leading-tight text-muted-foreground" aria-hidden="true">
        Commute buddy
        <br />
        Metro Manila
      </span>
    </Link>
  );
}
