import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = path.join(packageDir, "src");
const RELATIVE_IMPORT = /from\s+["'](\.{1,2}\/[^"']+)["']|import\(\s*["'](\.{1,2}\/[^"']+)["']\s*\)/g;

async function listSourceFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) =>
      entry.isDirectory() ? listSourceFiles(path.join(dir, entry.name)) : [path.join(dir, entry.name)],
    ),
  );
  return nested.flat().filter((file) => file.endsWith(".ts"));
}

/** Cursor Marketplace needs this package as a standalone repo (PRD 62); no import may reach into the monorepo. */
describe("package boundary", () => {
  it("has no relative import that resolves outside packages/slidemux-playwright", async () => {
    const offenders: string[] = [];
    for (const file of await listSourceFiles(srcDir)) {
      const source = await readFile(file, "utf8");
      for (const match of source.matchAll(RELATIVE_IMPORT)) {
        const specifier = match[1] ?? match[2] ?? "";
        const resolved = path.resolve(path.dirname(file), specifier);
        if (!resolved.startsWith(packageDir + path.sep)) {
          offenders.push(`${path.relative(packageDir, file)} -> ${specifier}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
