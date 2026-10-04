# Gemini free-tier test call recorded

**Date:** 2026-10-04 23:35
**Prompt I was given:** pasted output of `npm run test:gemini` from the owner's PC
**Files touched:** `docs/data-notes.md`

## What changed
The "Gemini free tier" section of `docs/data-notes.md` now records a successful real call to
`gemini-3.8-flash` (3.6 s, 518 tokens) and a new finding: 490 of those tokens were hidden "thinking".

## How it was done
1. Checked that the copy of `data-notes.md` on the PC hadn't been edited, so nothing would be overwritten.
2. Added the test result and a "thinking is on by default" note under "Gemini free tier".
3. Copied the file back to `C:\Projects\B.AI` and to the B.AI project.

### Key code
The token report from the call:

```json
{"promptTokenCount":14,"candidatesTokenCount":14,"thoughtsTokenCount":490,"totalTokenCount":518}
```

`thoughtsTokenCount` is reasoning the model does before answering. You pay for it in quota and wait time, but you never see it.

## Why it was done this way
- **Reason for the approach:** this number changes the Phase 4 design (turn thinking down), so it belongs in the notes now, not rediscovered later.
- **Alternatives considered:** switching to a Flash-Lite model now. Not done yet, because turning thinking down on the same model may be enough.
- **Trade-offs:** none yet. This only changes documentation.

## Concepts to learn from this
- **Thinking tokens** — newer models "think" before replying. That helps with hard problems, but it is wasted on simple tasks like pulling JSON out of a sentence.
- **TPM quota** — tokens-per-minute limits count thinking tokens too, so hidden thinking eats into your free tier.

## How to undo or tweak it
Edit the "Gemini free tier" section of `docs/data-notes.md`.

## Checks performed
- [x] The PC copy matched the cloud copy before overwriting
- [x] The file was written to both the PC folder and the project

## What's not finished
- The free-tier RPM / TPM / RPD numbers from https://aistudio.google.com/rate-limit still need to go into the table.
