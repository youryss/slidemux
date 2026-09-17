import type { TestInfo } from "@playwright/test";
import { isSlidemuxRecording, SLIDEMUX_STEPS_ATTACHMENT } from "./env.js";
import type { SlidemuxStepMark } from "./manifest.js";

/** Pause after each step so the final frame settles in the recording. */
const STEP_SETTLE_MS = 700;

export type SlidemuxStepRecorder = {
  step: (slug: string, run: () => Promise<void>) => Promise<void>;
  /** Attach recorded marks to the test result for SlidemuxReporter. */
  attachSteps: (testInfo: TestInfo) => Promise<void>;
};

/**
 * Runtime-agnostic core of the slidemux fixture. Use it to integrate
 * SlideMux with contexts the built-in fixture does not cover (e.g.
 * Electron via `_electron.launch({ recordVideo })`):
 *
 *   const recorder = createSlidemuxStepRecorder();
 *   await recorder.step("open-invite", async () => { ... });
 *   await recorder.attachSteps(testInfo);
 */
export function createSlidemuxStepRecorder(): SlidemuxStepRecorder {
  const steps: SlidemuxStepMark[] = [];
  const originMs = Date.now();

  return {
    step: async (slug, run) => {
      const startMs = Date.now() - originMs;
      await run();
      if (isSlidemuxRecording()) {
        await new Promise((resolve) => setTimeout(resolve, STEP_SETTLE_MS));
      }
      steps.push({ slug, startMs, endMs: Date.now() - originMs });
    },
    attachSteps: async (testInfo) => {
      // elapsedAtAttachMs lets the reporter align marks with the real video:
      // the video starts before our origin (page exists first), so
      // videoDuration - elapsedAtAttachMs ≈ the pre-origin footage to skip.
      // Call attachSteps as close to recording end as possible.
      const payload = { steps, elapsedAtAttachMs: Date.now() - originMs };
      await testInfo.attach(SLIDEMUX_STEPS_ATTACHMENT, {
        body: JSON.stringify(payload),
        contentType: "application/json",
      });
    },
  };
}
