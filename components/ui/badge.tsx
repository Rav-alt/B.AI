// shadcn/ui Badge, with B.AI's mode and verdict variants (DESIGN.md §6–7). Always has a text label.
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex shrink-0 items-center justify-center whitespace-nowrap font-bold [&_svg]:shrink-0", {
  variants: {
    variant: {
      train: "bg-mode-train text-paper",
      bus: "bg-mode-bus text-paper",
      jeep: "bg-mode-jeep text-paper",
      uv: "bg-mode-uv text-paper",
      walk: "border-[1.5px] border-dashed border-mode-walk bg-paper text-text-2",
      yes: "gap-1 rounded-full bg-ink text-paper",
      no: "gap-1 rounded-full border-[1.5px] border-ink bg-paper text-ink",
    },
    size: {
      mode: "h-[26px] rounded-[5px] px-[7px] text-[11px] tracking-[0.6px]",
      sm: "h-[22px] rounded-[4px] px-1.5 text-[10px] tracking-[0.5px]",
      pill: "h-7 px-2.5 text-[13px] font-extrabold",
    },
  },
  defaultVariants: { variant: "jeep", size: "mode" },
});

function Badge({ className, variant, size, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant, size }), className)} {...props} />;
}

export { Badge, badgeVariants };
