import { test as base, expect } from "@playwright/test";
import { isSlidemuxRecording } from "./env.js";
import { createSlidemuxStepRecorder } from "./step-recorder.js";

export type SlidemuxFixture = {
  step: (slug: string, run: () => Promise<void>) => Promise<void>;
};

type Fixtures = {
  slidemux: SlidemuxFixture;
};

export { expect };

export const test = base.extend<Fixtures>({
  slidemux: async ({ page }, use, testInfo) => {
    const recorder = createSlidemuxStepRecorder();

    if (isSlidemuxRecording()) {
      await page.screencast.showActions({ cursor: "pointer", duration: 900 }).catch(() => undefined);
    }

    await use({ step: recorder.step });

    await recorder.attachSteps(testInfo);
  },
});
