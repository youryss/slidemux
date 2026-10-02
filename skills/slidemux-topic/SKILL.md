---
name: slidemux-topic
description: >-
  Build a studio presentation about a subject from directions — no Playwright
  recording. Use when the user asks for a deck, presentation, or video about a
  topic, theme, or subject (not filming an app).
---

# SlideMux: subject → studio deck → narrated video

Use this skill when the user wants a presentation **about** something — not a
Playwright product tour. For how-to tutorials, read **slidemux-tutorial**
(`skill://slidemux/slidemux-tutorial/SKILL.md`). For filmed app tours, read
**slidemux-video** and follow record → upload → narrate → generate.

After the brief is known, read **slidemux-design**
(`skill://slidemux/slidemux-design/SKILL.md`) for recipe mapping, layout rects,
and type scale. Then read **slidemux-workflow**
(`skill://slidemux/slidemux-workflow/SKILL.md`) for the interactive
plan → draft → review → steer → approve → generate loop.

## 1. Collect the brief

Ask **only** for what is still missing among **topic**,
**orientation** (`landscape` or `portrait`), and **language**. You choose the
deck `theme` id (see **slidemux-design**). A named look with no hexes snaps to
the closest theme. A product or a website also gets `brand` (accent, ink,
ground, logo) on create — do not ask them to pick an id.

| Field | Meaning |
| --- | --- |
| **Topic** | Subject of the deck (e.g. "history of coffee") |
| **Theme** | Chosen by you: one stored deck theme (composition). A named look with no hexes snaps to the closest id; say that id in the plan. A product site also passes `brand` |
| **Orientation** | `landscape` (16:9) or `portrait` (9:16) |
| **Language** | Headline and narration language |

**Do not re-ask** topic, orientation, or language when the opening message
already answered them. Do not re-ask a visual direction they already gave; map it.

**Optional** (not part of the brief gate):

- No audience named → assume a **general audience**.
- No length named → plan **about six to eight slides**.
- When the user **names an audience** or **slide count**, use theirs instead of those defaults (e.g. "four slides for investors" stays four).

**Gate:** Until topic, orientation, and language are known, and you have chosen
a theme id, **do not call** `create_topic_deck`, `append_slide`, any box tool,
`start_generate`, or anything else that creates a project or spends a credit.
Ask only for the missing fields.

## 2. Plan the beats

After the brief is known, draft one beat per slide. The **workflow skill** shows
this plan to the user (visible storyboard) before or alongside the first draft.

The deck `theme` id you chose sets colors and fonts on the project, plus the
picture style. The project stores boxes, narration, voice,
orientation, and theme. It does not store this beat list.

**Default arc:** open, complicate, turn. Early beats open a scene. Middle beats
complicate that same scene. The last beat turns it. Use the slide count from the
brief (about six to eight unless the user named one).

When the user asks for a **list**, a **briefing**, or **reasons**, that structure
is the deck instead.

Each beat is one slide, planned together:

- **Picture.** The scene. Use an image when the beat needs one.
- **Headline.** About eight words, one line, in the brief language. The only
  sentence-like words on the slide. Any other on-slide text is a label: a date,
  a name, or a number.
- **Narration.** Under 300 characters, in the brief language. It adds the stake
  the headline does not say, stays on that slide, and does not contradict the
  picture or the headline. More than one sentence is fine inside the cap. The
  line has to land on its own.

Worked beat:

| | |
| --- | --- |
| Picture | Night harbor, sacks of coffee on a dock |
| Headline | A port that never slept |
| Narration | A late cargo paid more than the night it stole, so the docks stayed lit until morning. |

## 3. Pipeline

Copy this checklist and track progress:

```
- [ ] 1. Prereqs: SLIDEMUX_API_TOKEN + read ceilings below
- [ ] 2. Read slidemux-design, then slidemux-workflow — plan storyboard, then draft
- [ ] 3. Hosted: create_deck_from_plan { title, orientation, theme, slides } — stdio: create_topic_deck, then append_slide_from_recipe per beat (narration inline)
- [ ] 4. Fix every warning in place with replace_slide_from_recipe; run lint_deck + preview_deck
- [ ] 5. Present draft for review — do NOT start_generate yet
- [ ] 6. Steer until user approves (workflow skill)
- [ ] 7. get_entitlements → list_voices → set_voice → start_generate (on approval only)
- [ ] 8. Return editorUrl (studio link) + download_video path
```

Stdio MCP (Codex, Claude, Cursor) and hosted HTTP MCP expose the topic-deck tools.
WebMCP does not — do not expect box tools on an open studio tab.

### 3.1 Create and populate

- **Hosted:** `create_deck_from_plan { title, orientation, theme, slides }`
  builds the whole storyboard in one call → capture `projectId` and
  `editorUrl` (studio link). **stdio:** `create_topic_deck { title,
  orientation, theme }`, then `append_slide_from_recipe` per beat. Pick the
  theme from the brief (see **slidemux-design** §2).
- Each slide carries its `recipe` id (**slidemux-design** §3), copy, `items`
  for list recipes (`steps`, `agenda`, `checklist`, `timeline`,
  `comparison`), `narration`, and a photo for `split` / `full-bleed` /
  `screenshot` (`upload.imageUrl` on hosted; `upload.filePath` on stdio;
  omit it to draft with a placeholder). Do **not** assemble slides from raw
  `add_text_box` calls; use `add_text_box` / `patch_text_box` only when
  steering an existing slide.
- If a result lists `warnings`, fix that slide in place with
  `replace_slide_from_recipe` (same `slideId`) — never delete + append.
- Use `get_project` to read back slide and box ids before patching.
- Narration goes inline on each slide; `set_slide_narration { projectId,
  slideId, text }` rewrites it later.
- Follow **slidemux-design** for recipe mapping, layout rects, and type scale.
  Guessing pixel rects or 16–48px type is why decks look sparse and unreadably
  small.

### 3.1a Layout and type (do not skip)

Read **slidemux-design** (`skill://slidemux/slidemux-design/SKILL.md`) for
recipe mapping, layout rects, type scale, and colors. **Call
`append_slide_from_recipe`** for every slide — the server places rects,
sizes and fits type, and paints theme fills, pills, cards, and captions.

Two rules agents miss when **patching**:

1. **Rects are 0–1 of the slide**, not 1920×1080 pixels. `x=100` is rejected.
   Inset body copy; do not hug the edge (`x`/`y` ≥ 0.08).
2. **`fontSizePx` is landscape-canonical (1920-wide).** Paint scale is
   `fontSizePx × (canvasWidth / 1920)`. Landscape is 1920×1080 (scale 1).
   Portrait is 1080×1920 (scale **0.5625**). A 48 sent on portrait paints at
   **27px**. Recipes already boost type (1.5× landscape paint). Hand-patched
   portrait titles are **160+**, not 48.

**Pictures and clips.** There is no server-side image or video model. **Never paste large base64** into a tool call — that stalls ChatGPT, Claude, and Cursor.

- **stdio MCP:** save PNG, JPEG, WebP, or GIF (or MP4/WebM) on the user's
  machine, then call `add_image_box` / `add_video_box` with `upload.filePath`
  (preferred), `filename`, and rect.
- **hosted HTTP MCP:** cannot read disk. Pass `upload.imageUrl` or
  `upload.videoUrl` (https only). Do not send `filePath`. Do not send large
  base64.

**Clip length:** aim each clip at the **narration** on that slide. Generate holds
the slide for narration plus today's linger; a clip shorter than that hold
repeats until the voice ends. There is no duration field on MCP — length the
clip locally (ffmpeg or your editor) before upload.

### 3.2 Voice and generate (on approval only)

**Do not generate during draft or review.** Call `start_generate` only when the
user explicitly approves (see workflow skill).

- `get_entitlements { projectId }` before `start_generate`. Stop if the slide cap
  or video quota would refuse the job.
- `list_voices` → pick a row that matches the brief **language** → `set_voice`.
- `start_generate { projectId, voiceId }` → poll `get_generate_status` with
  backoff (and `slidemux://generate/jobs/{jobId}` where the host supports
  `list_changed`). **Generate once** per approval — do not loop generate to
  fix timing or copy.
- `download_video { projectId }` → return the MP4 path and the `editorUrl`.

If the person later edits boxes in the browser, regenerate **only when they ask**
— opening the studio does not spend another credit.

### 3.3 Steering and revising

When the user steers ("make slide 3 simpler", "remove slide 2", etc.), follow
the **slidemux-workflow** steering map. Read the project with `get_project`,
apply mutations, summarize changes, and return to review. Generate again only
when they explicitly approve after changes.

## Ceilings (do not promise beyond these)

- **One video box per slide.** A second `add_video_box` on the same slide fails
  and leaves the slide unchanged.
- **Stack order = add order.** The first box sits at the back; each newer box
  lands in front. There is **no reorder tool** in this slice.
- **No chart or shape layer.** A colored panel is a **text box with a fill**.
- **The page (white sheet or theme color) is not a box.** The deck theme
  paints it; a full-bleed image or video covers it. A rare per-slide override
  is `groundColor` on a recipe — see **slidemux-design**. Do not add a ground
  when a picture already fills the slide.
- **No prompt-to-pixels on the server.** Produce pictures and clips locally
  (stdio `filePath`) or fetch them via hosted `imageUrl` / `videoUrl`.

## Recording skill stays separate

App tutorials filmed with Playwright use **slidemux-video**: record → upload →
narrate → generate. Do not mix Playwright recording into this topic flow.
