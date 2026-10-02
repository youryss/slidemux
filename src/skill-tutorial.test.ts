import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const tutorialPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../skills/slidemux-tutorial/SKILL.md",
);

function readTutorialSkill(): string {
  return readFileSync(tutorialPath, "utf8");
}

describe("slidemux-tutorial skill copy", () => {
  it("defaults to topic-deck tools, design, and workflow, not Playwright record", () => {
    const skill = readTutorialSkill();
    expect(skill).toMatch(/slidemux-design/);
    expect(skill).toMatch(/slidemux-workflow/);
    expect(skill).toMatch(/create_topic_deck/);
    expect(skill).toMatch(/append_slide_from_recipe|append_slide/);
    expect(skill).toMatch(/Do not call `start_generate` until the user explicitly approves/);
    expect(skill).not.toMatch(/Use the `slidemux-video` skill for the record/);
    expect(skill).not.toMatch(/conceptual/i);
    expect(skill).toMatch(/`screenshot`: one step/);
    expect(skill).toMatch(/`close`: outcome/);
    expect(skill).toMatch(/placeholder/);
    expect(skill).toMatch(/0–1 rects|0-1 rects/i);
    expect(skill).toMatch(/landscape-canonical|fontSizePx/);
    expect(skill).toMatch(/160/);
  });

  it("mentions Playwright only as filmed-app alternative", () => {
    const skill = readTutorialSkill();
    expect(skill).toMatch(/filmed app|live filmed walkthrough/i);
    expect(skill).toMatch(/slidemux-video/);
    expect(skill).toMatch(/record → upload → narrate → generate/);
    expect(skill).toContain("Path B");
    expect(skill).toMatch(/Maya\/deck costume/);
    expect(skill).toMatch(/play the\s+entrance/i);
  });
});
