import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const workflowPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../skills/slidemux-workflow/SKILL.md",
);

function readWorkflowSkill(): string {
  return readFileSync(workflowPath, "utf8");
}

describe("slidemux-workflow skill copy", () => {
  it("exists with the workflow name", () => {
    expect(readWorkflowSkill()).toMatch(/^---\s*\nname: slidemux-workflow/m);
  });

  it("names all derived phases", () => {
    const skill = readWorkflowSkill();
    for (const phase of [
      "PLANNING",
      "DRAFTING",
      "REVIEWING",
      "STEERING",
      "APPROVED",
      "GENERATING",
      "COMPLETE",
    ]) {
      expect(skill).toContain(phase);
    }
  });

  it("blocks start_generate until explicit approval", () => {
    const skill = readWorkflowSkill();
    expect(skill).toMatch(/Never.*start_generate|Do not call `start_generate`/is);
    expect(skill).toMatch(/explicitly approves|explicit approve/i);
    expect(skill).toMatch(/Looks good|Generate it|Create the video/);
  });

  it("plans a recipe id per beat and drafts from the plan", () => {
    const skill = readWorkflowSkill();
    expect(skill).toMatch(/headline — `recipe` — purpose/);
    expect(skill).not.toMatch(/conceptual/i);
    expect(skill).toMatch(/create_deck_from_plan/);
    expect(skill).toMatch(/compose/);
    expect(skill).toMatch(/two slides in a row|same recipe/i);
    expect(skill).toMatch(/append_slide_from_recipe/);
    expect(skill).toMatch(/slidemux-design/);
    expect(skill).toMatch(/closest|snapped/i);
  });

  it("runs mandatory design critic before review", () => {
    const skill = readWorkflowSkill();
    expect(skill).toMatch(/DESIGN CRITIC/i);
    expect(skill).toMatch(/mandatory before review|before waiting for approval/i);
    expect(skill).toMatch(/Do not modify anything/i);
    expect(skill).toMatch(/get_project/);
    expect(skill).toMatch(/Visual hierarchy/i);
    expect(skill).toMatch(/DESIGN CRITIC.*Draft ready for review/is);
  });

  it("maps natural-language steering to MCP mutations without tool names", () => {
    const skill = readWorkflowSkill();
    expect(skill).toMatch(/Never ask them to name MCP tools/i);
    expect(skill).toMatch(/Make slide 3 simpler/i);
    expect(skill).toMatch(/Remove slide 2/i);
    expect(skill).toMatch(/delete_slide/i);
    expect(skill).toMatch(/patch_text_box|add_image_box/i);
    expect(skill).toMatch(/set_slide_narration/i);
    expect(skill).not.toMatch(/no reorder tool/i);
    expect(skill).toMatch(/move_slide/);
    expect(skill).toMatch(/replace_slide_from_recipe/);
    expect(skill).toMatch(/afterSlideId/);
  });

  it("critique mode suggests without writes; fix applies last critique", () => {
    const skill = readWorkflowSkill();
    expect(skill).toMatch(/What would you improve/i);
    expect(skill).toMatch(/Do not modify anything/i);
    expect(skill).toMatch(/Fix them|Fix those things/i);
    expect(skill).toMatch(/last.*critique/i);
  });

  it("documents the six example conversation turns", () => {
    const skill = readWorkflowSkill();
    expect(skill).toMatch(/Create a tutorial showing how to create a customer case/i);
    expect(skill).toMatch(/Draft ready for review/i);
    expect(skill).toMatch(/Make slide 3 more visual and shorten the narration/i);
    expect(skill).toMatch(/remove slide 4 and add a short explanation to slide 3/i);
    expect(skill).toMatch(/Looks good, generate the video/i);
    expect(skill).toMatch(/start_generate/);
  });

  it("points draft layout at slidemux-design for type and rects", () => {
    const skill = readWorkflowSkill();
    expect(skill).toMatch(/slidemux-design/);
    expect(skill).toMatch(/0–1|0-1/);
    expect(skill).toMatch(/landscape-canonical/i);
  });

  it("runs the critic on lint_deck and preview_deck with one 1–5 scale", () => {
    const skill = readWorkflowSkill();
    expect(skill).toMatch(/lint_deck/);
    expect(skill).toMatch(/preview_deck/);
    expect(skill).toMatch(/\*\*1–5\*\*/);
    expect(skill).not.toMatch(/strong \/ okay \/ weak/);
  });
});
