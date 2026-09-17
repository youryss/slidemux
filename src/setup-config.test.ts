import { describe, expect, it } from "vitest";
import { patchPlaywrightConfig } from "./setup-config.js";

describe("patchPlaywrightConfig", () => {
  it("inserts import, reporter, and use spread into a typical config", () => {
    const source = `import { defineConfig } from "@playwright/test";

export default defineConfig({
  use: {
    baseURL: "http://localhost:3000",
  },
});
`;
    const patched = patchPlaywrightConfig(source);
    expect(patched.changed).toBe(true);
    expect(patched.next).toContain("@slidemux/playwright");
    expect(patched.next).toContain("slidemuxReporter()");
    expect(patched.next).toContain("...slidemuxPlaywrightUse()");
  });

  it("is a no-op when the package is already imported", () => {
    const source = `import { slidemuxPlaywrightUse, slidemuxReporter } from "@slidemux/playwright";
export default {};
`;
    expect(patchPlaywrightConfig(source)).toEqual({ next: source, changed: false });
  });
});
