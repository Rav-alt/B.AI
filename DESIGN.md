# B.AI — Design Rules

> **For every agent working on UI:** read this file before you touch anything a visitor sees
> (components, styles, layout, copy formatting, the map, animation). Follow it exactly. If a
> request conflicts with these rules, say so and ask before breaking one.
>
> Reference mockup: the "B.AI Design Mockup" canvas (screens 1–4 + Style tile).
> UI stack: **shadcn/ui** (Tailwind v4, `new-york` style) + **Motion** (`motion/react`) for animation.
> Built in Phase 5; section 14 says how the code maps to these rules.

---

## 1. The idea in one line

**The logo is a signboard. So is every route name.**

B.AI borrows from jeepney signboards: a yellow placard with heavy black condensed letters.
That placard is the one loud thing on screen, and it always marks what the commuter must look
for on the street. Everything else is quiet: black, white, and greys.

Style: **flat, bold minimalism.** One strong accent, confident type, generous space, no decoration.

---

## 2. Hard rules (never break)

1. **No gradients.** Every fill is one solid color. This includes `linear-gradient`,
   `radial-gradient`, `conic-gradient`, gradient text, and gradient borders.
2. **No shadows or blur.** No `box-shadow`, `drop-shadow`, `text-shadow`, `backdrop-filter`,
   or Tailwind `shadow-*` / `blur-*` / `backdrop-blur-*`. **shadcn components ship with
   `shadow-xs`/`shadow-sm`/`shadow-lg` classes: delete them when you add a component**
   (see section 7). Separate things with 1px lines and surface color.
3. **One loud color.** Signboard yellow `#FFD23F` is only ever a *fill behind black text*
   (placards, the logo, a selected toggle). Never use it as a text color, a border color,
   or a large background.
4. **No glassmorphism, neumorphism, 3D, or skeuomorphism.**
5. **No emoji** in the UI or in B.AI's answers. Icons are `lucide-react` (ships with shadcn).
6. **No AI-slop tropes:** no left-border accent cards, no purple-blue "AI" palettes, no
   sparkle icons, no stock illustrations, no Inter / Roboto / Arial / Poppins / Geist.
7. **Color is never the only signal.** Every mode badge has a text label; walking is the only
   dashed line; yes/no verdicts have an icon *and* a word.
8. **Touch targets are at least 44×44px.** shadcn's default button (`h-9`, 36px) is too small:
   use the sizes in section 7.
9. **No bouncy or decorative animation** (see section 10).

---

## 3. Color tokens (Tailwind v4 + shadcn)

All colors live in `app/globals.css`. shadcn components read the shadcn variable names
(`--background`, `--primary`, …), so we **map those onto the brand tokens** instead of using
shadcn's default theme. Don't introduce new colors without updating this file.

| Token | Value | Use |
|---|---|---|
| `--ink` | `#111613` | text, primary buttons, user bubbles, strong borders |
| `--paper` | `#FFFFFF` | page background |
| `--surface` | `#F1F3F2` | info panels, fallback banner, hover fill |
| `--line` | `#D5DAD7` | 1px dividers and card borders |
| `--line-soft` | `#E3E6E4` | dividers between steps |
| `--text-2` | `#3D4440` | secondary body text |
| `--text-muted` | `#5B625E` | captions, meta, placeholders (4.5:1 on white) |
| `--signboard` | `#FFD23F` | placard fill only |
| `--paalala` / `--paalala-line` | `#FFF4C2` / `#E5CF6B` | disclaimer |
| `--focus` | `#2453D6` | focus ring |
| `--error` | `#B42318` | form/network errors only |
| `--mode-train` / `-bus` / `-jeep` / `-uv` / `-walk` | `#2453D6` / `#C2410C` / `#0B7A55` / `#7B3FC4` / `#6B716E` | map lines + badges (walk always dashed) |
| `--map-ground` / `--map-water` | `#EEF1EF` / `#C9D8E2` | map |

shadcn variables point at these: `--background: var(--paper)`, `--foreground: var(--ink)`,
`--primary: var(--ink)`, `--primary-foreground: var(--paper)`, `--secondary`/`--muted`/`--accent: var(--surface)`,
`--muted-foreground: var(--text-muted)`, `--destructive: var(--error)`, `--border: var(--line)`,
`--input: var(--ink)` (inputs get a strong ink border), `--ring: var(--focus)`, `--radius: 0.625rem`.
`@theme inline` exposes them as classes (`bg-ink`, `text-muted-foreground`, `border-line`, `bg-mode-jeep`)
plus radii (`--radius-placard: 4px`, `--radius-sm: 8px`, `--radius-md: 10px`, `--radius-lg: 14px`)
and fonts (`--font-sans: var(--font-archivo)`, `--font-mono: var(--font-plex-mono)`).
The full block is in `app/globals.css`.

**Don't use Tailwind's default palette** (`bg-blue-500`, `text-gray-600`, `bg-zinc-*`, etc.).

**Light mode only for v1.** When shadcn's CLI adds a `.dark { … }` block, delete it, and don't
add `dark:` classes.

---

## 4. Typography

| Role | Font | Settings | Size |
|---|---|---|---|
| Display / headlines | Archivo | `font-display` (800, 75% width), tracking −0.5px, leading ~1 | 44px (welcome), 18–20px (section) |
| Signboards + logo | Archivo | `font-display`, UPPERCASE, tracking 0.5px | 18–20px in chat |
| Body | Archivo | 400; bold 700 for stop names | 15–17px, leading 1.45 |
| Numbers / meta | IBM Plex Mono | 500–600 | 12–13px |
| Small labels | IBM Plex Mono | 600, UPPERCASE, tracking 0.8px | 12px |

Loaded with `next/font/google` in `app/layout.tsx` (self-hosted at build time):
`Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-archivo" })` and
`IBM_Plex_Mono({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-plex-mono" })`.
`globals.css` defines `@utility font-display { font-family: var(--font-archivo); font-weight: 800; font-stretch: 75%; }`.

Use mono (`font-mono`) **only** for times, distances, counts and small labels
(`~35 min · 1 transfer · 300 m`).

---

## 5. Shape and spacing

- **Radii:** 4px placards and logo · 5px mode badges · 8px chips and toggles ·
  10px inputs, buttons, disclaimer · 12px verdict cards · 14px map card and panels ·
  full verdict pills · user bubble `16px 16px 4px 16px`.
- **Borders:** 1px `border-line` for cards and dividers; 1.5px `border-ink` for inputs, chips,
  secondary buttons, the chosen verdict card; 2px `border-ink` on placards.
- **Spacing:** 4px base. Page side gutter **16px** (`px-4`). Gaps between chat blocks 20px
  (`gap-5`); inside a block 8–14px.
- **Width:** mobile-first, designed at 360–390px. On wider screens, keep the chat column
  centered at **max 640px** (`max-w-[640px] mx-auto`). Don't stretch content across a desktop.

---

## 6. Components (what the screens are made of)

| Piece | Build it from | Notes |
|---|---|---|
| Logo | own `<Logo>` | placard style, see below |
| Signboard placard | own `<Signboard>` | the signature element |
| Mode badge | shadcn `Badge` + `mode` variants | |
| Buttons, chips | shadcn `Button` | restyled, section 7 |
| Message input | shadcn `Input` + `Label` (`sr-only`) + `Button` | |
| Preferences | native checkbox inside a `<label>` (or shadcn `Toggle`/`Checkbox`) | |
| Verdict pill | shadcn `Badge` + `yes`/`no` variants | |
| Map card | plain `<figure>` (not shadcn `Card`) | |
| Full-screen map | shadcn `Dialog` (full-screen classes) | |
| Ambiguous place picker | a list of `Button`s | |
| Disclaimer | own `<Disclaimer>` (`role="note"`) | not shadcn `Alert` |
| Loading | a plain "…" (three dots) | |

Don't add shadcn components we don't need (no `Card`, `Avatar`, `Sonner`, `Tooltip`, `Carousel`
unless a screen in the mockup actually needs them).

### Logo
"B.AI" in a placard: `bg-signboard text-ink border-2 border-ink rounded-[4px] font-display
uppercase`, 20px in the header. Next to it, two small lines in `text-muted-foreground`:
"Commute buddy / Metro Manila".

### Signboard placard
For every jeep / bus / UV signboard name the router returns:
`bg-signboard text-ink border-2 border-ink rounded-[4px] px-2.5 py-1.5 font-display uppercase tracking-[0.5px] text-[20px] leading-none`.
Train lines are **not** placards. Write them as bold text ("**LRT-1**") with a mode badge.

### Mode badge
Solid tag at the start of each leg: `LRT-1`/`LRT-2`/`MRT-3`, `BUS`, `JEEP`, `UV`, `LAKAD`.
Height 26px, `px-[7px]`, `rounded-[5px]`, 11px bold, tracking 0.6px, white text on the mode
color. `LAKAD` is the exception: white fill, `text-text-2`, 1.5px **dashed** `border-mode-walk`.

### Header
56px tall, 1px bottom `border-line`. Logo left, "Limitations" text link right (to `/limitations`).

### Message input (bottom bar)
Row of: location `Button` (48×48, outline, `LocateFixed` icon, `aria-label="Use my location"`)
· `Input` (48px tall, 1.5px ink border, radius 10, 15px text) · send `Button` (48×48, ink fill,
`ArrowRight` icon, `aria-label="Send"`). Under it, 12px muted: **"Don't type personal information."**
The input has a `Label` with `className="sr-only"`.

### User message
Right-aligned bubble, max-width 82%, `bg-ink text-paper`, 15px, radius `16px 16px 4px 16px`.

### B.AI answer
**No bubble.** Left-aligned content with a mini logo placard + mono meta ("Option 1 of 3").
Order inside a route answer:
1. One-line lead: "Ito ang pinakamadali: mga **35 min**, isang transfer." (written by Gemini, or the template)
2. Steps (`<ol>`): each step is a 2-column grid (`grid-cols-[52px_1fr]`: badge + text),
   separated by 1px `border-line-soft`. "Sakay ng…", "Baba sa **…**", plus a mono meta line.
3. Total row: 1.5px ink top border, "Kabuuan" left, mono summary right.
4. Map card.
5. Disclaimer.
6. "Iba pang paraan": other options as full-width outline buttons (min-height 56, badges +
   short label left, mono time right).

### Check-routes verdict card
One card per candidate: mode badge + placard + verdict pill on the right, then one sentence.
- **OO:** pill `bg-ink text-paper`, `Check` icon. Card border 1.5px ink.
- **HINDI:** pill white with 1.5px ink border, `X` icon. Card border 1px `border-line`, body `text-text-2`.
After the cards, one conclusion line ("Kaya: sumakay ka ng bus na **SM Fairview**."), then map and disclaimer.

### Map card
`<figure>`, 1px `border-line`, `rounded-[14px]`, `overflow-hidden`.
- Top bar: legend (short colored line + label for each mode used) and an expand `Button`
  (44×44, ghost, `Maximize2` icon, `aria-label="Expand map"`) that opens the full-screen `Dialog`.
- Map: Leaflet with OSM tiles. Route lines 5px solid in mode colors, round caps; walk legs 3px
  dashed `--mode-walk` (`dashArray: "4 4"`). Origin = white circle with 3px ink ring and "A";
  destination = solid ink circle with white "B"; board/alight points = small white circles
  ringed in the leg's color. Keep "© OpenStreetMap contributors" visible.
- Restyle Leaflet's default controls: no shadows, 1px `--line` borders, radius 8.
- Height ~230px in chat.
- Read colors in JS from the CSS variables (`getComputedStyle(document.documentElement)`);
  never hard-code a second copy of the hex values.

### Disclaimer (under every route answer)
`role="note"`, `bg-paalala border border-paalala-line rounded-[10px] p-3`, `Info` icon + 13px text.
Exact text:
> Paalala: Maaaring luma na ang ilang ruta sa data namin. Laging magtanong sa driver o barker bago sumakay.

### Info panel / banners
`bg-surface`, radius 10–14, no border. Used for the "Ruta lang ang alam ko" limits note
and the "Pahinga muna ang chat" fallback banner.

### Footer credit
11–12px muted: "Data provided by DOTC (now DOTr). Not affiliated with or endorsed by DOTr. · Map © OpenStreetMap contributors"

---

## 7. shadcn/ui rules

**Setup:** `new-york` style, CSS variables on, Tailwind v4 (`components.json`). Components go in
`components/ui/`. **We own the code and are expected to edit it** in `components/ui/`, not fight
it with overrides everywhere.

**Every time you add a shadcn component:**
1. Delete every `shadow-*` class from it.
2. Delete every `dark:` class from it.
3. Remove its focus classes (`focus-visible:ring-*`, `outline-none`): the global `:focus-visible`
   rule in `globals.css` draws the ring (section 11).
4. Bump sizes to 44px+ (below).
5. Use `transition-[color,background-color,border-color]`, not `transition-colors` (that also
   animates the outline, so the focus ring fades in from black).
6. Check it against the mockup.

**Button** (`components/ui/button.tsx`), only these variants and sizes:

| Variant | Classes |
|---|---|
| `default` | `bg-ink text-paper hover:bg-[#2A302D]` |
| `outline` | `bg-paper text-ink border-[1.5px] border-ink hover:bg-surface` |
| `ghost` | `bg-transparent text-ink hover:bg-surface` |
| `chip` | `bg-paper text-ink border-[1.5px] border-ink rounded-sm font-semibold hover:bg-surface` |
| `link` | `text-ink underline underline-offset-3 font-semibold` |

| Size | Classes |
|---|---|
| `default` | `h-12 px-5 text-[15px] font-bold rounded-md` |
| `lg` | `h-[52px] px-6 text-base font-bold` |
| `chip` | `min-h-11 px-3.5 py-2.5 text-[15px]` |
| `icon` | `size-12 rounded-md` |
| `icon-sm` | `size-11` |

**Badge** (`components/ui/badge.tsx`) variants: `train`, `bus`, `jeep`, `uv` (`bg-mode-* text-paper`),
`walk` (dashed), `yes` (`bg-ink text-paper rounded-full`), `no` (`bg-paper border-[1.5px] border-ink rounded-full`).

**Input:** `h-12 border-[1.5px] border-input rounded-md px-3.5 text-[15px] placeholder:text-muted-foreground bg-paper`.

**Dialog (full-screen map):** `DialogContent` with `max-w-none w-screen h-dvh rounded-none
border-0 p-0`. Overlay is solid `bg-ink/60` with **no blur**. Visible close button
(44×44) and a `DialogTitle`.

**Preferences:** off = 1px `border-line`; on = `bg-signboard border-[1.5px] border-ink text-ink`.

---

## 8. Icons

`lucide-react` only. Stroke width 2 (2.5–3 for small check/X), 20–22px in buttons. The set we use:
`LocateFixed`, `ArrowRight`, `Maximize2`, `X`, `Info`, `Check`.
Icon-only buttons need `aria-label`; decorative icons get `aria-hidden="true"`.

---

## 9. Screens

1. **Welcome:** header · headline "Saan ka galing? Saan ka papunta?" (44px `font-display`) ·
   one-sentence intro · "SUBUKAN" label + chips · limits panel pinned low · input bar + footer.
2. **Trip answer:** see "B.AI answer" in section 6.
3. **Check routes:** verdict cards → conclusion → map → disclaimer (or, if all are "no", the alternative trip).
4. **No-AI fallback:** surface banner · From input (+ location button) · To input · "Gusto ko"
   toggles in a 2-column grid · `lg` primary "Hanapin ang ruta" · the same trip answer view.

Plus `/limitations`: the known limitations from `CLAUDE.md`, linked from the header and welcome panel.

---

## 10. Animation (Motion)

Library: **Motion for React** (`motion` package). shadcn's own enter/exit animations (Dialog)
come from `tw-animate-css`.

**Keep the bundle small:** `app/providers.tsx` wraps the app in
`<LazyMotion features={domAnimation} strict><MotionConfig reducedMotion="user">`.
Use the slim components: `import * as m from "motion/react-m"` → `<m.div>`.
Never import `motion` from `motion/react` (`strict` throws). `domAnimation` only. Client components only.

**Allowed animations (the complete list), presets in `lib/motion.ts`:**

| Where | Animation |
|---|---|
| New chat message (user or B.AI) | `fadeUp`: opacity 0→1, y 8→0, 160ms, `easeOut` |
| Route steps appearing | same fade-up, stagger 40ms per step, max 6 steps |
| Map card appearing | fade only, 200ms, after the steps |
| "B.AI is thinking" | three dots fading opacity 0.3 ↔ 1, 900ms loop |
| Hover on buttons | CSS color transitions, 150ms (not Motion) |

**Not allowed:** spring bounce, scale-up / "pop" effects, slide-ins from the side, parallax,
scroll-triggered reveals, animated gradients or glows, rotating loaders, shaking errors,
layout animations, and animating anything on the map besides fade.

**Reduced motion:** `MotionConfig reducedMotion="user"` handles Motion; `globals.css` zeroes CSS
transitions and animations under `prefers-reduced-motion: reduce`.

---

## 11. Accessibility

- Real `<button>`, `<a href>`, `<input>` + `<label>`. Never `onClick` on a `div`.
- `aria-label` on every icon-only button.
- Focus ring: `:focus-visible { outline: 3px solid var(--focus); outline-offset: 2px }` in
  `globals.css`, for everything. Never remove outlines.
- Text contrast at least 4.5:1. Nothing lighter than `--text-muted` for text.
- `lang="fil"` on `<html>` (answers are Taglish).
- New B.AI answers are announced: the message list is `aria-live="polite"`.
- The step list is the accessible version of the map, so never put route info only on the map.

---

## 12. Writing style on screen

- Casual Taglish by default; match the user's language (the API returns `lang`).
- Short sentences. "Sakay ng…", "Baba sa…", "Lakad papuntang…".
- Signboard names go in placards in the UI; stop names in **bold**.
- Times are approximate: "~35 min" / "mga 35 min".

---

## 13. Definition of done (UI changes)

- [ ] No gradient, shadow, blur, or glass anywhere (search the diff for `gradient`, `shadow`, `blur`, `backdrop`).
- [ ] No `dark:` classes and no `.dark` block.
- [ ] Only colors from section 3; no Tailwind default palette classes (`gray-`, `zinc-`, `slate-`, `blue-`…).
- [ ] Yellow appears only as a fill behind black text.
- [ ] Fonts are Archivo and IBM Plex Mono only.
- [ ] Any new shadcn component went through the steps in section 7.
- [ ] Motion: only `m.*` components, only animations from section 10, reduced motion respected.
- [ ] Looks right at 360px wide with no horizontal scroll.
- [ ] Every interactive element is at least 44px and keyboard-focusable with a visible ring.
- [ ] Every route answer has steps, a map card, and the exact disclaimer.
- [ ] OSM attribution and the DOTC credit are visible.
- [ ] No emoji.
- [ ] Learning log entry written (see `LEARNING_LOG_PROTOCOL.md`).

---

## 14. Where things are (Phase 5)

| Rule | Code |
|---|---|
| Tokens, fonts utility, focus ring, Leaflet restyle | `app/globals.css` |
| Fonts, `lang="fil"`, Providers | `app/layout.tsx`, `app/providers.tsx` |
| shadcn pieces | `components/ui/{button,badge,input,label,dialog}.tsx` |
| Logo, Signboard, ModeBadge, Disclaimer, Header, FooterCredit | `components/*.tsx` |
| Welcome / input bar / chat state | `components/Welcome.tsx`, `InputBar.tsx`, `Chat.tsx` |
| Answers | `components/Messages.tsx` (per `kind`), `RoutePlan.tsx`, `RouteSteps.tsx`, `CheckAnswer.tsx`, `FallbackForm.tsx` |
| Map | `components/MapCard.tsx` (legend, dialog), `RouteMap.tsx` (Leaflet, client-only) |
| Labels and meta text | `lib/ui/route-view.ts` (pure, tested in `tests/ui-helpers.test.ts`) |
| Animation presets | `lib/motion.ts` |
