import { describe, expect, it } from "vitest";
import { buildStepClipArgs, parseManifest } from "./manifest.js";
import { sanitizeSlug } from "./extract-clips.js";

describe("parseManifest", () => {
  it("accepts a v1 bundle with a step clip", () => {
    const manifest = parseManifest({
      schemaVersion: 1,
      outputDir: "test-results/slidemux",
      tests: [
        {
          title: "invite",
          file: "e2e/invite.spec.ts",
          video: "video.webm",
          steps: [{ slug: "open-invite", startMs: 0, endMs: 900, file: "open-invite.mp4" }],
        },
      ],
    });
    expect(manifest.tests[0]?.steps[0]?.file).toBe("open-invite.mp4");
  });

  it("rejects a missing schemaVersion", () => {
    expect(() => parseManifest({ outputDir: "x", tests: [] })).toThrow(/schemaVersion/);
  });

  it("rejects outputDir that leaves the bundle", () => {
    expect(() => parseManifest({ schemaVersion: 1, outputDir: "../secrets", tests: [] })).toThrow(
      /inside the bundle/,
    );
  });

  it("rejects a step file that leaves the bundle", () => {
    expect(() =>
      parseManifest({
        schemaVersion: 1,
        outputDir: "test-results/slidemux",
        tests: [
          {
            title: "invite",
            file: "invite.spec.ts",
            video: null,
            steps: [{ slug: "open", startMs: 0, endMs: 900, file: "../../.env" }],
          },
        ],
      }),
    ).toThrow(/inside the bundle/);
  });
});

describe("buildStepClipArgs", () => {
  it("cuts a clip with a minimum duration", () => {
    const args = buildStepClipArgs("in.webm", "out.mp4", 100, 200);
    expect(args).toContain("-ss");
    expect(args).toContain("0.100");
    expect(args).toContain("-t");
    expect(args).toContain("0.400");
  });
});

describe("sanitizeSlug", () => {
  it("turns titles into filenames", () => {
    expect(sanitizeSlug("Open Invite!")).toBe("open-invite");
  });
});
