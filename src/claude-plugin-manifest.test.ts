import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const pluginDescription = "Your Playwright tests become your always-current tutorial videos.";

function readJson(relativePath: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(packageRoot, relativePath), "utf8")) as Record<string, unknown>;
}

describe("plugin manifests", () => {
  it("pins Claude plugin version to package.json", () => {
    const pkg = readJson("package.json");
    const plugin = readJson(".claude-plugin/plugin.json");
    expect(plugin.name).toBe("slidemux");
    expect(plugin.version).toBe(pkg.version);
    expect(plugin.description).toBe(pluginDescription);
    expect(pkg.description).toBe(pluginDescription);
  });

  it("ships plugin files in the npm tarball", () => {
    const pkg = readJson("package.json");
    expect(pkg.files).toEqual([
      "dist",
      "skills",
      "README.md",
      ".claude-plugin",
      ".cursor-plugin",
      ".mcp.json",
      "mcp.json",
    ]);
  });

  it("pins MCP npx spec to package name and version", () => {
    const pkg = readJson("package.json");
    const mcp = readJson(".mcp.json");
    const npmSpec = `${pkg.name}@${pkg.version}`;
    const servers = mcp.mcpServers as { slidemux: { command: string; args: string[]; env: Record<string, string> } };
    expect(servers.slidemux.command).toBe("npx");
    expect(servers.slidemux.args).toEqual(["-y", "-p", npmSpec, "slidemux-mcp"]);
    expect(servers.slidemux.env.SLIDEMUX_API_URL).toBe("https://slidemux.com");
    expect(servers.slidemux.env.SLIDEMUX_API_TOKEN).toBe("${SLIDEMUX_API_TOKEN}");
  });

  it("documents the pinned npm spec on the agents URL", () => {
    const pkg = readJson("package.json");
    const npmSpec = `${pkg.name}@${pkg.version}`;
    const readme = readFileSync(join(packageRoot, "README.md"), "utf8");
    expect(readme).toContain(npmSpec);
    expect(readme).toContain("https://slidemux.com/agents");
    expect(readme).not.toContain("https://slidemux.com/playwright");
    expect(readme.match(/@slidemux\/playwright@\d+\.\d+\.\d+/g)).toEqual([npmSpec]);
  });

  it("lists this directory as the Claude marketplace plugin root", () => {
    const pkg = readJson("package.json");
    const marketplace = readJson(".claude-plugin/marketplace.json");
    const listed = (marketplace.plugins as { name: string; source: string; version: string }[])[0];
    expect(listed).toEqual({
      name: "slidemux",
      source: "./",
      version: pkg.version,
      description: pluginDescription,
    });
  });

  it("keeps the monorepo marketplace pointed at this package when present", () => {
    const path = join(packageRoot, "../../.claude-plugin/marketplace.json");
    if (!existsSync(path)) return;
    const pkg = readJson("package.json");
    const marketplace = JSON.parse(readFileSync(path, "utf8")) as {
      plugins: { name: string; source: string; version: string; description: string }[];
    };
    expect(marketplace.plugins[0]).toEqual({
      name: "slidemux",
      source: "./packages/slidemux-playwright",
      version: pkg.version,
      description: pluginDescription,
    });
  });

  it("ships mcp.json identical to .mcp.json for Cursor discovery", () => {
    const pkg = readJson("package.json");
    expect(pkg.files).toContain("mcp.json");
    expect(readJson("mcp.json")).toEqual(readJson(".mcp.json"));
  });

  it("ships a Cursor plugin manifest with a PAT variable", () => {
    const pkg = readJson("package.json");
    const cursor = readJson(".cursor-plugin/plugin.json");
    const claude = readJson(".claude-plugin/plugin.json");
    expect(pkg.files).toContain(".cursor-plugin");
    expect(cursor.name).toBe("slidemux");
    expect(cursor.version).toBe(pkg.version);
    expect(cursor.description).toBe(claude.description);
    const variables = cursor.variables as {
      type: string;
      required: string[];
      properties: Record<string, { type: string }>;
    };
    expect(variables.type).toBe("object");
    expect(variables.required).toEqual(["SLIDEMUX_API_TOKEN"]);
    expect(variables.properties.SLIDEMUX_API_TOKEN.type).toBe("string");
  });

  it("documents GitHub marketplace install", () => {
    const readme = readFileSync(join(packageRoot, "README.md"), "utf8");
    expect(readme).toContain("/plugin marketplace add youryss/slidemux");
    expect(readme).toContain("~/.cursor/plugins/local/slidemux");
  });
});
