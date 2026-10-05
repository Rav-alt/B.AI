"use client";
// "Hindi ko mahanap…" follow-up: type the address (or a landmark near it), or pin the spot on a map.
// Both send the question again as a plain From/To request, keeping the place that was already found.
import { useCallback, useId, useState } from "react";
import dynamic from "next/dynamic";
import { MapPin } from "lucide-react";
import type { ChatResponse, Lang } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { tr } from "@/lib/ui/route-view";

const PinMap = dynamic(() => import("./PinMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-map-ground" />,
});

export type FollowUpInfo = NonNullable<ChatResponse["followUp"]>;

/** Manila City Hall area: a sensible middle when we know nothing else. */
const METRO_CENTER = { lat: 14.5995, lon: 120.9842 };

export interface FollowUpProps {
  followUp: FollowUpInfo;
  lang: Lang;
  disabled: boolean;
  onAddress: (text: string) => void;
  onPin: (spot: { lat: number; lon: number }) => void;
}

export function FollowUp({ followUp, lang, disabled, onAddress, onPin }: FollowUpProps) {
  const id = useId();
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [spot, setSpot] = useState<{ lat: number; lon: number } | undefined>();
  const onMove = useCallback((c: { lat: number; lon: number }) => setSpot(c), []);

  // Start the map near the place we already know (the other end of the trip), else central Manila.
  const known = followUp.field === "destination" ? followUp.request.picked.origin : followUp.request.picked.destination;
  const start = known ? { lat: known.lat, lon: known.lon } : METRO_CENTER;
  const letter = followUp.field === "origin" ? "A" : "B";
  const what = followUp.field === "origin" ? tr(lang, "pinanggalingan mo", "your starting point") : tr(lang, "pupuntahan mo", "where you're going");

  return (
    <div className="flex flex-col gap-3">
      <form
        className="flex flex-col gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          const t = text.trim();
          if (t && !disabled) onAddress(t);
        }}
      >
        <Label htmlFor={id}>{tr(lang, "Address o malapit na landmark", "Address or a nearby landmark")}</Label>
        <div className="flex gap-2">
          <Input
            id={id}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={tr(lang, "Hal. P. Celle St, Pasay", "e.g. P. Celle St, Pasay")}
            autoComplete="off"
            maxLength={200}
          />
          <Button type="submit" disabled={disabled || !text.trim()} className="shrink-0">
            {tr(lang, "Hanapin", "Search")}
          </Button>
        </div>
      </form>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className="self-start" disabled={disabled}>
            <MapPin aria-hidden="true" />
            {tr(lang, "I-pin sa mapa", "Pin it on the map")}
          </Button>
        </DialogTrigger>
        <DialogContent
          closeLabel={tr(lang, "Isara ang mapa", "Close map")}
          className="h-dvh w-screen max-w-none grid-rows-[auto_1fr_auto] gap-0 rounded-none border-0 p-0"
        >
          <div className="flex min-h-14 flex-col justify-center gap-0.5 border-b border-line py-2 pr-16 pl-4">
            <DialogTitle className="text-lg">{tr(lang, "I-pin sa mapa", "Pin it on the map")}</DialogTitle>
            <DialogDescription>
              {tr(
                lang,
                `Igalaw ang mapa hanggang nasa ${what} ang pin, o pindutin ang lugar.`,
                `Move the map until the pin is on ${what}, or tap the spot.`,
              )}
            </DialogDescription>
          </div>
          <div className="min-h-0">
            {open && (
              <PinMap
                center={start}
                zoom={known ? 15 : 13}
                letter={letter}
                onMove={onMove}
                label={tr(lang, "Mapa para pumili ng lugar. Gamitin ang arrow keys para igalaw.", "Map for choosing a spot. Use the arrow keys to move it.")}
              />
            )}
          </div>
          <div className="border-t border-line px-4 py-3">
            <Button
              size="lg"
              className="w-full"
              disabled={!spot || disabled}
              onClick={() => {
                if (!spot) return;
                setOpen(false);
                onPin(spot);
              }}
            >
              {tr(lang, "Gamitin ang puwestong ito", "Use this spot")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
