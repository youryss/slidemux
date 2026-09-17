import { isSlidemuxRecording } from "./env.js";

/** Playwright `use` flags for recording: pointer, 720p video. Off unless SLIDEMUX=1. */
export function slidemuxPlaywrightUse(): {
  video:
    | "off"
    | {
        mode: "on";
        size: { width: number; height: number };
        showActions: { cursor: "pointer"; duration: number };
      };
  viewport: { width: number; height: number };
} {
  if (!isSlidemuxRecording()) {
    return {
      video: "off",
      viewport: { width: 1280, height: 720 },
    };
  }

  return {
    viewport: { width: 1280, height: 720 },
    video: {
      mode: "on",
      size: { width: 1280, height: 720 },
      showActions: { cursor: "pointer", duration: 900 },
    },
  };
}

/** Reporter entry to drop into `playwright.config.ts`. */
export function slidemuxReporter(): [string, { outputDir: string }] {
  return ["@slidemux/playwright/reporter", { outputDir: "test-results/slidemux" }];
}
