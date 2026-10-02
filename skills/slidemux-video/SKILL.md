---
name: slidemux-video
description: >-
  Turn a Playwright test into a narrated product-tour video with the SlideMux
  MCP. Use when the user wants to record a test as a demo video, generate a
  narrated walkthrough, write slide narration, or run the SlideMux
  record -> upload -> narrate -> generate pipeline.
---

# SlideMux: Playwright test -> narrated video

The SlideMux MCP tools automate every mechanical step. Your job is the ordering
and the one thing the tools can't do: **write the narration**. Follow the
pipeline below; the pitfalls in each step are the reason this skill exists.

This is **Path B**: invent a one-off stage (not a theme or recipe), record it, then
`upload_recording` → narrate → generate. Themes are Maya/deck costume only.
No section pills, owl chrome, or site pills on the film.

**Sync rule (Muxxy):** mount the stage paused → open `slidemux.step()` → play
the entrance inside the step → settle → hold to the narration words. Do not
start the clip mid-animation. Do not hold dead air before the entrance or after
the line is done.

**Never change the visible screen between `slidemux.step()` calls. Gaps are not discarded; they can inherit the previous narration.** Each step is one screen + one sentence. Load and mount paused _before_ the step starts; play the entrance _inside_ the step. Put taps that reveal the next screen _inside_ that destination step (or after the destination is already stable).

**Shared beat list (Path A and Path B):** one `{ slug, narration, holdMs }` array is the story script. Path B `slidemux.step(slug)` and the post-entrance hold must match that list. Path A `ingest_html_stills` accepts the same shape (settled still ≡ this hold frame). Regenerating or swapping A↔B reuses narration + holdMs on unchanged slugs — do not rewrite the script when only the intake changes.

```json
[
  { "slug": "open-invite", "narration": "Open the invite dialog.", "holdMs": 4000 }
]
```

`slug` is kebab-case and unique. `holdMs` is the settled hold after the entrance (integer ms). Missing fields or bad timing fail with an indexed error (`beats[1].holdMs must be …`).

**Path A (cloud, no local MP4):** call hosted `ingest_html_stills` with that beat list, one HTML page per slug, and assets. SlideMux captures the **settled post-entrance** still per beat (not mid-anim, not theme stage HTML) and the same generate/mux. Fonts and assets must be **inline or uploaded**. **No silent remote fetch** (`https://`, protocol-relative, or `@import` of a host is rejected). Then `set_voice` → `start_generate` as below.

## Pipeline

Copy this checklist and track progress:

```
- [ ] 1. Prereqs: config wired + API token + quota
- [ ] 2. Record the test
- [ ] 3. Read the bundle (get slugs + clip durations)
- [ ] 4. Upload -> capture projectId
- [ ] 5. Write + set narration per slug
- [ ] 6. Pick + set the voice
- [ ] 7. Generate, then poll to completion
```

### 1. Prereqs

- Stdio MCP (Codex, Claude, Cursor): cloud tools need `SLIDEMUX_API_TOKEN`. Local recording does not. WebMCP is native `document.modelContext` on an open `/projects/:id` studio only; missing API is a silent no-op. Do not treat WebMCP as those hosts’ no-token path.
- If the repo's Playwright config doesn't use `slidemux.step()` yet, run
  `setup_playwright` once.
- **Electron / custom runtimes:** skip `setup_playwright` (it needs Playwright's
  `page` fixture). See **Installed Electron apps** below, then continue from
  `record_test`.
- The cloud MCP tools (upload, narration, voice, generate) need `SLIDEMUX_API_TOKEN`
  in the MCP server env. If those tools error with auth, the token is missing — fall back to the signed-in site, or Sign in → Account → API tokens and paste as `SLIDEMUX_API_TOKEN`.
- If cloud tools return `fetch failed` while a local shell with the same token
  works, keep using the package APIs from the shell for upload/generate. The
  recording is fine; that MCP process cannot reach the API.
- Call `get_entitlements` **before** generating. It returns the invite quota
  (lifetime videos, slide cap, regenerates). Fail fast here: if the recording
  has more steps than the slide cap, or no videos remain, stop and tell the user
  rather than burning a regenerate.

### 2. Record

- **Frame 16:9 or 9:16 only.** Landscape product tours are 1920×1080 or 1280×720;
  vertical/mobile is 1080×1920 or 720×1280. Any other aspect (tiny overlay
  windows, native window chrome, square captures) generates an ugly video —
  fix the capture and re-record, do not upload. The built-in `page` fixture
  already records 1280×720; Electron / custom `recordVideo` must set `size`
  explicitly.
- Run `record_test` with `projectRoot` set to a **self-contained** Playwright
  project (its own `playwright.config.ts` + `node_modules`). A spec nested in a
  parent repo that already has Playwright will pick up the wrong install.
- Pass the target `file` (and `grep` to select one test).
- Only **passed** tests write a usable bundle. A failed `record_test` still
  rewrites `test-results/slidemux/manifest.json` (often `tests: []`) and
  **clobbers a good take**. `get_bundle_status` first; if the bundle is already
  good, do not retry `record_test`.
- If `record_test` errors with `test() to be called here` / no suite: host
  Playwright worker env leaked into the child. Reload the SlideMux MCP, or
  record in a clean shell: `SLIDEMUX=1 npx playwright test` inside `projectRoot`.
- In `playwright.config.ts`, register the reporter as
  `slidemuxReporter()` or `["@slidemux/playwright/reporter", { outputDir: "test-results/slidemux" }]`.
  Do not import `test` from `@slidemux/playwright` in the config file — the
  barrel re-exports `test()`, and config load throws the same "no suite" error.
- Do not `page.goto` (or wait on a spinner) as the first work _inside_ a step —
  the clip starts on blank, the previous slide, or a splash while speech starts.
  Navigate, mount the destination paused, then open the step, play the entrance,
  settle, and hold to the line. Starting mid-animation or holding a still that
  never moves is a sync bug.
- Slow apps: keep a title overlay up until the real UI is ready; hide it at the
  start of the destination step so a load gap is still the old slide, not a
  splash.
- Hide Playwright action highlighting, error toasts, and device chrome that
  covers the product header. The recording should look like a user, not a test.

### 3. Read the bundle

- Run `get_bundle_status`. Each test has `steps[]`; each step has a `slug`,
  `startMs`, `endMs`, and `file`. The `slug` is the narration key and the clip
  duration is `endMs - startMs`.
- Probe one clip (`ffprobe -v error -select_streams v:0 -show_entries stream=width,height`)
  before upload. If it is not 16:9 or 9:16, stop and re-record.
- Check gaps: `startMs[n+1] - endMs[n]`. Over ~300ms is a desync risk (loader,
  splash, or the next screen glued onto the previous voiceover). Inspect first /
  middle / last frame of each `step.mp4` before upload.

### 4. Upload

- Run `upload_recording`. Capture the returned project id — every later step
  needs it as `projectId`.
- Import **upserts** on test file + title. Re-uploading the same spec updates
  the existing studio project. If the user wants a **new** project, change the
  test title (or file), re-record, then upload. Check the returned `projectId`
  against the previous one instead of assuming a new studio URL.

### 5. Narration (the value-add)

For each step, call `set_slide_narration` with `{ projectId, slug, text }` (or `slideId` instead of `slug`).
Write the copy yourself using these rules:

- **Match the frame.** Write copy a silent viewer would accept as a caption for
  **that** clip. Read the first frame (or the hold) before you write. A parallel
  story that does not match the headline is a bug.
- **Spoken, not UI labels.** Describe what's happening and why it matters, in
  the voice of a guide. Echoing the on-screen H1 for one short clause is fine;
  never just read button text off the screen.
- **Fit the clip.** Budget ~2.3 spoken words per second of clip
  (`endMs - startMs`) as a **ceiling**. A 4s clip ~= 9 words; a 10s clip ~= 23
  words. Most slides are one short sentence. Overlong narration gets cut off,
  rushed, or glued onto the next picture.
- **Flow across slides.** Read them in order as one script — no repeated intros,
  each slide continues the last.
- **First and last slide** carry the hook and the wrap/CTA; middle slides move
  the walkthrough forward.

See [narration-examples.md](narration-examples.md) for good vs bad copy.

### 6. Voice

- `list_voices` returns ElevenLabs voices. Use each row's `id`, never the
  display name, and never a Google `Neural2` id (generate rejects it).
- Pick a row that matches the narration language the user asked for
  (`languageCode` when the row has one, otherwise label).
- **English:** default to **Lily** (`pFZP5JQG7iQjIQuC4Bku`) unless the user
  asked for another.
- Persist it with `set_voice { projectId, voiceId }`.

### 7. Generate

- `start_generate { projectId, voiceId }` returns a `jobId` immediately.
- Poll `get_generate_status { projectId, jobId }` with backoff (e.g. 5s, then
  10s) until it reports complete. Jobs run one at a time on the hosted runner,
  so a queued job can take a few minutes before it starts.
- When the job is terminal, MCP also adds resource
  `slidemux://generate/jobs/{jobId}` and sends `notifications/resources/list_changed`.
  Keep polling if the host does not handle that signal.
- Then `download_video { projectId }` saves the MP4 next to the bundle
  (`test-results/slidemux/<projectId>.mp4`) and returns the path; tell the user
  where it is.
- Each generate/regenerate consumes quota — don't loop generate to "retry"
  narration tweaks; fix narration first, then generate once.
- After download, sample the muxed MP4 at each cut. If picture and caption
  disagree, fix the spec and **re-record**, then generate once. Do not generate
  again to “nudge” sync.

| Symptom                                         | Action                                                      |
| ----------------------------------------------- | ----------------------------------------------------------- |
| Wrong screen, splash, notch, click overlay, gap | Re-record, then generate **once**                           |
| Wrong words, too long, wrong voice              | `set_slide_narration` / `set_voice`, then generate **once** |
| “Try another take” with no spec change          | Don’t                                                       |

## Installed Electron apps

`record_test` does not launch the product. The spec must `_electron.launch`
the binary and attach video + `slidemux-steps` itself via
`createSlidemuxStepRecorder` (package README "Custom runtimes").

- **Packaged Mac `.app`:** `executablePath` is `Foo.app/Contents/MacOS/Foo`,
  not the `.app`. Do **not** pass `args: ["main.js"]` — that is for an
  unpackaged sample and can break boot.
- **Quit the app first.** Electron is usually single-instance; a running copy
  steals the launch and Playwright hangs.
- Probe the real UI before writing the spec (launch, dump roles, screenshot).
  Overlay / notch UIs are often a tiny first window, not a browser page.
- `recordVideo` captures the **Electron window**, not the Mac screen. Native
  chrome is invisible. Extra windows: `app.windows()`, not only `firstWindow()`.
- Overlay UIs record as a pill on black unless you lock the window to 16:9
  or 9:16 (`recordVideo.size` plus `BrowserWindow.setContentSize`, not `setSize`
  which includes chrome) and paint a desktop behind the UI (`pointer-events:
none` so clicks still hit the product). Re-lock size after UI that expands
  the window. Hide overflow so a scrollbar does not appear in the clip.
- Some Electron inputs are `readonly` until focused — `click()` then
  `pressSequentially`, not `fill()`.
- A throwaway `--user-data-dir` means onboarding plus TCC (mic / accessibility /
  screen). Seed that profile or drive onboarding in the test.
