---
name: slidemux-workflow
description: >-
  Interactive plan → draft → review → steer → approve → generate loop for
  authored studio decks. Read after slidemux-tutorial or slidemux-topic and
  slidemux-design.
---

# SlideMux: authored-slide review loop

Use this skill after **slidemux-tutorial** (how-to tutorials) or **slidemux-topic**
(subject presentations) and **slidemux-design** (one-off stage patterns or authored recipes). It governs
the **interactive loop** — not Playwright recording. For filmed app tours, read
**slidemux-video** instead.

The user steers in natural language. Never ask them to name MCP tools.

## Phases (derived, not stored)

Track phase from the conversation and project — the user never names one:

| Phase | When |
| --- | --- |
| **PLANNING** | Brief incomplete, or user is steering the plan before any project exists |
| **DRAFTING** | Brief known; creating slides and boxes |
| **REVIEWING** | Draft built; waiting for feedback or approval |
| **STEERING** | User asked for changes; applying mutations |
| **APPROVED** | User explicitly approved or asked to generate |
| **GENERATING** | `start_generate` returned a `jobId` |
| **COMPLETE** | Generate finished; `download_video` URLs available |

Responsibilities inside this agent (do not rename the phases above): BRIEF =
parent brief gate; STORY ARCHITECT = PLAN beats; VISUAL DIRECTOR = PLAN recipe
assignment (design skill); SLIDE AUTHOR = DRAFT; DESIGN CRITIC = mandatory
block before REVIEWING; USER REVIEW / APPROVE / GENERATE = unchanged.

## 1. PLAN

Before creating anything, write a **visible** storyboard:

- **Audience** (default: general audience)
- **Theme** — the deck `theme` id you chose and why it fits. If you snapped from colors or a look the user named, say the id and what you matched. Then build the draft in this same turn.
- **Objective** — what the viewer will know or do
- **Slide list** — one beat per slide: headline — `recipe` — purpose. Use the
  recipe ids from **slidemux-design** §3 (`title`, `split`, `steps`, `close`,
  …) — the same ids the tools take. Do not use the same recipe on two slides
  in a row. Mark slides that still need a picture.
- **Narration style** — e.g. conversational guide, technical walkthrough
- **Estimated duration** — sum narration at ~2.3 spoken words/sec

Defaults: general audience, about six to eight slides, unless the user named
audience or slide count.

### First-turn rule

- **Brief complete** → show the plan **and** build the draft in the same turn,
  then run the design critic, then move to REVIEWING.
- **Brief incomplete** → stay in PLANNING; ask only for missing fields.
- **User steers the plan** before any project exists → revise the plan, then draft.

Do not call `create_deck_from_plan` or `create_topic_deck` until the brief gate
in the parent skill passes.

## 2. DRAFT

Build the deck from the plan:

- **Hosted HTTP MCP:** one `create_deck_from_plan { title, orientation, theme,
  slides }` call. Each slide carries its `recipe`, copy, `narration`, and
  optional `upload`. It returns `projectId`, `editorUrl`, per-slide `warnings`
  or `error`, and the deck lint.
- **stdio MCP:** `create_topic_deck { title, orientation, theme }`, then one
  `append_slide_from_recipe` per beat with `narration` inline.
- Never compose slides from raw `add_text_box` calls.
- Fix every `warnings` entry and failed slide before review:
  `replace_slide_from_recipe` with the same `slideId` (or
  `append_slide_from_recipe` with `afterSlideId` for a slide that failed).
- Optionally `list_voices` → `set_voice` (match brief language).

**Never** call `start_generate` or `get_entitlements` during draft.

Use `get_project` to read slide and box ids before patching. Hand-placed boxes
follow **slidemux-design** §7 (0–1 rects, landscape-canonical `fontSizePx`).

## 3. DESIGN CRITIC (mandatory before review)

**After draft (and after steering), before waiting for approval**, run the
visible design critic pass in **slidemux-design** §8: `lint_deck`, then
`preview_deck` (hosted), then score Visual hierarchy, Focal point, Text
density, Composition / balance, Slide-to-slide variety, Storytelling
continuity, and whether visuals support the message **1–5** with a
slide-specific note each. Print concrete suggestions.

This is read-only. **Do not modify anything** unless the user later asks to
fix them.

Then move to REVIEWING.

## 4. REVIEW

When the draft is built and the critic pass is done, tell the user it is
**ready for review**. Summarize:

- Slide count and structure (one line per slide: headline — `recipe`)
- `lint_deck` result: no recipe repeats twice in a row, and which `split` /
  `full-bleed` / `screenshot` slides still show a placeholder picture
- Total narration duration (word count ÷ 2.3)
- Major design decisions (layout, theme, voice if set)
- `editorUrl` (studio link)
- Brief critic highlights (top suggestions)

**Stop.** Wait for feedback or approval. Do not generate.

## 5. STEERING

Interpret natural-language feedback and map to MCP mutations. Examples:

| User says | Action |
| --- | --- |
| "Make slide 3 simpler" | `replace_slide_from_recipe` on slide 3 with shorter copy or a sparser recipe |
| "Make slide 3 more visual" | `replace_slide_from_recipe` on slide 3 as `split` / `full-bleed` with a picture |
| "Make it more technical" | `set_slide_narration` / `patch_text_box` with denser copy |
| "Remove slide 2" | `delete_slide` by rail-order slide id |
| "Add an example after slide 3" | `append_slide_from_recipe` with `afterSlideId` = slide 3's id |
| "Make narration more conversational" | `set_slide_narration` on named or all slides |
| "Shorten the narration" | `set_slide_narration` with shorter copy |
| "Make the whole tutorial shorter" | delete slides and/or shorten every narration |
| "Move this earlier" | `move_slide` with `afterSlideId` (omit it to move to the front) |
| "Here's the screenshot for step 2" | `replace_slide_from_recipe` on that slide with `upload` |

After meaningful changes:

1. `lint_deck` (and `preview_deck` on the changed `slideIds`)
2. Briefly explain what changed
3. Run the **design critic** pass again (read-only)
4. Return to **REVIEWING**

Preserve previous user decisions unless they explicitly override them.

## 6. CRITIQUE mode (deeper pass on ask)

When the user asks **"What would you improve?"** (or similar):

1. `lint_deck` and `preview_deck`
2. Give concrete, slide-specific suggestions (deeper than the mandatory critic)
3. **Do not modify anything**

When they say **"Fix them"** / **"Fix those things"**:

- Apply only the suggestions from your **last** critique
- Run the design critic again, then return to REVIEWING with a change summary

## 7. APPROVAL and generate

Call `start_generate` **only** when the user explicitly approves or asks to
generate. Examples:

- "Looks good"
- "Generate it"
- "I'm happy with this"
- "Create the video"

Then:

1. `get_entitlements { projectId }` — fail fast if quota or slide cap blocks
2. `list_voices` → `set_voice` if not already set
3. `start_generate { projectId, voiceId }` → poll `get_generate_status` with backoff
4. `download_video { projectId }` → return MP4 path and `editorUrl`

**Generate once** per approval. Do not loop generate to fix copy — steer first,
then generate again only after a new approval.

If the person edits in the browser, regenerate **only when they ask**.

## Example conversation

```
User: Create a tutorial showing how to create a customer case.
Agent: [PLAN storyboard] → [DRAFT deck] → [DESIGN CRITIC: suggestions only] → "Draft ready for review." [REVIEWING]

User: Make slide 3 more visual and shorten the narration.
Agent: [STEERING: replace_slide_from_recipe + set_slide_narration] → [DESIGN CRITIC] → change summary [REVIEWING]

User: Actually remove slide 4 and add a short explanation to slide 3.
Agent: [STEERING: delete_slide, append_slide_from_recipe after slide 3] → [DESIGN CRITIC] → change summary [REVIEWING]

User: What would you improve?
Agent: [CRITIQUE: deeper suggestions only, no writes] [REVIEWING]

User: Fix those things.
Agent: [STEERING: apply last critique] → [DESIGN CRITIC] → change summary [REVIEWING]

User: Looks good, generate the video.
Agent: [approve_deck] → [APPROVED → start_generate → COMPLETE]
```

Hosted MCP enforces approval: `start_generate` rejects topic decks that are still
`draft` / `reviewed`. Call `approve_deck` only after the user explicitly approves.
Editing an approved deck returns it to `draft`.
