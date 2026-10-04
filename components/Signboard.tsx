// The signature element: a yellow placard with the signboard text to look for on the street.
import { cn } from "@/lib/utils";

export function Signboard({ children, size = "md", className }: { children: React.ReactNode; size?: "md" | "sm"; className?: string }) {
  return (
    <span
      className={cn(
        "inline-block max-w-full rounded-[4px] border-2 border-ink bg-signboard font-display leading-none tracking-[0.5px] break-words text-ink uppercase",
        size === "md" ? "px-2.5 py-1.5 text-[20px]" : "px-2 py-[5px] text-[18px]",
        className,
      )}
    >
      {children}
    </span>
  );
}
