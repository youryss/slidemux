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
});
