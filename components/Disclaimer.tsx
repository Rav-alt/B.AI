import { Info } from "lucide-react";
import type { Lang } from "@/lib/types";
import { DISCLAIMER } from "@/lib/chat/format";

/** Under every route answer (DESIGN.md §6). Text comes from the API so it always matches. */
export function Disclaimer({ text, lang = "fil" }: { text?: string; lang?: Lang }) {
  return (
    <div role="note" className="flex gap-2.5 rounded-[10px] border border-paalala-line bg-paalala p-3">
      <Info className="mt-px size-[18px] shrink-0 text-ink" strokeWidth={2} aria-hidden="true" />
      <p className="text-[13px] leading-[1.45] text-ink">{text ?? DISCLAIMER[lang]}</p>
    </div>
  );
}
