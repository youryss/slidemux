import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const skills = join(dirname(fileURLToPath(import.meta.url)), "../skills");
const topicSkillPath = join(skills, "slidemux-topic/SKILL.md");
const designSkillPath = join(skills, "slidemux-design/SKILL.md");
const videoSkillPath = join(skills, "slidemux-video/SKILL.md");

function readTopicSkill(): string {
  return readFileSync(topicSkillPath, "utf8");
}

describe("slidemux-topic skill copy", () => {
  it("exists beside the recording skills", () => {
    expect(readTopicSkill()).toMatch(/^---\s*\nname: slidemux-topic/m);
  });

  it("does not re-ask topic, orientation, or language when already given", () => {
    const skill = readTopicSkill();
    expect(skill).toMatch(/do not re-ask/i);
    expect(skill).toMatch(/topic.*orientation.*language/is);
    expect(skill).toMatch(/opening message/i);
    expect(skill).toMatch(/closest theme/i);
  });

  it("asks only for missing brief fields and blocks create until a theme is chosen", () => {
    const skill = readTopicSkill();
    expect(skill).toMatch(/ask only/i);
    expect(skill).toMatch(/create_topic_deck/);
    expect(skill).toMatch(/start_generate/);
    expect(skill).toMatch(/you choose the\s+deck/i);
    expect(skill).toMatch(/do not.*call|until.*known/is);
  });

  it("defaults unnamed audience and length to general audience and six to eight slides", () => {
    const skill = readTopicSkill();
    expect(skill).toMatch(/general audience/i);
    expect(skill).toMatch(/6.*8|six.*eight/i);
  });

  it("uses a named audience or slide count instead of defaults", () => {
    const skill = readTopicSkill();
    expect(skill).toMatch(/names an audience|named audience|slide count/i);
    expect(skill).toMatch(/slide count/i);
  });

  it("runs create, boxes, narration, review, then generate only on approval", () => {
    const skill = readTopicSkill();
    expect(skill).toMatch(/create_topic_deck/);
    expect(skill).toMatch(/append_slide_from_recipe/);
    expect(skill).toMatch(/append_slide|add_text_box|add_image_box|add_video_box/);
    expect(skill).toMatch(/set_slide_narration/);
    expect(skill).toMatch(/get_entitlements/);
    expect(skill).toMatch(/set_voice/);
    expect(skill).toMatch(/start_generate/);
    expect(skill).toMatch(/editorUrl|studio/i);
    expect(skill).toMatch(/download_video/);
    expect(skill).toMatch(/review/i);
    expect(skill).toMatch(/Do not generate during draft or review|on approval only/i);
    expect(skill).toMatch(/slidemux-design/);
    expect(skill).toMatch(/slidemux-workflow/);
  });

  it("shows the plan instead of hiding it and waiting for no approval", () => {
    const skill = readTopicSkill();
    expect(skill).not.toMatch(/do not show the list/i);
    expect(skill).toMatch(/visible storyboard|shows this plan/i);
  });

  it("says pictures and clips are produced locally, uploaded, and aimed at the narration", () => {
    const skill = readTopicSkill();
    expect(skill).toMatch(/local|user.s machine|on the user/i);
    expect(skill).toMatch(/upload/i);
    expect(skill).toMatch(/aim each clip at the \*\*narration\*\*/i);
    expect(skill).toMatch(/filePath/);
    expect(skill).toMatch(/imageUrl/);
    expect(skill).toMatch(/videoUrl/);
    expect(skill).toMatch(/hosted HTTP MCP/i);
    expect(skill).toMatch(/never paste large base64|do not paste large base64|never.*base64/i);
  });

  it("plans beats before building and references steering", () => {
    const skill = readTopicSkill();
    expect(skill).toMatch(/open, complicate, turn/i);
    expect(skill).toMatch(/list.*briefing.*reasons/is);
    expect(skill).toMatch(/eight words/i);
    expect(skill).toMatch(/300 characters/i);
    expect(skill).toMatch(/A port that never slept/);
    expect(skill).toMatch(/steering|make slide 3 simpler/i);
  });

  it("keeps patching rules and points layout detail at slidemux-design", () => {
    const skill = readTopicSkill();
    expect(skill).toMatch(/slidemux-design/);
    expect(skill).toMatch(/0–1 of the slide|0-1 of the slide/i);
    expect(skill).toMatch(/landscape-canonical/i);
    expect(skill).toMatch(/0\.5625/);
    expect(skill).not.toMatch(/Title \(landscape\)/i);
    expect(skill).not.toMatch(/\*\*Choice/i);

    const design = readFileSync(designSkillPath, "utf8");
    expect(design).toMatch(/`choice`/);
    expect(design).toMatch(/Noto Sans/);
    expect(design).toMatch(/Do not invent wheat/i);
  });

  it("states ceilings: one video, add order, no shape or chart, no reorder, white sheet is not a box", () => {
    const skill = readTopicSkill();
    expect(skill).toMatch(/one video box/i);
    expect(skill).toMatch(/add order|stack order/i);
    expect(skill).toMatch(/no.*chart|no.*shape/i);
    expect(skill).toMatch(/no reorder/i);
    expect(skill).toMatch(/white sheet is not a box|white sheet.*not.*box/i);
    expect(skill).toMatch(/text box with a fill|colored panel/i);
  });
});

describe("slidemux-video skill unchanged for recording", () => {
  it("still documents record, upload, narrate, and generate", () => {
    const video = readFileSync(videoSkillPath, "utf8");
    expect(video).toMatch(/record/i);
    expect(video).toMatch(/upload/i);
    expect(video).toMatch(/narrate/i);
    expect(video).toMatch(/generate/i);
    expect(video).not.toMatch(/create_topic_deck/);
    expect(video).not.toMatch(/add_text_box/);
  });
});
