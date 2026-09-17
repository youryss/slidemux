import path from "node:path";
import { describe, expect, it } from "vitest";
import { assertRelativePath, resolveContained } from "./contained-path.js";

describe("resolveContained", () => {
  const root = "/tmp/project";

  it("joins a relative clip under the project root", () => {
    expect(resolveContained(root, "test-results/slidemux", "open-invite.mp4")).toBe(
      path.resolve(root, "test-results/slidemux", "open-invite.mp4"),
    );
  });

  it("rejects `..` that would leave the bundle directory", () => {
    expect(() => resolveContained(path.join(root, "test-results/slidemux"), "../../.env")).toThrow(
      /escapes/,
    );
  });

  it("rejects an absolute segment that would ignore the root", () => {
    expect(() => resolveContained(root, "/etc/passwd")).toThrow(/must be relative/);
  });
});

describe("assertRelativePath", () => {
  it("accepts a bundle-relative clip name", () => {
    expect(() => assertRelativePath("open-invite.mp4", "step.file")).not.toThrow();
  });

  it("rejects parent-directory segments", () => {
    expect(() => assertRelativePath("../.env", "step.file")).toThrow(/inside the bundle/);
  });

  it("rejects an absolute path", () => {
    expect(() => assertRelativePath("/etc/passwd", "outputDir")).toThrow(/inside the bundle/);
  });
});
