import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const SKIP_DIRS = new Set(["node_modules", "dist"]);
const HEDGES = [
  "ask your operator",
  "ask the operator",
  "ask your admin",
  "ask the admin",
  "minted by a SlideMux operator",
  "Operator mints a new token",
  "minted on the invite",
  "from the invite or the account menu",
  "contact admin",
];

function listCopyFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (SKIP_DIRS.has(entry.name) || entry.name === ".git") return [];
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return listCopyFiles(full);
    if (entry.name.endsWith(".test.ts")) return [];
    return /\.(md|ts|json)$/.test(entry.name) ? [full] : [];
  });
}

describe("self-serve PAT copy", () => {
  it("does not tell invitees to ask an operator or admin for a PAT", () => {
    const offenders: string[] = [];
    for (const file of listCopyFiles(packageRoot)) {
      const text = readFileSync(file, "utf8");
      for (const hedge of HEDGES) {
        if (text.toLowerCase().includes(hedge.toLowerCase())) {
          offenders.push(`${relative(packageRoot, file)}: ${hedge}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("points mint at Sign in → Account → API tokens and SLIDEMUX_API_TOKEN", () => {
    const readme = readFileSync(join(packageRoot, "README.md"), "utf8");
    const skill = readFileSync(join(packageRoot, "skills/slidemux-video/SKILL.md"), "utf8");
    const codex = readFileSync(join(packageRoot, "CODEX.md"), "utf8");
    for (const text of [readme, skill, codex]) {
      expect(text).toContain("Account → API tokens");
      expect(text).toContain("SLIDEMUX_API_TOKEN");
    }
  });
});
