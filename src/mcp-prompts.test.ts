import { describe, expect, it } from "vitest";
import {
  createTopicPresentationPrompt,
  createTutorialPrompt,
  regenerateAfterUiChangePrompt,
  stdioMcpPromptCatalog,
} from "./mcp-prompts.js";

describe("stdio MCP prompts", () => {
  it("lists create_tutorial, create_topic_presentation, and regenerate_after_ui_change", () => {
    expect(stdioMcpPromptCatalog.map((row) => row.name)).toEqual([
      "create_tutorial",
      "create_topic_presentation",
      "regenerate_after_ui_change",
    ]);
  });

  it("tells create_tutorial to read skills then record upload generate", async () => {
    const result = await createTutorialPrompt({ product: "Acme", language: "English" });
    const text = result.messages.map((m) => JSON.stringify(m)).join("\n");
    expect(text).toContain("skill://slidemux/slidemux-tutorial/SKILL.md");
    expect(text).toContain("skill://slidemux/slidemux-video/SKILL.md");
    expect(text).toContain("Acme");
    expect(text).toContain("English");
    expect(text).toMatch(/record/i);
    expect(text).toMatch(/upload/i);
    expect(text).toMatch(/generate/i);
  });

  it("tells create_topic_presentation to read topic, design, and workflow skills then wait for approval", async () => {
    const result = await createTopicPresentationPrompt({
      topic: "history of coffee",
      language: "English",
    });
    const text = result.messages.map((m) => JSON.stringify(m)).join("\n");
    expect(text).toContain("skill://slidemux/slidemux-topic/SKILL.md");
    expect(text).toContain("skill://slidemux/slidemux-design/SKILL.md");
    expect(text).toContain("skill://slidemux/slidemux-workflow/SKILL.md");
    expect(text).toContain("history of coffee");
    expect(text).toContain("English");
    expect(text).toMatch(/plan → draft → wait for review/i);
    expect(text).toMatch(/explicitly approves/i);
    expect(text).not.toMatch(/generate once/i);
  });

  it("tells regenerate_after_ui_change to keep narration on unchanged slugs", async () => {
    const result = await regenerateAfterUiChangePrompt({ product: "Acme" });
    const text = result.messages.map((m) => JSON.stringify(m)).join("\n");
    expect(text).toContain("skill://slidemux/slidemux-video/SKILL.md");
    expect(text).not.toContain("skill://slidemux/slidemux-design/SKILL.md");
    expect(text).toContain("Acme");
    expect(text).toMatch(/re-?record/i);
    expect(text).toMatch(/slug/i);
    expect(text).toContain("holdMs");
  });

  it("does not mention design skill in Playwright tutorial prompt", async () => {
    const result = await createTutorialPrompt({ product: "Acme", language: "English" });
    const text = result.messages.map((m) => JSON.stringify(m)).join("\n");
    expect(text).not.toContain("skill://slidemux/slidemux-design/SKILL.md");
  });
});
