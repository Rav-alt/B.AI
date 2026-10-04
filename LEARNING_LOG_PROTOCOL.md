# Learning Log Protocol

> **For every agent working in this project:** read this file before you start a task,
> and follow the "After you finish" steps before you end your turn.
> The goal is that the human can learn from every change, even when they just
> prompted and didn't watch the work happen.

---

## When this applies

Run this protocol after **any** task that changes the project, for example:

- Changing colors, theme, fonts, spacing, or layout
- Adding, editing, or removing a component or page
- Refactoring, fixing a bug, or changing config or dependencies
- Anything that touched a file

Skip it only for pure questions where no file was changed.

---

## After you finish (required)

1. **Wait until the implementation is done** and you have checked that it works
   (page renders, build passes, nothing visibly broken).
2. **Create a new entry file** in `docs/learning-log/` named:

   ```
   YYYY-MM-DD_HHMM_short-task-name.md
   ```

   Example: `2026-10-03_2340_dark-theme-colors.md`
   (Create the folder if it doesn't exist.)
3. **Fill it in using the template below.** Write for a learner, not for another agent:
   plain language, explain any jargon the first time you use it.
4. **Add one line to the index** at `docs/learning-log/INDEX.md` (newest on top):

   ```
   - 2026-10-03 — [Dark theme colors](2026-10-03_2340_dark-theme-colors.md) — switched the site to a dark palette using CSS variables
   ```
5. **Update the "Current status" block in `PLAN.md`** if the task finished a step, changed what
   comes next, or opened/closed an item.
6. **Tell the human** in your final message that the log entry was written and where.

---

## Entry template

Copy this into the new entry file and replace every placeholder.

```markdown
# <Short title of what changed>

**Date:** YYYY-MM-DD HH:MM
**Prompt I was given:** "<the user's request, quoted or summarized>"
**Files touched:** `path/one.css`, `path/two.tsx`

## What changed
<2–4 sentences. What does the site/app look like or do now, compared to before?
Describe the visible result first, then the code-level change.>

## How it was done
<Step by step, in the order you actually did it.>
1. <Step — which file, what you changed>
2. <Step>
3. <Step>

### Key code
<The single most important snippet (keep it short), with a line or two explaining it.>

```<language>
<snippet>
```

## Why it was done this way
- **Reason for the approach:** <why this method and not another>
- **Alternatives considered:** <what else could have worked, and why it wasn't chosen>
- **Trade-offs:** <anything this makes harder, slower, or riskier>

## Concepts to learn from this
<1–3 concepts the human can study, each with a one-line plain explanation.>
- **<Concept name>** — <what it is and why it mattered here>

## How to undo or tweak it
<Exactly where to go to revert or adjust it, e.g. "change `--color-accent` in `styles/theme.css`".>

## Checks performed
- [ ] <What you verified, e.g. "text contrast still passes in both light and dark mode">
```

---

## Writing rules

- **Explain the why honestly.** If a choice was arbitrary or a guess, say so.
- **Be specific.** Name files, variables, and values. "Updated styles" is not useful;
  "changed `--bg` from `#ffffff` to `#0f1115` in `theme.css`" is.
- **Keep it short.** An entry should be readable in 2–3 minutes.
- **Never skip the log** because a change felt small. Small changes are often the
  easiest ones to learn from.
- **If the task failed or was only partly done**, still write the entry and add a
  `## What's not finished` section.
