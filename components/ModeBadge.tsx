import type { Lang, Leg, LegMode } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { badgeLabel } from "@/lib/ui/route-view";

/** Mode badge for a leg: always a word ("JEEP", "LRT-1", "LAKAD"), never color alone. */
export function ModeBadge({ leg, lang, size = "mode" }: { leg: Leg; lang: Lang; size?: "mode" | "sm" }) {
  return (
    <Badge variant={leg.mode} size={size}>
      {badgeLabel(leg, lang)}
    </Badge>
  );
}

/** Badge from just a mode + label (verdict cards, option buttons). */
export function ModeTag({ mode, label, size = "mode" }: { mode: LegMode; label: string; size?: "mode" | "sm" }) {
  return (
    <Badge variant={mode} size={size}>
      {label}
    </Badge>
  );
}
