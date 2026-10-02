---
name: slidemux-design
description: >-
  Walkthrough composition patterns, brand tokens, step→play→settle→hold, and
  Path A asset rules — plus deck themes, recipes, rhythm, copy lengths, and the
  critic checklist for authored studio decks. On hosted MCP, get_design_guide
  returns this file.
---

# SlideMux: authored-slide design

Read this after **slidemux-tutorial** or **slidemux-topic**, then
**slidemux-workflow**. For filmed or served walkthroughs, invent the stage here,
then **slidemux-video** (Path B) or `ingest_html_stills` (Path A). Themes are
Maya/deck costume (PPTX → snap) — do not put section pills, owl chrome, or
site pills on a Path A still or Path B film. On hosted MCP, `get_design_guide`
returns this file.

Skill order: walkthroughs **design → video** (or Path A ingest); authored decks
**tutorial or topic → design → workflow**.

Two jobs. **Alex walkthroughs invent a one-off stage** — A/B only film or still
that page. Read this walkthrough half first. **Maya decks** pick one theme and
recipes; that costume is fenced under **Deck-only (Maya)**.

## Walkthrough stages (Path A and Path B)

Do not use themes for Alex walkthroughs. Do not pick a `theme` id, recipe, or
`deck-themes` entry for a product tour. Never bake editorial frames into `deck-themes`.
There is no theme or recipe named “Ship the story” or angled stack — invent the
page. A/B only film (Path B) or still (Path A) what you built.

### Invent a one-off stage

One custom HTML page per story. Distinct layout per beat — not the same card
grid recolored. No section pills, owl chrome, site pills, or recipe costume.
Ready Ireland / Talkeando win this way: a page built for that story, not a
theme skin.

### Composition patterns

Taste, not catalog ids. Do not invent a theme id for an angled stack or a
recipe named Ship the story. Invent one of these (or a cousin) per beat:

| Pattern | Use when |
| --- | --- |
| angled hero stack | Editorial **triptych cards** (copy / photo / chart) at a tilt + a connective route line. Invent that magazine look — not product-UI layered frames |
| type lockup | Ink headline with one **accent word** in the brand color |
| chart-as-proof column | A data column that proves the claim; not decoration |
| neon as data spark | Neon or lime only on a number or spark — never a wash |
| route line | Narrative glue between cards or beats; one continuous path |
| editorial crop | Oversized type beside one cropped still |
| device on brand field | Phone or browser chrome on the product’s ground |
| claim + proof split | One sentence beside a live UI still |
| full-bleed scene | One caption on an edge-to-edge beat |

### Brand tokens

Read hexes from the product (button, body text, page). Use them as CSS
variables on the stage — do not snap to a deck theme palette.

| Token | What to take |
| --- | --- |
| accent | `#RRGGBB` of the button or link |
| ink | `#RRGGBB` of the body text |
| ground | `#RRGGBB` of the page background |

Pass a light `ink` when `ground` is dark. The logo is the product mark, not a
SlideMux owl.

### Sync contract

**step → play → settle → hold** to the narration words. Mount the stage paused
→ open `slidemux.step` (or the Path A beat) → play the entrance inside the
step → settle → hold sized to the line. Do not start mid-animation. Do not
hold dead air.

Size `holdMs` from the line: `words ÷ 2.3 × 1000` (same spoken rate as deck
narration). A 4-word line is ~1700ms, not 4s. Do not pad “for safety.”

Shared beat list is `{ slug, narration, holdMs }`. Path A’s settled still ≡
Path B’s post-entrance hold frame.

### Asset rules

Path A fonts and assets must be **inline or uploaded**. Inline `data:` URLs
are allowed. Relative `url(brand.woff2)` must match an uploaded file. Invent
or generate photos and charts travel with the page. **No silent remote fetch**:
`http(s)`, protocol-relative, or `@import` of a host is rejected.

---

## Deck-only (Maya)

Walkthrough agents: stop here. Everything below is authored studio/PPTX costume
(themes, recipes, rhythm, critic). Do not put these on a Path A still or Path B
film.

The server does the layout **and checks the rules**. Your job is to pick
**one theme**, pick the **right recipe per beat**, write **short copy**, then
**fix every warning the server returns**. Hand-placed boxes are for small
steering fixes, not for building slides.

## 1. Visual hierarchy

One focal point per slide. The **headline** is the only sentence-like line.
Everything else is a label (date, name, number, step) or a picture.

## 2. Pick one theme per deck

Send `theme` when you create the deck (`create_deck_from_plan` or
`create_topic_deck`). It is stored on the project and decides composition:
page motif, fonts, alignment, kicker style, step numbering, and card shape.
Product colors come from `brand` when you pass one. You pick recipes and copy;
the theme lays them out. Never mix looks inside a deck.

| Theme | Look | Type | Use for |
| --- | --- | --- | --- |
| `studio` | flat warm ice + constellation dots, electric azure, chapter chips, sharp white cards, `01` | Geist | product tutorials and SaaS only |
| `editorial` | warm paper, masthead rules, ruled columns, italic `i.` numerals | Fraunces serif + Inter | history, culture, essays |
| `midnight` | deep navy aurora, centered stage, wide-tracked kickers | Geist | navy, night, or dark blue only |
| `terminal` | charcoal blueprint grid, `$ prompt` kickers, `[01]` labels, green | Geist + Geist Mono | coding, APIs, CLIs |
| `forest` | sage with organic circles, centered, round cards, numbers in discs | Geist + Inter | wellness, sustainability, HR, onboarding |
| `punch` | black poster, UPPERCASE headlines, yellow tags, sharp blocks | Space Grotesk | dark modern or Apple-like field, bold claims, shorts |
| `blush` | rose page with an arch, centered italic serif, `one`/`two` numbers | Fraunces italic + Inter | pink, rose, or purple |
| `classic` | flat white, greige cards, green | Noto Sans | legacy look; avoid for new decks |

`theme` is required on `create_topic_deck` and `create_deck_from_plan`. It chooses composition (alignment, chips, corners, fonts, page motif). A named look with no hexes snaps to the closest theme: pink, rose, or purple is `blush`; navy or night is `midnight`; a history essay is `editorial`. Say that id in the plan. Do not invent a palette of your own.

## 2b. Product brand

When the deck is for a product or a website, pass `brand` on the same create call. The server recolors every recipe from those hexes and paints the logo. You do not place a box for either.

| Field | What to pass |
| --- | --- |
| `brand.accent` | `#RRGGBB` of the button or link |
| `brand.ink` | `#RRGGBB` of the body text |
| `brand.ground` | `#RRGGBB` of the page background |
| `brand.logo` | the logo image file (hosted: `imageUrl`; stdio: `filePath`) |

`studio` stays the right theme for SaaS. Brand supplies the colors, so a green product on `studio` is green, not azure. Read the hexes from the site (CSS variables, buttons, background). Pass a light `ink` when `ground` is dark.

The logo is painted top-left, with no fill and no pad, on every slide except `full-bleed`. Do not `add_image_box` a logo. Do not invent wheat / `#F5DEB3` slabs behind it, and do not set `groundColor` to a beige card so the mark will show.

`studio` is flat warm ice; `midnight` is a navy gradient. Do not use either for a generic "modern", "cool", or "Apple-like" brief. There is no black-and-white Apple theme: use `punch` for a dark field or `editorial` for a warm essay, and say which one. Name the choice in the same-turn plan, then build the draft.

## 2d. Art direction (optional)

After you pick **one** `theme`, pass optional `artDirection` to explain what the
deck should express visually. It guides recipe choice, hierarchy, and imagery.
It does **not** override theme fonts, brand recolor, logo stamp, safe-area,
contrast, or accessibility.

| Field | Role |
| --- | --- |
| `northStar` | One sentence for the whole deck's visual feeling (required if `artDirection` is set) |
| `principles` | Up to 8 short composition rules |
| `visualVocabulary` | Devices to reuse (routes, crops, monumental numerals, …) |
| `avoid` | Anti-patterns (equal card grids, placeholder boxes, …) |
| `slideIntent` | Optional per-slide `{ visualRationale, emphasis? }` |

Every planned slide should include `visualRationale` (one sentence, one visual
idea). When `artDirection` is set, the server requires it.

Example:

```json
{
  "theme": "studio",
  "artDirection": {
    "northStar": "Make the deck feel like a story in motion, not a UI template.",
    "principles": [
      "Use oversized type for the central idea on each slide.",
      "Turn concepts into one strong visual device: a route, stack, fold, crop, or data form.",
      "Avoid equal-card grids unless comparison is the point.",
      "Use cobalt as the connective system and lime only as a point of emphasis.",
      "Preserve generous negative space."
    ],
    "visualVocabulary": [
      "route lines",
      "layered slide/page stacks",
      "editorial image crops",
      "folded paper planes",
      "monumental numerals"
    ],
    "avoid": [
      "generic SaaS cards",
      "placeholder image boxes",
      "decorative gradients",
      "repeated identical layouts"
    ]
  }
}
```

Precedence: base theme → style/backgrounds → brand + logo → art direction
(agent/lint guide) → recipe composition → copy/assets.

`create_deck_variants` explores up to three theme+artDirection directions as
**draft previews only**. Commit a choice with `create_deck_from_plan` (pass
`designVariantId`). Never generate from a variants call.

## 2c. Theme override (optional)

When a curated theme is close but not right, pass `themeOverride` on create (or on compose `set_theme`) **on top of** the required `theme` id. Prefer curated theme + `brand` first.

| Section | Rule |
| --- | --- |
| `style` | If present, must be a **full** `DeckThemeStyle` (align, headline, kicker, numbers, cards, optional image/corners). Partial style objects are rejected. |
| `backgrounds.hero` / `backgrounds.base` | If present, each page is a full background (`solid` \| `linear` \| `radial`) with optional motifs (`glow`, `dots`, `grid`, `circle`, `arch`, `rule` only). |
| Fonts | Always from the base theme id. Do not invent font names. |
| Apply order | base theme → style → backgrounds → **brand last** (brand recolors palette and page textures; backgrounds choose structure). |

Existing slides after `set_theme`: best-effort recolor + new background PNGs. Kicker/number *copy shape* changes need `replace_slide_from_recipe` (or create-time override). Prefer setting `style` / `backgrounds` at create.

## 3. Recipes

Plan, draft, and talk about slides with these ids — they are exactly what the
`recipe` field accepts. There is no second vocabulary to translate.

| `recipe` | Use for | Copy fields | Photo |
| --- | --- | --- | --- |
| `title` | opener; a one-line statement (headline only) | `headline`, `kicker`, `support` | no |
| `section` | chapter break | `headline`, `number` ("02"), `kicker` | no |
| `split` | explanation beside a photo. Float themes drop the plate and shadow the shot; `editorial` and `classic` keep the plate | `headline`, `kicker`, `support` | **yes** |
| `full-bleed` | edge-to-edge scene with a caption | `headline` | **yes** |
| `screenshot` | one tutorial step over a big screenshot | `kicker` ("Step 2"), `headline`, `support` | **yes** |
| `steps` | numbered process | `headline`, `kicker`, `items` 2–5 | no |
| `agenda` | overview of what's coming | `headline`, `kicker`, `items` 3–6 | no |
| `checklist` | prerequisites, tips, recap | `headline`, `kicker`, `items` 3–5 | no |
| `timeline` | dated milestones | `headline`, `kicker`, `items` 3–5 (`title` = date) | no |
| `comparison` | before/after, A vs B | `headline`, `kicker`, `items` exactly 2 | no |
| `choice` | 2–4 options | `headline`, `kicker`, `options` | no |
| `stat` | one big number | `number`, `headline` (what it means), `kicker`, `support` | no |
| `quote` | pull quote | `headline` (the quote), `name`, `kicker` | no |
| `close` | outcome + one action | `headline`, `support` (the action button), `kicker` | no |

`items` rows are `{ title, detail? }`. In `comparison` the second item is the
highlighted one (the "after" / recommended side). In `choice` the first
option is highlighted. Every recipe slide also takes `narration`.

## 4. Deck rhythm

The server enforces these: repeats come back as `warnings` on every append or
replace, and `lint_deck` reports the whole deck.

- **Never the same recipe on two slides in a row.** A 6–8 slide deck uses at
  least five different recipes.
- Open with `title`, end with `close`. Put `section` between chapters of
  decks longer than eight slides.
- Alternate dense and sparse: follow `steps` / `agenda` / `checklist` with a
  `stat`, `quote`, `split`, or `full-bleed`.

**How-to tutorial (6–8 beats):** `title` → `agenda` or `steps` (overview) →
`screenshot` per step (kicker "Step 1", "Step 2", …; insert a `stat` or `split`
between runs of three) → `checklist` (recap) → `close`.

**Short deck (about 4 slides):** open with `title`, end with `close`. The two
middle slides must not be `timeline` and `stat` together. That sequence is the
default history skeleton, and lint returns a warning. Use one of `quote`,
`comparison`, `split`, or `steps`, and at most one of `timeline` or `stat`.

**Topic deck (6–8 beats):** still open with `title` and end with `close`, with
at least five recipes. Do not reuse one arc. Two that pass lint:
`title` → `split` → `quote` → `comparison` → `stat` → `close`, and
`title` → `steps` → `full-bleed` → `quote` → `checklist` → `close`.

## 5. Copy lengths

| Field | Limit |
| --- | --- |
| `headline` | ≤ 8 words (≤ 16 on `quote`) |
| `kicker` | 1–3 words (the theme styles it: chip, tag, `$ prompt`, or tracked label) |
| `support` | ≤ 16 words |
| item `title` / each `option` | ≤ 4 words (a date on `timeline`) |
| item `detail` | ≤ 12 words |
| `number` | ≤ 5 characters ("87%", "3×", "$1.2M") |

The server returns `warnings` when copy runs past these limits, shrinks to fit
its box, or repeats a neighbour's recipe. Treat any warning as a bug: rewrite
the copy (or pick another recipe) and call `replace_slide_from_recipe` with the
same `slideId`. It keeps the slide's position and narration. Never
`delete_slide` + append to fix a slide — that moves it to the end of the deck.

## 6. Pictures

`split`, `full-bleed`, and `screenshot` need a picture.

- **Hosted HTTP MCP:** `upload.imageUrl` — a public `https` URL that returns
  the image file itself (PNG, JPEG, WebP, GIF), not a web page. A small image
  the user pasted into the chat can go in `upload.base64`; never paste large
  base64.
- **stdio MCP:** `upload.filePath` on the user's machine.
- **No picture yet?** Omit `upload`. The server drafts the slide with a flat
  placeholder in the theme color and `lint_deck` flags it. In the review,
  list those slides and ask the user for the images — or to drop them in
  the studio (`editorUrl`). Tutorials need real screenshots before generate.

## 7. Manual boxes (steering only)

Use `add_text_box` / `patch_text_box` only to fix one detail the user asked
for. Rules the server enforces for recipes, and you must follow by hand:

Rects are **0–1 of the slide**, not 1920×1080 pixels. `x=100` is rejected.
Inset copy; do not hug the edge (`x`/`y` ≥ 0.08). Leave at least **0.03**
breath between sibling boxes (filled panels, cards, framed images). Nested
copy inside a panel does not need that gap. `lint_deck` flags crowded fills.

`fontSizePx` is **landscape-canonical** (1920-wide). Paint scale is
`fontSizePx × (canvasWidth / 1920)`. Portrait is 1080×1920 (scale
**0.5625**): a 48 on portrait paints at 27px. Recipes boost portrait
automatically (1.5× landscape paint). When patching by hand, portrait
titles are **160+**, not 48.

| Role | Landscape | Portrait (hand patch) |
| --- | --- | --- |
| Display headline | 96 | 256 |
| Headline | 60–64 | 160–171 |
| Support / label | 34–40 | 91–107 |
| Body / caption | 28–30 | 75–80 |

Box height must fit the type; overflowing text is clipped when painted.

**Pack faces only:** Inter, Geist, Geist Mono, Space Grotesk, Fraunces
(also italic), Carlito, Arimo, Tinos, Cousine, Caladea, Noto Sans, Roboto,
Open Sans. Anything else falls back to a default font. Match the deck
theme's fonts and colors (`get_project` shows them on existing boxes).

Filled boxes with copy paint with a **24px inset**; corners follow the box's
`corner` (`sharp`, `soft`, `round`, `pill`) and default to rounded, with boxes
≤ 0.10 tall becoming pills. Match the theme's corner when you add one. Do not invent wheat / `#F5DEB3` slabs behind headlines,
and do not strip recipe fills (kicker chips, rules, number discs, cards, CTA
buttons, captions).

`groundColor` on a recipe is a rare per-slide page override (`#RRGGBB`); the
theme already paints the page, including its grid, rules, or shapes, which a
ground override hides. A **full-bleed image or video** already fills
the slide — never add a ground there.

## 8. Design critic (suggestions only)

After draft and after steering, **before waiting for approval**, run this
pass. Do **not** mutate unless the user says “fix them” / “apply those”.

1. `lint_deck` — every deck and slide warning is a finding.
2. `preview_deck` (hosted) — look at the thumbnails; judge what is on the
   slide, not the JSON. On stdio, use `get_project` and the studio link.
   After steering, preview only the changed `slideIds`.
3. Score each dimension **1–5** with one slide-specific note:
   - Visual hierarchy
   - Focal point
   - Text density
   - Composition / balance
   - Slide-to-slide variety
   - Storytelling continuity
   - Visuals support the message
4. List every warning (tool results + `lint_deck`) and the rewrite you
   propose for it.
5. Print concrete, slide-specific suggestions
6. **Do not mutate**

Keep “What would you improve?” as a deeper pass. “Fix those things” applies
only the last critique.
