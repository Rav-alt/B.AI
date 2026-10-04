"use client";
// Map card: legend + expand button + Leaflet map; expand opens a full-screen dialog (DESIGN.md §6).
import dynamic from "next/dynamic";
import { Maximize2 } from "lucide-react";
import * as m from "motion/react-m";
import type { Itinerary, Lang, PlaceRef } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { legendItems, modeVar, tr } from "@/lib/ui/route-view";
import { mapFade } from "@/lib/motion";

const RouteMap = dynamic(() => import("./RouteMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-map-ground" />,
});

function Legend({ itinerary, lang }: { itinerary: Itinerary; lang: Lang }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-text-2">
      {legendItems(itinerary, lang).map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          {item.mode === "walk" ? (
            <span className="w-3.5 border-t-2 border-dashed" style={{ borderColor: modeVar("walk") }} aria-hidden="true" />
          ) : (
            <span className="h-1 w-3.5 rounded-[2px]" style={{ background: modeVar(item.mode) }} aria-hidden="true" />
          )}
          {item.label}
        </li>
      ))}
    </ul>
  );
}

export function MapCard({ itinerary, origin, destination, lang }: { itinerary: Itinerary; origin: PlaceRef; destination: PlaceRef; lang: Lang }) {
  const label = tr(
    lang,
    `Mapa ng ruta mula ${origin.name} papuntang ${destination.name}. Nasa itaas ang mga hakbang.`,
    `Map of the route from ${origin.name} to ${destination.name}. The steps above describe it.`,
  );
  return (
    <m.figure {...mapFade} className="overflow-hidden rounded-[14px] border border-line">
      <Dialog>
        <div className="flex items-center justify-between gap-2 border-b border-line py-1.5 pr-1.5 pl-3">
          <Legend itinerary={itinerary} lang={lang} />
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={tr(lang, "Palakihin ang mapa", "Expand map")}>
              <Maximize2 aria-hidden="true" />
            </Button>
          </DialogTrigger>
        </div>
        <div className="h-[230px]">
          <RouteMap itinerary={itinerary} origin={origin} destination={destination} label={label} />
        </div>
        <DialogContent
          closeLabel={tr(lang, "Isara ang mapa", "Close map")}
          className="h-dvh w-screen max-w-none grid-rows-[auto_1fr] gap-0 rounded-none border-0 p-0"
        >
          <div className="flex min-h-14 items-center gap-3 border-b border-line py-2 pr-16 pl-4">
            <DialogTitle className="text-lg">{tr(lang, "Mapa", "Map")}</DialogTitle>
            <DialogDescription className="sr-only">{label}</DialogDescription>
            <Legend itinerary={itinerary} lang={lang} />
          </div>
          <div className="min-h-0">
            <RouteMap itinerary={itinerary} origin={origin} destination={destination} label={label} full />
          </div>
        </DialogContent>
      </Dialog>
    </m.figure>
  );
}
