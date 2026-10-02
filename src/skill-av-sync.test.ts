import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const skills = join(dirname(fileURLToPath(import.meta.url)), "../skills");

describe("A/V sync skill copy", () => {
  it("tells agents not to change the screen between steps", () => {
    const video = readFileSync(join(skills, "slidemux-video/SKILL.md"), "utf8");
    expect(video).toContain(
      "Never change the visible screen between `slidemux.step()` calls",
    );
    expect(video).toContain("startMs[n+1] - endMs[n]");
  });

  it("documents the Muxxy Path B sync rule and keeps themes off film", () => {
    const video = readFileSync(join(skills, "slidemux-video/SKILL.md"), "utf8");
    expect(video).toContain("Path B");
    expect(video).toMatch(/play the entrance/i);
    expect(video).toMatch(/settle/i);
    expect(video).toMatch(/hold to the narration/i);
    expect(video).toMatch(/mid-animation/i);
    expect(video).toMatch(/dead air/i);
    expect(video).toMatch(/Maya\/deck costume/i);
    expect(video).not.toMatch(/section-pill|site-pill|slidemux-owl/);
  });

  it("documents the shared beat list Path A will accept", () => {
    const video = readFileSync(join(skills, "slidemux-video/SKILL.md"), "utf8");
    expect(video).toContain("holdMs");
    expect(video).toContain("{ slug, narration, holdMs }");
    expect(video).toMatch(/Path A/);
    expect(video).toMatch(/reuses narration \+ holdMs/i);
  });

  it("documents Path A ingest_html_stills and asset bundling", () => {
    const video = readFileSync(join(skills, "slidemux-video/SKILL.md"), "utf8");
    expect(video).toContain("ingest_html_stills");
    expect(video).toMatch(/inline or uploaded/i);
    expect(video).toMatch(/no silent remote fetch/i);
    expect(video).toMatch(/settled post-entrance/i);
  });
});
