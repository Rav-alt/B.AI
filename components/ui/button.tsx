// shadcn/ui Button (new-york), restyled per DESIGN.md §7: no shadows, 44px+ sizes.
// Focus ring: the global :focus-visible rule in globals.css (3px solid --focus), so it is the same everywhere.
import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap transition-[color,background-color,border-color] duration-150 motion-reduce:transition-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
  {
    variants: {
      variant: {
        default: "bg-ink text-paper hover:bg-[#2A302D]",
        outline: "border-[1.5px] border-ink bg-paper text-ink hover:bg-surface",
        ghost: "bg-transparent text-ink hover:bg-surface",
        chip: "rounded-sm border-[1.5px] border-ink bg-paper font-semibold text-ink hover:bg-surface",
        link: "text-ink font-semibold underline underline-offset-3",
      },
      size: {
        default: "h-12 rounded-md px-5 text-[15px] font-bold",
        lg: "h-[52px] rounded-md px-6 text-base font-bold",
        chip: "min-h-11 whitespace-normal px-3.5 py-2.5 text-left text-[15px]",
        icon: "size-12 rounded-md",
        "icon-sm": "size-11 rounded-sm",
        link: "min-h-11 px-1 text-sm",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "button";
  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };
