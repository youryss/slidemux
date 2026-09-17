/** True when Playwright should record SlideMux step clips. */
export function isSlidemuxRecording(): boolean {
  return process.env.SLIDEMUX === "1";
}

export const SLIDEMUX_STEPS_ATTACHMENT = "slidemux-steps";
export const DEFAULT_BUNDLE_DIR = "test-results/slidemux";
