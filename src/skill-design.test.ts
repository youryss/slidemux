import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const designPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../skills/slidemux-design/SKILL.md",
);

function readDesignSkill(): string {
  return readFileSync(designPath, "utf8");
}

describe("slidemux-design skill copy", () => {
  it("exists with the design name", () => {
    expect(readDesignSkill()).toMatch(/^---\s*\nname: slidemux-design/m);
  });

  it("keeps themes as Maya/deck costume off the Path B film", () => {
    const skill = readDesignSkill();
    expect(skill).toMatch(/Maya\/deck costume/);
    expect(skill).toMatch(/Path B film/);
    expect(skill).toMatch(/section pills, owl chrome, or\s+site pills/);
  });

  it("steers Alex walkthroughs to invent a one-off stage, not a theme", () => {
    const skill = readDesignSkill();
    expect(skill).toMatch(/invent a one-off stage/i);
    expect(skill).toMatch(/Do not use themes for Alex walkthroughs/);
    expect(skill).toMatch(/angled hero stack/i);
    expect(skill).toMatch(/Brand tokens/);
    expect(skill).toMatch(/step → play → settle → hold/);
    expect(skill).toMatch(/inline or uploaded/);
    expect(skill).toMatch(/Never bake editorial frames into `deck-themes`/);
    expect(skill).toMatch(/Ship the story/);
    expect(skill).not.toMatch(/`angled-stack`|`ship-the-story`/);
  });

  it("specs editorial walkthrough patterns, holdMs sizing, and a deck-only fence", () => {
    const skill = readDesignSkill();
    expect(skill).toMatch(/angled hero stack/i);
    expect(skill).toMatch(/triptych/i);
    expect(skill).toMatch(/copy\s*[/|]\s*photo\s*[/|]\s*chart/i);
    expect(skill).not.toMatch(/Product UI as layered frames/i);
    expect(skill).toMatch(/type lockup/i);
    expect(skill).toMatch(/accent word/i);
    expect(skill).toMatch(/chart-as-proof/i);
    expect(skill).toMatch(/neon as data spark/i);
    expect(skill).toMatch(/route line/i);
    expect(skill).toMatch(/narrative glue/i);
    expect(skill).toMatch(/words\s*÷\s*2\.3/);
    expect(skill).toMatch(/holdMs/);
    expect(skill).toMatch(/## Deck-only \(Maya\)/);
    expect(skill).toMatch(/Walkthrough agents: stop here/i);
    expect(skill).toMatch(/travel with the page/i);
  });

  it("plans with the server recipe ids directly", () => {
    const skill = readDesignSkill();
    for (const recipe of ["title", "section", "split", "full-bleed", "screenshot", "steps", "stat", "close"]) {
      expect(skill).toMatch(new RegExp(`^\\| \`${recipe}\` \\|`, "m"));
    }
    expect(skill).toMatch(/no second vocabulary/i);
    expect(skill).not.toMatch(/conceptual/i);
    expect(skill).not.toMatch(/compose \(`append_slide`/i);
  });

  it("makes the agent pick one stored theme per deck", () => {
    const skill = readDesignSkill();
    expect(skill).toMatch(/Pick one theme per deck/);
    expect(skill).toMatch(/`theme` is required/);
    expect(skill).toMatch(/closest theme/);
    expect(skill).toMatch(/brand\.accent/);
    expect(skill).toMatch(/brand\.logo/);
    expect(skill).toMatch(/Do not `add_image_box` a logo/);
    for (const theme of ["studio", "editorial", "midnight", "terminal", "forest", "punch", "blush"]) {
      expect(skill).toContain(`\`${theme}\``);
    }
  });

  it("sets deck rhythm, copy limits, and treats warnings as bugs", () => {
    const skill = readDesignSkill();
    expect(skill).toMatch(/Never the same recipe on two slides in a row/);
    expect(skill).toMatch(/at\s+least five different recipes/);
    expect(skill).toMatch(/How-to tutorial/);
    expect(skill).toMatch(/title → timeline → stat → close|default history skeleton/);
    expect(skill).toMatch(/not a generic modern or Apple look|not .* Apple/i);
    expect(skill).toMatch(/Treat any warning as a bug/);
  });

  it("fixes slides in place instead of delete + append", () => {
    const skill = readDesignSkill();
    expect(skill).toMatch(/replace_slide_from_recipe/);
    expect(skill).toMatch(/Never\s+`delete_slide` \+ append/);
  });

  it("drafts missing pictures as placeholders that lint flags", () => {
    const skill = readDesignSkill();
    expect(skill).toMatch(/No picture yet\?/);
    expect(skill).toMatch(/upload\.base64/);
    expect(skill).toMatch(/placeholder/);
  });

  it("documents critic dimensions and the no-mutate rule", () => {
    const skill = readDesignSkill();
    expect(skill).toMatch(/Visual hierarchy/i);
    expect(skill).toMatch(/Focal point/i);
    expect(skill).toMatch(/Text density/i);
    expect(skill).toMatch(/Composition \/ balance/i);
    expect(skill).toMatch(/Slide-to-slide variety/i);
    expect(skill).toMatch(/Storytelling continuity/i);
    expect(skill).toMatch(/Visuals support the message/i);
    expect(skill).toMatch(/Do not mutate/i);
    expect(skill).toMatch(/lint_deck/);
    expect(skill).toMatch(/preview_deck/);
    expect(skill).toMatch(/\*\*1–5\*\*/);
    expect(skill).toMatch(/fix them|apply those/i);
  });

  it("keeps manual-box rules for steering fixes", () => {
    const skill = readDesignSkill();
    expect(skill).toMatch(/steering only/i);
    expect(skill).toMatch(/0–1 of the slide|0-1 of the slide/i);
    expect(skill).toMatch(/0\.03/);
    expect(skill).toMatch(/landscape-canonical/i);
    expect(skill).toMatch(/160/);
    expect(skill).toMatch(/groundColor/);
    expect(skill).toMatch(/full-bleed image or video/i);
    expect(skill).toMatch(/imageUrl/);
  });
});
