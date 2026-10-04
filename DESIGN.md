# B.AI — Design Rules

> **For every agent working on UI:** read this file before you touch anything a visitor sees
> (components, styles, layout, copy formatting, the map). Follow it exactly. If a request
> conflicts with these rules, say so and ask before breaking one.
>
> Reference mockup: the "B.AI Design Mockup" canvas (screens 1–4 + Style tile).

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
   or Tailwind `shadow-*` / `blur-*`. Separate things with 1px lines and surface color.
3. **One loud color.** Signboard yellow `#FFD23F` is only ever a *fill behind black text*
   (placards, the logo, a selected toggle). Never use it as a text color, a border color,
   or a large background.
4. **No glassmorphism, neumorphism, 3D, or skeuomorphism.**
5. **No emoji** in the UI or in B.AI's answers. Icons are inline stroke SVGs.
6. **No AI-slop tropes:** no left-border accent cards, no purple-blue "AI" palettes, no
   sparkle icons, no stock illustrations, no Inter / Roboto / Arial / Poppins.
7. **Color is never the only signal.** Every mode badge has a text label; walking is the only
   dashed line; yes/no verdicts have an icon *and* a word.
8. **Touch targets are at least 44×44px.**

---

## 3. Color tokens

Define these once as CSS variables (in `app/globals.css`) and use only these.
Don't introduce new colors without updating this file.

```css
:root {
  /* Base */
  --ink: #111613;        /* text, primary buttons, user bubbles, strong borders */
  --paper: #FFFFFF;      /* page background */
  --surface: #F1F3F2;    /* info panels, fallback banner */
  --line: #D5DAD7;       /* 1px dividers and card borders */
  --line-soft: #E3E6E4;  /* dividers between steps */
  --text-2: #3D4440;     /* secondary body text */
  --muted: #5B625E;      /* captions, meta, placeholders (passes 4.5:1 on white) */

  /* Accent */
  --signboard: #FFD23F;  /* placard fill only */
  --paalala: #FFF4C2;    /* disclaimer background */
  --paalala-line: #E5CF6B;
  --focus: #2453D6;      /* focus ring */

  /* Modes (map lines + badges; white text on all passes 4.5:1) */
  --mode-train: #2453D6;
  --mode-bus: #C2410C;
  --mode-jeep: #0B7A55;
  --mode-uv: #7B3FC4;
  --mode-walk: #6B716E;  /* always dashed */

  /* Map */
  --map-ground: #EEF1EF;
  --map-water: #C9D8E2;
}
```

If using Tailwind, map these into the theme (e.g. `colors.ink = 'var(--ink)'`) and use the
named classes (`bg-ink`, `text-muted`, `border-line`). **Don't use Tailwind's default palette**
(`bg-blue-500`, `text-gray-600`, etc.).

Light mode only for v1. Don't add dark mode unless asked.

---

## 4. Typography

| Role | Font | Settings | Size |
|---|---|---|---|
| Display / headlines | Archivo | weight 800, `font-stretch: 75%`, letter-spacing −0.5px, line-height ~1 | 44px (welcome), 18–20px (section) |
| Signboards + logo | Archivo | weight 800, `font-stretch: 75%`, UPPERCASE, letter-spacing 0.5px | 18–20px in chat |
| Body | Archivo | weight 400, bold 700 for signboard/stop names | 15–17px, line-height 1.45 |
| Numbers / meta | IBM Plex Mono | weight 500–600 | 12–13px |
| Small labels | IBM Plex Mono | 600, UPPERCASE, letter-spacing 0.8px | 12px |

Load with `next/font/google` (self-hosted, no extra requests):

```ts
import { Archivo, IBM_Plex_Mono } from "next/font/google";
export const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-sans" });
export const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-mono" });
```

Use mono **only** for times, distances, counts and small labels (`~35 min · 1 transfer · 300 m`).

---

## 5. Shape and spacing

- **Radii:** 4px placards and logo · 5px mode badges · 8px chips and toggles ·
  10px inputs, buttons, disclaimer · 12px verdict cards · 14px map card and info panels ·
  999px verdict pills · user bubble `16px 16px 4px 16px`.
- **Borders:** 1px `--line` for cards and dividers; 1.5px `--ink` for inputs, chips,
  secondary buttons, the chosen verdict card; 2px `--ink` on placards.
- **Spacing:** 4px base. Page side gutter **16px**. Gaps between chat blocks 20px; inside
  a block 8–14px.
- **Width:** mobile-first, designed at 360–390px. On wider screens, keep the chat column
  centered at **max 640px**. Don't stretch content across a desktop.

---

## 6. Components

### Logo
"B.AI" in a placard: `--signboard` fill, `--ink` text, 2px ink border, radius 4, Archivo 800
condensed. Next to it, two small lines in `--muted`: "Commute buddy / Metro Manila".

### Signboard placard (the signature element)
For every jeep / bus / UV signboard name the router returns:
```
bg: --signboard · text: --ink · border: 2px --ink · radius: 4px
padding: 6px 10px · Archivo 800 · font-stretch 75% · uppercase · 18–20px · line-height 1
```
Train lines are **not** placards. Write them as bold text ("**LRT-1**") with a mode badge.

### Mode badge
Small solid tag at the start of each leg: `TREN`/`LRT-1`/`MRT-3`, `BUS`, `JEEP`, `UV`, `LAKAD`.
Height 26px, padding 0 7px, radius 5px, 11px bold, letter-spacing 0.6px, white text on the
mode color. `LAKAD` is the exception: white fill, `--text-2` text, 1.5px **dashed** `--mode-walk` border.

### Header
56px tall, 1px bottom `--line`. Logo left, "Limitations" text link right.

### Message input (bottom bar)
Row of: location button (48×48, 1.5px ink border, crosshair icon, `aria-label="Use my location"`)
· text input (48px tall, 1.5px ink border, radius 10) · send button (48×48, `--ink` fill,
white arrow icon, `aria-label="Send"`). Under it, 12px `--muted`: **"Don't type personal information."**
The input needs a real `<label>` (visually hidden is fine).

### User message
Right-aligned bubble, max-width 82%, `--ink` fill, white 15px text, radius `16 16 4 16`.

### B.AI answer
**No bubble.** Left-aligned content with a mini logo placard + mono meta ("Option 1 of 3").
Order inside a route answer:
1. One-line lead: "Ito ang pinakamadali: mga **35 min**, isang transfer."
2. Steps list (`<ol>`): each step is a 2-column grid (52px badge column + text), separated by
   1px `--line-soft`. Text uses "Sakay ng…" and "Baba sa **…**", plus a mono meta line.
3. Total row: 1.5px ink top border, "Kabuuan" left, mono summary right.
4. Map card.
5. Disclaimer.
6. "Iba pang paraan": other options as full-width buttons (56px min height, 1px border,
   badges + short label left, mono time right).

### Check-routes verdict card
One card per candidate: mode badge + placard + verdict pill on the right, then one sentence.
- **OO:** pill with `--ink` fill, white text, check icon. Card border 1.5px `--ink`.
- **HINDI:** pill with white fill, 1.5px ink border, ✕ icon. Card border 1px `--line`, body text `--text-2`.
After the cards, one conclusion line ("Kaya: sumakay ka ng bus na **SM Fairview**."), then map and disclaimer.

### Map card
`<figure>`, 1px `--line` border, radius 14, overflow hidden.
- Top bar: legend (short colored line + label for each mode used) and an expand button (44×44, `aria-label="Expand map"`).
- Map: Leaflet with OSM tiles. Route lines 5px solid in mode colors, round caps; walk legs 3px
  dashed `--mode-walk` (`dashArray: "4 4"`). Origin = white circle with 3px ink ring and "A";
  destination = solid ink circle with white "B"; board/alight points = small white circles
  ringed in the leg's color. Keep the Leaflet attribution "© OpenStreetMap contributors" visible.
- Restyle Leaflet's default controls to match: no shadows, 1px `--line` borders, radius 8.
- Height ~230px in chat; tap expand for full screen.

### Disclaimer (under every route answer)
`role="note"`, `--paalala` fill, 1px `--paalala-line` border, radius 10, padding 12,
info icon + 13px text. Exact text:
> Paalala: Maaaring luma na ang ilang ruta sa data namin. Laging magtanong sa driver o barker bago sumakay.

### Starter chips
`<button>`, min-height 44, padding 10px 14px, 1.5px ink border, radius 8, white fill, 15px/600.

### Buttons
- Primary: `--ink` fill, white 15–16px bold, radius 10, height 48–52.
- Secondary: white fill, 1.5px ink border, ink text.
- Hover: primary goes to `#2A302D`; secondary gets `--surface` fill. No scale or lift effects.

### Toggles (preferences)
Checkbox inside a label, min-height 44, radius 8. Off: 1px `--line` border. On: `--signboard`
fill + 1.5px ink border (one of the few allowed yellow fills).

### Info panel / banners
`--surface` fill, radius 10–14, no border. Used for the "Ruta lang ang alam ko" limits note
and the "Pahinga muna ang chat" fallback banner.

### Footer credit
11–12px `--muted`: "Data provided by DOTC (now DOTr). Not affiliated with or endorsed by DOTr. · Map © OpenStreetMap contributors"

---

## 7. Screens

1. **Welcome:** header · headline "Saan ka galing? Saan ka papunta?" (44px display) · one
   sentence intro · "SUBUKAN" label + starter chips · limits panel pinned low · input bar + footer.
2. **Trip answer:** see "B.AI answer" above.
3. **Check routes:** verdict cards → conclusion → map → disclaimer.
4. **No-AI fallback:** surface banner · From input (+ location button) · To input · "Gusto ko"
   toggles in a 2-column grid · primary "Hanapin ang ruta" · plain numbered result · map · disclaimer.

---

## 8. Icons

Inline SVG, `fill="none"`, `stroke="currentColor"`, stroke-width 2 (2.2–3 for small check/✕),
round caps. 20–22px in buttons. Needed set: crosshair (location), arrow (send),
corners (expand), circle-i (info), check, ✕. Don't add an icon library for six icons.

---

## 9. Motion

Minimal. Allowed: 120–160ms color/background transitions on hover and focus, and a simple
fade-in for new messages. Respect `prefers-reduced-motion` (turn everything off).
No bouncing, sliding, parallax, or typing-dot theatrics beyond a plain "…" loading state.

---

## 10. Accessibility

- Real `<button>`, `<a href>`, `<input>` + `<label>`. Never `onClick` on a `div`.
- `aria-label` on every icon-only button.
- Focus ring: `outline: 3px solid var(--focus); outline-offset: 2px` on `:focus-visible`. Never remove outlines.
- Text contrast at least 4.5:1. Don't use anything lighter than `--muted` for text.
- `lang="fil"` on the document (answers are Taglish).
- Map has a text equivalent: the step list *is* the accessible version, so never put route info only on the map.

---

## 11. Writing style on screen

- Casual Taglish by default; match the user's language.
- Short sentences. "Sakay ng…", "Baba sa…", "Lakad papuntang…".
- Signboard names go in placards in the UI; stop names in **bold**.
- Times are approximate: always "~35 min" / "mga 35 min".

---

## 12. Definition of done (UI changes)

Before you say a UI task is finished, check:

- [ ] No gradient, shadow, blur, or glass anywhere (search the diff for `gradient`, `shadow`, `blur`, `backdrop`).
- [ ] Only colors from section 3 are used; no Tailwind default palette classes.
- [ ] Yellow appears only as a fill behind black text.
- [ ] Fonts are Archivo and IBM Plex Mono only.
- [ ] Looks right at 360px wide with no horizontal scroll.
- [ ] Every interactive element is at least 44px and keyboard-focusable with a visible ring.
- [ ] Every route answer has steps, a map card, and the exact disclaimer.
- [ ] OSM attribution and the DOTC credit are visible.
- [ ] No emoji.
- [ ] Learning log entry written (see `LEARNING_LOG_PROTOCOL.md`).
