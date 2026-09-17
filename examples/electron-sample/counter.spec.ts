import path from "node:path";
import { fileURLToPath } from "node:url";
import { test as base, expect, type Page } from "@playwright/test";
// The electron package's default export is the path to its binary.
import electronExecutablePath from "electron";
import { _electron } from "playwright";
import { createSlidemuxStepRecorder, isSlidemuxRecording, type SlidemuxStepRecorder } from "../../src/index.js";

type ElectronFixtures = {
  window: Page;
  slidemux: Pick<SlidemuxStepRecorder, "step">;
};

const test = base.extend<ElectronFixtures>({
  window: async ({}, use, testInfo) => {
    const app = await _electron.launch({
      executablePath: electronExecutablePath as unknown as string,
      args: [path.join(path.dirname(fileURLToPath(import.meta.url)), "main.js")],
      recordVideo: isSlidemuxRecording() ? { dir: testInfo.outputDir } : undefined,
    });
    const window = await app.firstWindow();
    await use(window);

    const video = window.video();
    await app.close();
    if (video) {
      await testInfo.attach("video", { path: await video.path(), contentType: "video/webm" });
    }
  },
  slidemux: async ({ window }, use, testInfo) => {
    void window; // ensure recording starts before the recorder's time origin
    const recorder = createSlidemuxStepRecorder();
    await use({ step: recorder.step });
    await recorder.attachSteps(testInfo);
  },
});

test("count slides", async ({ window, slidemux }) => {
  await slidemux.step("open-counter", async () => {
    await window.getByRole("button", { name: "Open counter" }).click();
  });
  await slidemux.step("increment-twice", async () => {
    await window.getByRole("button", { name: "Increment" }).click();
    await window.getByRole("button", { name: "Increment" }).click();
  });
  await expect(window.locator("#count")).toHaveText("2");
});
