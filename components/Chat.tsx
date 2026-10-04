"use client";
// The chat: holds the conversation, talks to /api/chat, and picks the right view for each answer.
import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatRequestInput, ChatResponse, GeoPlace } from "@/lib/types";
import { Header } from "./Header";
import { Welcome } from "./Welcome";
import { InputBar } from "./InputBar";
import { BotMessage, ErrorMessage, Thinking, UserMessage, type BotActions } from "./Messages";
import type { FallbackSubmit } from "./FallbackForm";
import { useLocation } from "@/lib/ui/use-location";

type Msg =
  | { id: number; role: "user"; text: string }
  | { id: number; role: "bot"; res: ChatResponse; req: ChatRequestInput }
  | { id: number; role: "error"; text: string; req: ChatRequestInput };

let nextId = 1;

/** Last few turns for the AI, so "España" can answer "Saan ka papunta?". */
type Turn = { role: "user" | "assistant"; text: string };
function historyOf(msgs: Msg[]): Turn[] {
  const turns: Turn[] = [];
  for (const m of msgs) {
    if (m.role === "user") turns.push({ role: "user", text: m.text });
    else if (m.role === "bot") turns.push({ role: "assistant", text: m.res.text.slice(0, 1000) });
  }
  return turns.slice(-6);
}

export function Chat() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lon: number } | undefined>();
  const loc = useLocation();
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (msgs.length === 0 && !pending) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    endRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "end" });
  }, [msgs, pending]);

  const send = useCallback(async (req: ChatRequestInput, userText?: string) => {
    if (userText) setMsgs((m) => [...m, { id: nextId++, role: "user", text: userText }]);
    setPending(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req),
      });
      const body: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const message =
          body && typeof body === "object" && "message" in body && typeof body.message === "string"
            ? body.message
            : "May error. Subukan ulit.";
        setMsgs((m) => [...m, { id: nextId++, role: "error", text: message, req }]);
      } else {
        setMsgs((m) => [...m, { id: nextId++, role: "bot", res: body as ChatResponse, req }]);
      }
    } catch {
      setMsgs((m) => [...m, { id: nextId++, role: "error", text: "Hindi ma-reach ang server. Check ang internet mo at subukan ulit.", req }]);
    } finally {
      setPending(false);
    }
  }, []);

  const ask = (message: string) => {
    const text = message.trim();
    if (!text || pending) return;
    setDraft("");
    void send({ message: text, history: historyOf(msgs), ...(location ? { location } : {}) }, text);
  };

  const locate = async () => {
    const here = await loc.request();
    if (!here) return;
    setLocation(here);
    if (!draft.trim()) setDraft("Nasa lokasyon ko ako, papuntang ");
    inputRef.current?.focus();
  };

  const actionsFor = (req: ChatRequestInput): BotActions => ({
    pending,
    pick: (field: "origin" | "destination", place: GeoPlace) =>
      void send(
        { ...req, picked: { ...req.picked, [field]: { name: place.name, lat: place.lat, lon: place.lon, ...(place.stopId ? { stopId: place.stopId } : {}) } } },
        place.name,
      ),
    useLocation: async () => {
      const here = await loc.request();
      if (here) void send({ ...req, location: here }, "Lokasyon ko");
    },
    submitForm: (v: FallbackSubmit) =>
      void send(
        {
          ...(v.from ? { from: v.from } : { fromCurrentLocation: true }),
          to: v.to,
          prefs: v.prefs,
          ...(v.location ? { location: v.location } : {}),
        },
        `${v.from ?? "Lokasyon ko"} → ${v.to}`,
      ),
  });

  return (
    <div className="flex h-dvh flex-col bg-paper">
      <Header />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex min-h-full max-w-[640px] flex-col gap-5 px-4 py-5" aria-live="polite">
          {msgs.length === 0 && !pending ? (
            <Welcome onStart={ask} disabled={pending} />
          ) : (
            msgs.map((m) =>
              m.role === "user" ? (
                <UserMessage key={m.id} text={m.text} />
              ) : m.role === "bot" ? (
                <BotMessage key={m.id} res={m.res} actions={actionsFor(m.req)} />
              ) : (
                <ErrorMessage key={m.id} text={m.text} pending={pending} onRetry={() => void send(m.req)} />
              ),
            )
          )}
          {pending && <Thinking />}
          <div ref={endRef} />
        </div>
      </main>
      <div className="shrink-0 border-t border-line bg-paper">
        <div className="mx-auto max-w-[640px] px-4 py-3">
          <InputBar
            value={draft}
            onChange={setDraft}
            onSubmit={() => ask(draft)}
            onLocate={locate}
            onClearLocation={() => setLocation(undefined)}
            hasLocation={!!location}
            locating={loc.state.status === "asking"}
            locationError={loc.state.status === "error" ? loc.state.message : undefined}
            pending={pending}
            placeholder={msgs.length ? "Magtanong ulit…" : "Hal. Nasa Cubao ako, papuntang Makati"}
            inputRef={inputRef}
          />
        </div>
      </div>
    </div>
  );
}
