import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("honest MCP host matrix copy", () => {
  it("does not sell WebMCP as Codex/Claude/Cursor no-token", () => {
    const readme = readFileSync(join(packageRoot, "README.md"), "utf8");
    const skill = readFileSync(join(packageRoot, "skills/slidemux-video/SKILL.md"), "utf8");
    const codex = readFileSync(join(packageRoot, "CODEX.md"), "utf8");
    for (const text of [readme, skill, codex]) {
      expect(text).not.toContain("WebMCP is already on the page");
      expect(text).not.toContain("WebMCP is already registered on the page");
    }
    expect(codex).not.toContain("0.1.7");
    expect(codex).toContain("@slidemux/playwright@0.2.0");
    expect(readme).toContain("create_tutorial");
    expect(readme).toContain("regenerate_after_ui_change");
    expect(readme).toContain("Path B");
    expect(readme).toContain("upload_recording");
    expect(readme).toContain("holdMs");
    expect(readme).toMatch(/reuses narration \+ holdMs/);
    expect(readme).toMatch(/Maya\/deck costume/i);
    expect(readme).toMatch(/play the entrance/i);
    expect(readme).not.toContain("section-pill");
    expect(readme).not.toContain("site-pill");
    expect(readme).toContain("silent no-op");
    expect(skill).toContain("document.modelContext");
    expect(skill).toContain("/projects/:id");
    expect(skill).toContain("get_generate_status");
    expect(skill).toContain("slidemux://generate/jobs/");
    expect(skill).toContain("list_changed");
  });
});
