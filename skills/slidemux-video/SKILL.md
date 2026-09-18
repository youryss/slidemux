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
- Fastest path (no PAT): sign in at https://slidemux.com, open the project, and drive the studio in that tab. WebMCP is already registered on the page; the agent uses the logged-in session.
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

### 3. Read the bundle
- Run `get_bundle_status`. Each test has `steps[]`; each step has a `slug`,
  `startMs`, `endMs`, and `file`. The `slug` is the narration key and the clip
  duration is `endMs - startMs`.
- Probe one clip (`ffprobe -v error -select_streams v:0 -show_entries stream=width,height`)
  before upload. If it is not 16:9 or 9:16, stop and re-record.

### 4. Upload
- Run `upload_recording`. Capture the returned project id — every later step
  needs it as `projectId`.
- Import **upserts** on test file + title. Re-uploading the same spec updates
  the existing studio project. If the user wants a **new** project, change the
  test title (or file), re-record, then upload. Check the returned `projectId`
  against the previous one instead of assuming a new studio URL.

### 5. Narration (the value-add)
For each step slug, call `set_slide_narration` with `{ projectId, slug, text }`.
Write the copy yourself using these rules:

- **Spoken, not UI labels.** Describe what's happening and why it matters, in
  the voice of a guide. Never just read button text off the screen.
- **Fit the clip.** Budget ~2.3 spoken words per second of clip
  (`endMs - startMs`). A 4s clip ~= 9 words; a 10s clip ~= 23 words. Most
  slides are one short sentence. Overlong narration gets cut off or rushed.
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
- Then `download_video { projectId }` saves the MP4 next to the bundle
  (`test-results/slidemux/<projectId>.mp4`) and returns the path; tell the user
  where it is.
- Each generate/regenerate consumes quota — don't loop generate to "retry"
  narration tweaks; fix narration first, then generate once.

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
