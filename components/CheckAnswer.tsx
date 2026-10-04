"use client";
// Check-routes answer: one verdict card per asked vehicle → conclusion → map → disclaimer (DESIGN.md §6).
import { Check, X } from "lucide-react";
import type { CandidateVerdict, CheckResult, GeoPlace, Lang } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Signboard } from "./Signboard";
import { ModeTag } from "./ModeBadge";
import { RichText } from "./RichText";
import { MapCard } from "./MapCard";
import { Disclaimer } from "./Disclaimer";
import { RoutePlan } from "./RoutePlan";
import { verdictSentence } from "@/lib/chat/templates";
import { isRide, stopLabel, totalSummary, tr } from "@/lib/ui/route-view";
import { cn } from "@/lib/utils";

const MODE_LABEL = { bus: "BUS", jeep: "JEEP", uv: "UV", train: "TREN" } as const;

function VerdictCard({ v, origin, destination, lang }: { v: CandidateVerdict; origin: GeoPlace; destination: GeoPlace; lang: Lang }) {
  const yes = v.verdict === "yes";
  const ride = v.itinerary?.legs.find(isRide);
  const mode = ride?.mode ?? v.candidate.mode ?? v.matchedRoutes[0]?.mode;
  // Yes: show the exact signboard to look for. No: show what the user asked about.
  const board = yes && ride && ride.mode !== "train" ? ride.routeName : v.candidate.signboard;
  return (
    <article className={cn("flex flex-col gap-2.5 rounded-[12px] p-3.5", yes ? "border-[1.5px] border-ink" : "border border-line")}>
      <div className="flex items-start gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {mode && <ModeTag mode={mode} label={ride?.mode === "train" && ride.line ? ride.line : MODE_LABEL[mode]} />}
          <Signboard size="sm">{board}</Signboard>
        </div>
        <Badge variant={yes ? "yes" : "no"} size="pill" className="ml-auto">
          {yes ? <Check className="size-3.5" strokeWidth={3} aria-hidden="true" /> : <X className="size-3.5" strokeWidth={3} aria-hidden="true" />}
          {yes ? tr(lang, "OO", "YES") : tr(lang, "HINDI", "NO")}
        </Badge>
      </div>
      <p className={cn(!yes && "text-text-2")}>
        {verdictSentence(v.reason, origin, destination, lang)}
        {yes && ride && (
          <>
            {" "}
            {tr(lang, "Sakay sa ", "Board at ")}
            <strong className="font-bold">{stopLabel(ride.boardStop.name)}</strong>
            {tr(lang, ", baba sa ", ", get off at ")}
            <strong className="font-bold">{stopLabel(ride.alightStop.name)}</strong>.
          </>
        )}
      </p>
      {yes && v.itinerary && <span className="font-mono text-xs text-muted-foreground">{totalSummary(v.itinerary, lang)}</span>}
    </article>
  );
}

export function CheckAnswer({
  check,
  origin,
  destination,
  lang,
  lead,
  disclaimer,
}: {
  check: CheckResult;
  origin: GeoPlace;
  destination: GeoPlace;
  lang: Lang;
  lead: string;
  disclaimer?: string;
}) {
  const yes = check.verdicts.find((v) => v.verdict === "yes" && v.itinerary);
  return (
    <div className="flex flex-col gap-3">
      {check.verdicts.map((v, i) => (
        <VerdictCard key={i} v={v} origin={origin} destination={destination} lang={lang} />
      ))}
      <RichText text={lead} className="mt-1 text-[17px] leading-[1.4]" />
      {yes?.itinerary ? (
        <>
          <MapCard itinerary={yes.itinerary} origin={origin} destination={destination} lang={lang} />
          <Disclaimer text={disclaimer} lang={lang} />
        </>
      ) : check.alternative?.status === "ok" ? (
        <RoutePlan plan={check.alternative} origin={origin} destination={destination} lang={lang} disclaimer={disclaimer} />
      ) : (
        <Disclaimer text={disclaimer} lang={lang} />
      )}
    </div>
  );
}
