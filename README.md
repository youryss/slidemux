# @slidemux/playwright

Your Playwright tests become your always-current tutorial videos. Mark steps with `slidemux.step()`, record them as a local clip bundle (`test-results/slidemux/`), then upload, narrate, and generate a video on [SlideMux](https://slidemux.com/agents) from an agent (MCP), the CLI, or CI.

**No PAT:** sign in at [slidemux.com](https://slidemux.com), open a project, and let the agent drive the studio. WebMCP is already on the page — the logged-in tab is enough.

**MCP / CI:** set `SLIDEMUX_API_TOKEN` to a PAT minted on the invite (operator) or from API tokens if you have that menu. Do not commit tokens to git.

## Agent / MCP

One copy-paste for Codex after `npm install -D @slidemux/playwright` and exporting the token:

```bash
codex mcp add slidemux --env SLIDEMUX_API_URL=https://slidemux.com --env SLIDEMUX_API_TOKEN=$SLIDEMUX_API_TOKEN -- npx -y -p @slidemux/playwright slidemux-mcp
```

### Claude Code plugin

This package is a Claude Code plugin (skill + MCP). Install from npm:

```bash
npm install -D @slidemux/playwright
claude --plugin-dir ./node_modules/@slidemux/playwright
```

Export `SLIDEMUX_API_TOKEN` in the environment before starting Claude Code. Cloud tools fail without it.

Skill: `/slidemux:slidemux-video`

From the public GitHub repo (after it is pushed):

```
/plugin marketplace add youryss/slidemux
```

### Cursor plugin

Copy this folder to `~/.cursor/plugins/local/slidemux` and reload the window to try it locally. Set `SLIDEMUX_API_TOKEN` under Plugins → Configure. Submit `https://github.com/youryss/slidemux` at [cursor.com/marketplace/publish](https://cursor.com/marketplace/publish) once that repo is public.

### Cursor / Claude Desktop MCP JSON

```json
{
  "mcpServers": {
    "slidemux": {
      "command": "npx",
      "args": ["-y", "-p", "@slidemux/playwright@0.1.7", "slidemux-mcp"],
      "env": {
        "SLIDEMUX_API_URL": "https://slidemux.com",
        "SLIDEMUX_API_TOKEN": "pat_…"
      }
    }
  }
}
```

### Environment

| Variable | Required for | Description |
| --- | --- | --- |
| `SLIDEMUX_API_TOKEN` | Cloud tools | Bearer PAT for SlideMux HTTP APIs |
| `SLIDEMUX_API_URL` | Cloud tools | SlideMux app origin (no trailing slash), e.g. `https://slidemux.com` |

Local recording tools work with no token. Cloud tools fail with a clear error when either env var is missing.

### Tool catalog

**Local (no PAT)**

| Tool | Description |
| --- | --- |
| `setup_playwright` | Patch Playwright config for `slidemux.step()` |
| `record_test` | Run Playwright with `SLIDEMUX=1` to write the bundle |
| `get_bundle_status` | Read `test-results/slidemux/manifest.json` and clip files |

**Cloud (PAT required)**

| Tool | HTTP route |
| --- | --- |
| `upload_recording` | `POST /api/playwright-imports` — last local bundle |
| `list_voices` | `GET /api/tts/voices?provider=elevenlabs` |
| `get_entitlements` | `GET /api/auth/entitlements` (optional `projectId`) |
| `set_slide_narration` | `PUT /api/projects/:id` — one slide by step slug |
| `set_voice` | `PUT /api/projects/:id` — persist `voiceId` |
| `start_generate` | `POST /api/projects/:id/generate` with `provider=elevenlabs` — returns `jobId` immediately |
| `get_generate_status` | `GET /api/projects/:id/generate/:jobId` |
| `download_video` | `GET /api/projects/:id/output/video.mp4` — saves `test-results/slidemux/<projectId>.mp4` (or `outPath`), returns path + bytes; fails if there is no completed output, never starts a generate |

Not in this catalog: `set_captions`, `list_projects`, `delete_project`, `login`.

Typical convert loop: `record_test` → `get_bundle_status` → `upload_recording` → `list_voices` → `set_voice` → optional `set_slide_narration` → `get_entitlements` → `start_generate` → poll `get_generate_status` → `download_video`.

Known ceiling: the hosted runner generates one video at a time. If another job is running, yours queues behind it; a 6-step tutorial typically takes a couple of minutes once it starts.

## Human CLI

```bash
npm install -D @slidemux/playwright
npx slidemux setup
npx slidemux record --file e2e/invite.spec.ts
npx slidemux status
# CI one-liner: upload the last bundle, generate, poll, download the MP4(s)
SLIDEMUX_API_URL=https://slidemux.com SLIDEMUX_API_TOKEN=$SLIDEMUX_API_TOKEN \
  npx slidemux publish --voice pFZP5JQG7iQjIQuC4Bku --out tutorials
```

`publish` exits non-zero with the server code when generate is denied (`VIDEO_METER_EXHAUSTED`, `SLIDE_CAP_EXCEEDED`, `REGENERATE_CAP_EXCEEDED`) or the job fails, and prints `editorUrl -> outputPath (bytes)` for each imported test. Omit `--voice` to use the voice already saved on the project (set it once in the studio or via `set_voice`).

## In a test

```ts
import { test, expect } from "@slidemux/playwright";

test("invite a teammate", async ({ page, slidemux }) => {
  await page.goto("/settings");
  await slidemux.step("open-invite", async () => {
    await page.getByRole("button", { name: "Invite teammate" }).click();
  });
  await expect(page.getByText("Invite sent")).toBeVisible();
});
```

## Custom runtimes (Electron, custom contexts)

The built-in fixture depends on Playwright's `page` fixture, so it does not work
with `_electron.launch` or hand-built contexts. The reporter, however, only
reads two attachments from each passed test result — this contract is stable:

| Attachment name | Content |
| --- | --- |
| `video` | Playwright's standard video attachment (attach the recorded file yourself if your runtime doesn't) |
| `slidemux-steps` | JSON `{ steps: Array<{ slug, startMs, endMs }>, elapsedAtAttachMs: number }` — step marks in ms relative to the recorder origin, plus the elapsed ms from origin to the attach call. A bare JSON array of step marks is also accepted (legacy), but then no video alignment is applied. |

Use `createSlidemuxStepRecorder` to produce the steps attachment without the
`page` fixture. Electron example:

```ts
import { test as base } from "@playwright/test";
import { _electron } from "playwright";
import { createSlidemuxStepRecorder, isSlidemuxRecording } from "@slidemux/playwright";

const test = base.extend({
  slidemux: async ({}, use, testInfo) => {
    const app = await _electron.launch({
      args: ["main.js"],
      recordVideo: isSlidemuxRecording() ? { dir: testInfo.outputDir } : undefined,
    });
    const window = await app.firstWindow();
    const recorder = createSlidemuxStepRecorder();

    await use({ step: recorder.step, window });

    const video = window.video();
    await app.close();
    if (video) {
      await testInfo.attach("video", { path: await video.path(), contentType: "video/webm" });
    }
    await recorder.attachSteps(testInfo);
  },
});
```

For an **installed** `.app`, pass `executablePath` to the binary inside
`Contents/MacOS/` and omit `args: ["main.js"]`. Set `recordVideo.size` to
**16:9 or 9:16** (overlay windows are otherwise a tiny capture on black). Quit
the running app first — Electron is usually single-instance.

Timing: the video usually starts before the recorder's origin (the app or page
exists first). The reporter corrects for this automatically by probing the
video duration with ffprobe and shifting marks by
`videoDuration - elapsedAtAttachMs`. For that correction to be accurate, call
`attachSteps` as close to the end of the recording as possible (right around
closing the app/context, as in the example above).

## Source and license

Public plugin listing target: [github.com/youryss/slidemux](https://github.com/youryss/slidemux).
Until that repo is the source of truth, this directory also lives in the
SlideMux monorepo as `packages/slidemux-playwright/`. It has no imports outside
this directory — a test (`src/package-boundary.test.ts`) enforces that.

Develop locally with `npm install`, `npm run typecheck`, `npm test`, and
`npm run build` (emits `dist/`).

MIT © Youry Stancato. See [LICENSE](./LICENSE).
