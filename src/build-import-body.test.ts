import { describe, expect, it } from "vitest";
import type { SlidemuxManifest } from "./manifest.js";
import { buildImportManifest, buildImportMultipart } from "./build-import-body.js";

describe("buildImportManifest", () => {
  it("maps the last local bundle to the import manifest shape", () => {
    const manifest: SlidemuxManifest = {
      schemaVersion: 1,
      outputDir: "test-results/slidemux",
      tests: [
        {
          title: "invite a teammate",
          file: "e2e/invite.spec.ts",
          video: "video.webm",
          steps: [
            { slug: "open-invite", startMs: 0, endMs: 900, file: "open-invite.mp4" },
            { slug: "send-email", startMs: 900, endMs: 1800, file: "send-email.mp4" },
          ],
        },
      ],
    };
    expect(buildImportManifest(manifest)).toEqual({
      schemaVersion: 1,
      tests: [
        {
          title: "invite a teammate",
          file: "e2e/invite.spec.ts",
          steps: [
            { slug: "open-invite", file: "open-invite.mp4" },
            { slug: "send-email", file: "send-email.mp4" },
          ],
        },
      ],
    });
  });
});

describe("buildImportMultipart", () => {
  it("builds multipart with manifest field and clip files", () => {
    const manifest = {
      schemaVersion: 1 as const,
      tests: [
        {
          title: "invite",
          file: "invite.spec.ts",
          steps: [{ slug: "open-invite", file: "open-invite.mp4" }],
        },
      ],
    };
    const clips = new Map([["open-invite.mp4", Buffer.from("fake-mp4")]]);
    const body = buildImportMultipart(manifest, clips);
    expect(body.contentType).toMatch(/^multipart\/form-data; boundary=/);
    const text = body.body.toString("utf8");
    expect(text).toContain('name="manifest"');
    expect(text).toContain('"schemaVersion":1');
    expect(text).toContain('filename="open-invite.mp4"');
    expect(text).toContain("fake-mp4");
  });
});
