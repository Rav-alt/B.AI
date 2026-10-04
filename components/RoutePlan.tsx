"use client";
// One trip answer body: lead → steps → map → disclaimer → other options (DESIGN.md §6).
import { useState } from "react";
import type { GeoPlace, Lang, PlanResult } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { RichText } from "./RichText";
import { RouteSteps } from "./RouteSteps";
import { MapCard } from "./MapCard";
import { Disclaimer } from "./Disclaimer";
import { ModeBadge } from "./ModeBadge";
import { isRide, optionLabel, optionLead, tr } from "@/lib/ui/route-view";
import { shortMinutes } from "@/lib/chat/format";

export interface RoutePlanProps {
  plan: PlanResult;
  origin: GeoPlace;
  destination: GeoPlace;
  lang: Lang;
  /** The lead for option 1 (AI or template). Other options get a generated lead. */
  lead?: string;
  disclaimer?: string;
  /** Called when the visible option changes (for the "Option 1 of 3" meta). */
  onOption?: (index: number) => void;
}

export function RoutePlan({ plan, origin, destination, lang, lead, disclaimer, onOption }: RoutePlanProps) {
  const [selected, setSelected] = useState(0);
  const it = plan.itineraries[selected];
  if (!it) return null;
  const choose = (i: number) => {
    setSelected(i);
    onOption?.(i);
  };
  return (
    <div className="flex flex-col gap-3.5">
      <RichText
        text={selected === 0 && lead ? lead : optionLead(it, selected, lang)}
        className="text-[17px] leading-[1.4]"
      />
      <RouteSteps key={selected} itinerary={it} destination={destination} lang={lang} />
      <MapCard key={`map-${selected}`} itinerary={it} origin={origin} destination={destination} lang={lang} />
      <Disclaimer text={disclaimer} lang={lang} />
      {plan.itineraries.length > 1 && (
        <div className="flex flex-col gap-2">
          <span className="font-mono text-xs font-semibold tracking-[0.8px] text-muted-foreground uppercase">
            {tr(lang, "Iba pang paraan", "Other ways")}
          </span>
          {plan.itineraries.map((other, i) =>
            i === selected ? null : (
              <Button
                key={i}
                variant="outline"
                onClick={() => choose(i)}
                className="h-auto min-h-14 justify-between gap-2.5 border border-line px-3 py-2.5 text-left font-semibold whitespace-normal"
              >
                <span className="flex min-w-0 flex-wrap items-center gap-2">
                  {other.legs.filter(isRide).map((l, j) => (
                    <ModeBadge key={j} leg={l} lang={lang} size="sm" />
                  ))}
                  <span className="min-w-0 text-sm break-words">{optionLabel(other, lang)}</span>
                </span>
                <span className="shrink-0 font-mono text-[13px] font-semibold">~{shortMinutes(other.totalMinutes)}</span>
              </Button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
