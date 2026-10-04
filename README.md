# B.AI — Metro Manila Commute Buddy

A mobile-first chatbot that tells commuters which jeep, bus, or train to ride in Metro Manila.
Personal portfolio project, free tiers only. Status: **Phase 0 (scaffold + data check)**.

## Run it locally

Requires Node.js 22 or newer.

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # vitest
npm run build        # production build
```

## Data

The GTFS feed is not committed. Download it into `data/raw/`:

```bash
git clone --depth 1 https://github.com/sakayph/gtfs.git data/raw
npm run inspect:gtfs # prints counts, modes, sample routes (see docs/data-notes.md)
```

`npm run build:data` (Phase 1) will turn it into `data/generated/network.json`.

## Gemini

Copy `.env.example` to `.env.local`, add your Google AI Studio key, then `npm run test:gemini`.

## Credits

Data provided by DOTC (now DOTr). Not affiliated with or endorsed by DOTr.
Map © OpenStreetMap contributors.
