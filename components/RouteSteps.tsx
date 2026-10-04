"use client";
// The step list (DESIGN.md §6 "B.AI answer"): the accessible, text version of the map.
import { Fragment } from "react";
import * as m from "motion/react-m";
import type { GeoPlace, Itinerary, Lang } from "@/lib/types";
import { ModeBadge } from "./ModeBadge";
import { Signboard } from "./Signboard";
import { legMeta, stopLabel, totalSummary, tr } from "@/lib/ui/route-view";
import { stepItem, stepList } from "@/lib/motion";

export function RouteSteps({ itinerary, destination, lang }: { itinerary: Itinerary; destination: GeoPlace; lang: Lang }) {
  const last = itinerary.legs.length - 1;
  return (
    <m.ol variants={stepList} initial="hidden" animate="shown" className="flex flex-col">
      {itinerary.legs.map((leg, i) => (
        <m.li
          key={i}
          variants={i < 6 ? stepItem : undefined}
          className="grid grid-cols-[52px_minmax(0,1fr)] gap-3 border-t border-line-soft py-3.5"
        >
          <span className="justify-self-start">
            <ModeBadge leg={leg} lang={lang} />
          </span>
          <div className="flex min-w-0 flex-col gap-1.5">
            {leg.mode === "walk" ? (
              <p>
                {tr(lang, "Lakad papuntang ", "Walk to ")}
                <strong className="font-bold">{i === last ? destination.name : stopLabel(leg.to.name)}</strong>.
              </p>
            ) : leg.mode === "train" ? (
              <>
                <p>
                  {tr(lang, "Sakay ng ", "Take the ")}
                  <strong className="font-bold">{leg.line ?? leg.routeName}</strong>
                  {tr(lang, " sa ", " at ")}
                  <strong className="font-bold">{stopLabel(leg.boardStop.name)}</strong>
                  {leg.towards ? tr(lang, `, papuntang ${leg.towards}`, `, towards ${leg.towards}`) : ""}.
                </p>
                <p>
                  {tr(lang, "Baba sa ", "Get off at ")}
                  <strong className="font-bold">{stopLabel(leg.alightStop.name)}</strong>.
                </p>
              </>
            ) : (
              <>
                <p>
                  {tr(lang, "Sa ", "At ")}
                  <strong className="font-bold">{stopLabel(leg.boardStop.name)}</strong>
                  {tr(
                    lang,
                    `, sakay ng ${leg.mode === "uv" ? "UV Express" : leg.mode} na may signboard na:`,
                    `, take the ${leg.mode === "uv" ? "UV Express" : leg.mode === "jeep" ? "jeepney" : "bus"} with the signboard:`,
                  )}
                </p>
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Signboard>{leg.routeName}</Signboard>
                  {leg.towards && (
                    <span className="text-[13px] text-text-2">{tr(lang, `papuntang ${leg.towards}`, `towards ${leg.towards}`)}</span>
                  )}
                </span>
                <p>
                  {tr(lang, "Baba sa ", "Get off at ")}
                  <strong className="font-bold">{stopLabel(leg.alightStop.name)}</strong>.
                </p>
              </>
            )}
            <span className="font-mono text-xs text-muted-foreground">{legMeta(leg, lang)}</span>
          </div>
        </m.li>
      ))}
      <li className="flex items-baseline justify-between gap-3 border-t-[1.5px] border-ink pt-3">
        <span className="text-sm font-bold">{tr(lang, "Kabuuan", "Total")}</span>
        <span className="text-right font-mono text-[13px] font-semibold">
          {totalSummary(itinerary, lang)
            .split(" · ")
            .map((part, i) => (
              <Fragment key={i}>
                {i > 0 && " · "}
                <span className="whitespace-nowrap">{part}</span>
              </Fragment>
            ))}
        </span>
      </li>
    </m.ol>
  );
}
