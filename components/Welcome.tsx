"use client";
// Welcome screen (DESIGN.md §9 screen 1): headline, intro, starter chips, limits panel.
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const STARTERS: { label: string; message: string }[] = [
  { label: "Pedro Gil Taft → España", message: "Nasa Pedro Gil Taft ako, papuntang España. Anong bus o jeep ang sasakyan ko?" },
  { label: "Cubao → Makati", message: "Paano pumunta from Cubao to Makati?" },
  {
    label: "Bus papuntang Fairview o jeep papuntang Divisoria?",
    message: "Galing Pedro Gil Taft papuntang España, bus papuntang SM Fairview o jeep papuntang Divisoria?",
  },
];

export function Welcome({ onStart, disabled }: { onStart: (message: string) => void; disabled?: boolean }) {
  return (
    <div className="flex min-h-full flex-col gap-7 pt-3">
      <div className="flex flex-col gap-3">
        <h1 className="font-display text-[44px] leading-[0.98] tracking-[-0.5px]">
          Saan ka galing?
          <br />
          Saan ka papunta?
        </h1>
        <p className="text-base leading-[1.45] text-text-2">
          Sabihin mo lang kung nasaan ka at saan ka pupunta. Sasabihin ko kung anong signboard ang hahanapin mo.
        </p>
      </div>
      <div className="flex flex-col gap-2.5">
        <span className="font-mono text-xs font-semibold tracking-[0.8px] text-muted-foreground uppercase">Subukan</span>
        <div className="flex flex-wrap gap-2">
          {STARTERS.map((s) => (
            <Button key={s.label} variant="chip" size="chip" disabled={disabled} onClick={() => onStart(s.message)}>
              {s.label}
            </Button>
          ))}
        </div>
      </div>
      <div id="limits" className="mt-auto flex flex-col gap-1.5 rounded-[10px] bg-surface p-3.5">
        <span className="text-sm font-bold">Ruta lang ang alam ko</span>
        <span className="text-[13px] leading-[1.45] text-text-2">
          Walang pamasahe, schedule, o live traffic. Luma na ang ilang ruta sa data, kaya magtanong pa rin sa driver.{" "}
          <Link href="/limitations" className="font-semibold text-ink underline underline-offset-3">
            Basahin ang limitations
          </Link>
        </span>
      </div>
    </div>
  );
}
