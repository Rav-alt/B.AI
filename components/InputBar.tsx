"use client";
// Bottom bar (DESIGN.md §6 Message input): location · question · send, then the privacy note and credits.
import { useId } from "react";
import { ArrowRight, LocateFixed, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FooterCredit } from "./FooterCredit";
import { cn } from "@/lib/utils";

export interface InputBarProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onLocate: () => void;
  onClearLocation: () => void;
  hasLocation: boolean;
  locating: boolean;
  locationError?: string;
  pending: boolean;
  placeholder: string;
  inputRef?: React.Ref<HTMLInputElement>;
}

export function InputBar({ inputRef, ...p }: InputBarProps) {
  const id = useId();
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (p.value.trim() && !p.pending) p.onSubmit();
      }}
    >
      {p.hasLocation && (
        <div className="flex items-center gap-2 text-[13px] text-text-2">
          <span>Gagamitin ang lokasyon mo sa susunod na tanong.</span>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Huwag gamitin ang lokasyon ko" onClick={p.onClearLocation}>
            <X aria-hidden="true" />
          </Button>
        </div>
      )}
      {p.locationError && <p className="text-[13px] text-error">{p.locationError}</p>}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Use my location"
          aria-pressed={p.hasLocation}
          disabled={p.locating}
          onClick={p.onLocate}
          className={cn("shrink-0", p.hasLocation && "bg-signboard hover:bg-signboard")}
        >
          <LocateFixed aria-hidden="true" />
        </Button>
        <Label htmlFor={id} className="sr-only">
          Your question
        </Label>
        <Input
          ref={inputRef}
          id={id}
          value={p.value}
          onChange={(e) => p.onChange(e.target.value)}
          placeholder={p.placeholder}
          autoComplete="off"
          maxLength={500}
          enterKeyHint="send"
        />
        <Button type="submit" size="icon" aria-label="Send" disabled={p.pending || !p.value.trim()} className="shrink-0">
          <ArrowRight strokeWidth={2.2} aria-hidden="true" />
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Don&apos;t type personal information.</p>
      <FooterCredit />
    </form>
  );
}
