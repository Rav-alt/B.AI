# Project status block and shared docs in the repo

**Date:** 2026-10-04 23:45
**Prompt I was given:** "update the context or instruction for the phases or if it doesn't create one so the whole project knows where we left off"
**Files touched:** `PLAN.md`, `CLAUDE.md`, `LEARNING_LOG_PROTOCOL.md`, `DESIGN.md` (copied into the repo)

## What changed
`PLAN.md` now opens with a **"Current status"** block: the current phase, what's done, open items,
key facts from Phase 0, and the next steps. `CLAUDE.md` starts with a "Start here" list that sends
every agent to that block first. The repo now has real copies of `PLAN.md`, `CLAUDE.md`, `DESIGN.md`
and `LEARNING_LOG_PROTOCOL.md`, so an agent working on your PC sees the same rules as one in claude.ai.

## How it was done
1. Added the status block to the top of `PLAN.md`, marked Phase 0 and its sub-steps ✅, and marked Phase 1 as next.
2. Added "Start here" to `CLAUDE.md`, plus small facts that changed in Phase 0 (Next 16.3, model ID,
   keys only in `.env.local`, new scripts and docs in the folder tree).
3. Added step 5 to `LEARNING_LOG_PROTOCOL.md`: update the status block after each task.
4. Fixed two wrong section numbers: DESIGN.md's definition of done is §12 (not §13), and Motion is §9 (not §10).
5. In the repo's `CLAUDE.md`, appended `@AGENTS.md` so Claude Code still loads the Next.js 16 notes.
6. Saved the same files to the B.AI project and to `C:\Projects\B.AI`.

### Key code
The line that keeps the Next.js notes loading in Claude Code:

```md
@AGENTS.md
```

In a `CLAUDE.md`, `@file` means "also read this file". The Next.js tooling wrote that rule into `AGENTS.md`.

## Why it was done this way
- **Reason for the approach:** one status block at the top of the plan is the first place any agent
  looks, and it changes in only one spot.
- **Alternatives considered:** a separate `STATUS.md`. Not chosen, because it's one more file to keep in sync with the plan.
- **Trade-offs:** the docs now live in two places (claude.ai project and the repo). They must be
  updated together, or one copy goes stale.

## Concepts to learn from this
- **Single source of truth** — keep each fact in one place so copies can't disagree.
- **Agent memory files** — `CLAUDE.md` and `AGENTS.md` are read automatically at the start of a session. That's how a fresh agent "remembers" the project.

## How to undo or tweak it
Edit the "Current status" block at the top of `PLAN.md`. Remove the "Start here" section from `CLAUDE.md` to drop the pointer.

## Checks performed
- [x] The PC's `CLAUDE.md` was the 11-byte stub before it was replaced (nothing lost)
- [x] Section references now match `DESIGN.md`
