"use client";
// No-AI fallback (DESIGN.md §9 screen 4): From / To boxes + preferences. Works with no Gemini at all.
import { useId, useState } from "react";
import { LocateFixed } from "lucide-react";
import type { Lang, Prefs } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { tr } from "@/lib/ui/route-view";
import { useLocation } from "@/lib/ui/use-location";
import { cn } from "@/lib/utils";

export interface FallbackSubmit {
  from?: string;
  to: string;
  prefs: Prefs;
  location?: { lat: number; lon: number };
}

const PREFS: { key: keyof Prefs; fil: string; en: string }[] = [
  { key: "fewestTransfers", fil: "Kaunting transfer", en: "Fewer transfers" },
  { key: "lessWalking", fil: "Kaunting lakad", en: "Less walking" },
  { key: "trainsOnly", fil: "Tren lang", en: "Trains only" },
  { key: "avoidTrains", fil: "Iwas tren", en: "No trains" },
];

export function FallbackForm({ lang, disabled, onSubmit }: { lang: Lang; disabled?: boolean; onSubmit: (v: FallbackSubmit) => void }) {
  const id = useId();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [prefs, setPrefs] = useState<Prefs>({});
  const [here, setHere] = useState<{ lat: number; lon: number } | undefined>();
  const loc = useLocation();
  const hereLabel = tr(lang, "Lokasyon ko", "My location");

  const toggle = (key: keyof Prefs) =>
    setPrefs((p) => {
      const next = { ...p, [key]: !p[key] };
      if (key === "trainsOnly" && next.trainsOnly) next.avoidTrains = false;
      if (key === "avoidTrains" && next.avoidTrains) next.trainsOnly = false;
      return next;
    });

  return (
    <form
      className="flex flex-col gap-3.5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!to.trim() || (!from.trim() && !here)) return;
        onSubmit({ from: here ? undefined : from.trim(), to: to.trim(), prefs, location: here });
      }}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-from`}>{tr(lang, "Mula sa (From)", "From")}</Label>
        <div className="flex gap-2">
          <Input
            id={`${id}-from`}
            value={here ? hereLabel : from}
            readOnly={!!here}
            onChange={(e) => setFrom(e.target.value)}
            onFocus={() => here && (setHere(undefined), setFrom(""))}
            placeholder={tr(lang, "Hal. Pedro Gil Taft", "e.g. Pedro Gil Taft")}
            autoComplete="off"
            required={!here}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={tr(lang, "Gamitin ang lokasyon ko", "Use my location")}
            aria-pressed={!!here}
            disabled={loc.state.status === "asking"}
            className={cn(here && "bg-signboard hover:bg-signboard")}
            onClick={async () => setHere((await loc.request()) ?? undefined)}
          >
            <LocateFixed aria-hidden="true" />
          </Button>
        </div>
        {loc.state.status === "error" && <p className="text-[13px] text-error">{loc.state.message}</p>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-to`}>{tr(lang, "Papunta sa (To)", "To")}</Label>
        <Input
          id={`${id}-to`}
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder={tr(lang, "Hal. España", "e.g. España")}
          autoComplete="off"
          required
        />
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-[13px] font-bold">{tr(lang, "Gusto ko", "I prefer")}</legend>
        <div className="grid grid-cols-2 gap-2">
          {PREFS.map((p) => (
            <label
              key={p.key}
              className={cn(
                "flex min-h-11 cursor-pointer items-center gap-2 rounded-sm px-3 text-sm font-semibold transition-[color,background-color,border-color] duration-150 has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--focus)] has-[:focus-visible]:outline-solid motion-reduce:transition-none",
                prefs[p.key] ? "border-[1.5px] border-ink bg-signboard text-ink" : "border border-line bg-paper hover:bg-surface",
              )}
            >
              <input type="checkbox" className="size-4 accent-ink focus-visible:outline-none" checked={!!prefs[p.key]} onChange={() => toggle(p.key)} />
              {tr(lang, p.fil, p.en)}
            </label>
          ))}
        </div>
      </fieldset>
      <Button type="submit" size="lg" disabled={disabled}>
        {tr(lang, "Hanapin ang ruta", "Find a route")}
      </Button>
    </form>
  );
}
