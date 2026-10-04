// shadcn/ui Input, restyled: 48px, 1.5px ink border, solid focus ring, no shadow (DESIGN.md §7).
import * as React from "react";
import { cn } from "@/lib/utils";

function Input({ className, type = "text", ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-12 w-full min-w-0 rounded-md border-[1.5px] border-input bg-paper px-3.5 text-[15px] text-ink placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
