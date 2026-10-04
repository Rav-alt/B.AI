"use client";
// Chat messages: the user's bubble, B.AI's answers (no bubble), the thinking dots.
import { useState } from "react";
import * as m from "motion/react-m";
import type { ChatResponse, GeoPlace } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { LogoPlacard } from "./Logo";
import { RichText } from "./RichText";
import { RoutePlan } from "./RoutePlan";
import { CheckAnswer } from "./CheckAnswer";
import { Disclaimer } from "./Disclaimer";
import { FallbackForm, type FallbackSubmit } from "./FallbackForm";
import { fadeUp, thinkingDot } from "@/lib/motion";
import { tr } from "@/lib/ui/route-view";

export function UserMessage({ text }: { text: string }) {
  return (
    <m.div {...fadeUp} className="max-w-[82%] self-end rounded-[16px_16px_4px_16px] bg-ink px-3.5 py-3 text-[15px] leading-[1.4] break-words text-paper">
      {text}
    </m.div>
  );
}

function BotHeader({ meta }: { meta?: string }) {
  return (
    <div className="flex items-center gap-2">
      <LogoPlacard size="sm" />
      {meta && <span className="font-mono text-xs text-muted-foreground">{meta}</span>}
      <span className="sr-only">B.AI:</span>
    </div>
  );
}

export function Thinking() {
  return (
    <m.div {...fadeUp} className="flex items-center gap-2" role="status">
      <LogoPlacard size="sm" />
      <span className="flex gap-1 font-display text-xl leading-none" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <m.span key={i} {...thinkingDot(i)}>
            .
          </m.span>
        ))}
      </span>
      <span className="sr-only">Nag-iisip si B.AI…</span>
    </m.div>
  );
}

export interface BotActions {
  pending: boolean;
  /** Resend the question with a place picked from "Alin dito?". */
  pick: (field: "origin" | "destination", place: GeoPlace) => void;
  /** Resend the question with the browser location. */
  useLocation: () => void;
  /** Submit the From/To form. */
  submitForm: (v: FallbackSubmit) => void;
}

export function BotMessage({ res, actions }: { res: ChatResponse; actions: BotActions }) {
  const [option, setOption] = useState(0);
  const { lang } = res;
  const count = res.plan?.itineraries.length ?? 0;

  let meta: string | undefined;
  if (res.kind === "route" && count > 0) meta = tr(lang, `Option ${option + 1} of ${count}`, `Option ${option + 1} of ${count}`);
  if (res.kind === "check" && res.check) {
    const n = res.check.verdicts.length;
    meta = tr(lang, n === 1 ? "Sinilip ko" : n === 2 ? "Sinilip ko ang dalawa" : `Sinilip ko ang ${n}`, n === 1 ? "I checked it" : `I checked all ${n}`);
  }

  return (
    <m.section {...fadeUp} className="flex flex-col gap-3.5">
      <BotHeader meta={meta} />

      {res.kind === "route" && res.plan && res.origin && res.destination ? (
        <RoutePlan
          plan={res.plan}
          origin={res.origin}
          destination={res.destination}
          lang={lang}
          lead={res.text}
          disclaimer={res.disclaimer}
          onOption={setOption}
        />
      ) : res.kind === "check" && res.check && res.origin && res.destination ? (
        <CheckAnswer check={res.check} origin={res.origin} destination={res.destination} lang={lang} lead={res.text} disclaimer={res.disclaimer} />
      ) : res.kind === "ask_place" && res.choices ? (
        <>
          <RichText text={res.text.split("\n")[0]!} className="text-[17px] leading-[1.4]" />
          <div className="flex flex-col gap-2">
            {res.choices.options.map((o, i) => (
              <Button
                key={i}
                variant="outline"
                disabled={actions.pending}
                onClick={() => actions.pick(res.choices!.field, o)}
                className="h-auto min-h-12 flex-col items-start justify-center gap-0.5 px-3.5 py-2.5 text-left whitespace-normal"
              >
                <span className="text-[15px] font-bold">{o.name}</span>
                {o.area && !o.name.includes(o.area) && <span className="text-[13px] font-normal text-text-2">{o.area}</span>}
              </Button>
            ))}
          </div>
        </>
      ) : res.kind === "need_location" ? (
        <>
          <RichText text={res.text} className="text-[17px] leading-[1.4]" />
          <Button variant="outline" className="self-start" disabled={actions.pending} onClick={actions.useLocation}>
            {tr(lang, "Gamitin ang lokasyon ko", "Use my location")}
          </Button>
        </>
      ) : res.kind === "fallback_form" ? (
        <>
          <div role="status" className="rounded-[10px] bg-surface p-3.5 text-sm leading-[1.45]">
            <strong className="font-bold">{tr(lang, "Pahinga muna ang chat.", "The chat is taking a break.")}</strong>{" "}
            {tr(
              lang,
              "Hindi ko mabasa ang tanong ngayon, pero puwede ka pa ring maghanap ng ruta dito.",
              "I can't read free-text questions right now, but you can still find a route here.",
            )}
          </div>
          <FallbackForm lang={lang} disabled={actions.pending} onSubmit={actions.submitForm} />
        </>
      ) : (
        <>
          <RichText text={res.text} className="text-[17px] leading-[1.4]" />
          {res.kind === "no_route" && <Disclaimer text={res.disclaimer} lang={lang} />}
        </>
      )}
    </m.section>
  );
}

export function ErrorMessage({ text, onRetry, pending }: { text: string; onRetry?: () => void; pending: boolean }) {
  return (
    <m.section {...fadeUp} className="flex flex-col gap-2.5">
      <BotHeader />
      <p role="alert" className="text-error">
        {text}
      </p>
      {onRetry && (
        <Button variant="outline" className="self-start" disabled={pending} onClick={onRetry}>
          Subukan ulit
        </Button>
      )}
    </m.section>
  );
}
