import { describe, expect, it } from "vitest";
import { stdioMcpInstructions } from "./mcp-instructions.js";

describe("stdio MCP instructions", () => {
  it("mentions the review loop and generate gate", () => {
    const text = stdioMcpInstructions();
    expect(text).toMatch(/plan → draft → review → steer → approve → generate/);
    expect(text).toMatch(/Do not call start_generate until the user explicitly approves/);
    expect(text).toMatch(/slidemux-design/);
    expect(text).toMatch(/slidemux-workflow/);
    expect(text).toMatch(/slidemux-tutorial.*slidemux-topic.*slidemux-design.*slidemux-workflow/);
  });

  it("keeps Playwright record loop separate", () => {
    const text = stdioMcpInstructions();
    expect(text).toMatch(/record → upload → narrate → generate/);
    expect(text).toMatch(/slidemux\.step/);
    expect(text).toContain("Path B");
    expect(text).toMatch(/play entrance/i);
    expect(text).toMatch(/no theme chrome/i);
    expect(text).toMatch(/slidemux-design/);
    expect(text).toMatch(/do not use themes/i);
    expect(text).toContain("holdMs");
    expect(text).toMatch(/Path A will accept the same shape/);
  });
});
