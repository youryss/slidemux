---
name: slidemux-tutorial
description: >-
  Plan and author polished how-to tutorials as studio decks. Use when the user
  asks to create a tutorial showing how to do something.
---

# SlideMux tutorial authoring

Read this when the user asks to **create a tutorial** — e.g. "Create a tutorial
showing how to create a customer case." This skill guides **authored slides**
built with topic-deck MCP tools, not Playwright recording.

After the brief is known, read **slidemux-design**
(`skill://slidemux/slidemux-design/SKILL.md`) for recipe choice and layout.
Then read **slidemux-workflow**
(`skill://slidemux/slidemux-workflow/SKILL.md`) for the interactive
plan → draft → review → steer → approve → generate loop.

For **filmed app tours** (live product UI in clips), read **slidemux-video**
instead and follow record → upload → narrate → generate.

## 1. Establish the brief

Ask only for missing decisions:

- Target: YouTube/course/demo or Shorts/Reels/TikTok
- Format: `landscape` (16:9) or `portrait` (9:16)
- Audience, desired outcome, language, duration, and final CTA
- Brand assets or an existing visual reference

Default to 16:9 for product tutorials and 9:16 for social media. If the user
said "social," "Shorts," or "product tour" and skipped the rest, default
portrait 9:16, 6–8 beats, and one CTA URL — then ask only for what is still
missing.

## 2. Plan the story

Use 6–8 beats unless the requested duration needs fewer:

1. Hook: the outcome or tension
2. Context: why it matters
3. Mechanism: the key idea
4. Demonstration: the product proves the claim
5. Result: what changed
6. CTA: one clear next step

Each slide teaches one point. Prefer one short headline and visual evidence over
paragraphs or bullet walls.

The workflow skill shows this plan to the user before building (or in the same
turn as the first draft when the brief is complete).

## 3. Compose the source

Choose the simplest fitting **recipe** (see **slidemux-design** §3 for the
full set — these ids go straight into the `recipe` field):

- `title`: kicker, headline, optional supporting line
- `agenda` / `steps`: what the viewer will do, as numbered rows or cards
- `screenshot`: one step over a big framed screenshot, kicker "Step N"
- `split`: explanation beside framed product evidence
- `comparison`: before/after; `choice`: two to four options
- `checklist`: prerequisites or recap
- `close`: outcome recap and one next action

Pick one deck `theme` when you create the deck (`studio` for product and SaaS,
`terminal` for developer tools) so every slide shares one composition.
`theme` is required. A named look with no hexes snaps to the closest theme;
say that id in the plan. For a product site, also pass `brand` (accent, ink,
ground, and the logo URL) so the deck uses that product's colors. The server
paints the logo; do not add an image box for it. Keep step kickers
consistent ("Step 1", "Step 2", …).

**Screenshots:** a tutorial without pictures reads as a text deck. Ask the
user for screenshots (hosted: public https image URLs; stdio: local files)
before drafting. If they will send them later, draft `screenshot` slides
without `upload` — the server paints a placeholder and `lint_deck` flags it —
then `replace_slide_from_recipe` with the real picture. Do not generate a
tutorial that still shows placeholders.

For 9:16, stack content vertically, keep the primary message in the center safe
area, and leave generous space at the top and bottom for social-platform controls.

Build slides with topic-deck tools: `create_deck_from_plan` on hosted MCP (or
`create_topic_deck` + `append_slide_from_recipe` with inline `narration` on
stdio), and `replace_slide_from_recipe` to fix a slide in place. See **slidemux-topic**
for beat craft (headline ≤8 words, narration <300 chars) and **slidemux-design**
for layout rects, type scale, and the two patching rules (0–1 rects;
landscape-canonical `fontSizePx`; portrait titles 160 not 48).

## 4. Review loop

The **slidemux-workflow** skill owns review, steering, critique, and generate.
Do not call `start_generate` until the user explicitly approves the draft.

When steering, the user speaks in natural language — never require MCP tool names.

## 5. Path B — filmed walkthrough (not a theme)

When the user wants a **live filmed walkthrough** of a running app (not authored
slides), that is Path B: invent a one-off stage, then **slidemux-video** —
record → upload → narrate → generate. Sync: open `slidemux.step()` → play the
entrance → settle → hold to the line. No section pills, owl chrome, or site pills.
Themes stay Maya/deck costume for authored PPTX decks.
