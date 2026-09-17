import { access, readFile, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { patchPlaywrightConfig } from "./setup-config.js";
import { DEFAULT_BUNDLE_DIR } from "./env.js";
import { parseManifest, type SlidemuxManifest } from "./manifest.js";

const packageJson = JSON.parse(
  readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "package.json"), "utf8"),
) as { name: string; version: string };

/** npm spec `setup_playwright` installs so user projects do not float to latest. */
export function playwrightNpmSpec(): string {
  return `${packageJson.name}@${packageJson.version}`;
}

/** Windows needs `npx.cmd`/`npm.cmd`; using those keeps spawn `shell: false`. */
export function cliExecutable(command: string, platform: NodeJS.Platform = process.platform): string {
  if (platform !== "win32" || command.endsWith(".cmd") || command.endsWith(".exe")) {
    return command;
  }
  return `${command}.cmd`;
}

export async function setupPlaywrightProject(projectRoot: string): Promise<string> {
  const configPath = await findPlaywrightConfig(projectRoot);
  if (!configPath) {
    throw new Error(
      `No playwright.config.ts/js in ${projectRoot}; expected a Playwright project before setup_playwright`,
    );
  }

  const source = await readFile(configPath, "utf8");
  const patched = patchPlaywrightConfig(source);
  if (patched.changed) {
    await writeFile(configPath, patched.next);
  }

  await installPackage(projectRoot);
  return patched.changed
    ? `Patched ${path.relative(projectRoot, configPath)} and installed @slidemux/playwright. Import test from "@slidemux/playwright" and wrap actions in slidemux.step("slug", fn).`
    : `@slidemux/playwright is already configured in ${path.relative(projectRoot, configPath)}.`;
}

export async function findPlaywrightConfig(projectRoot: string): Promise<string | null> {
  const names = ["playwright.config.ts", "playwright.config.mts", "playwright.config.js", "playwright.config.mjs"];
  for (const name of names) {
    const candidate = path.join(projectRoot, name);
    try {
      await access(candidate);
      return candidate;
    } catch {
      continue;
    }
  }
  return null;
}

export async function recordPlaywrightTests(
  projectRoot: string,
  options: { grep?: string; file?: string } = {},
): Promise<{ code: number; log: string }> {
  const args = ["playwright", "test"];
  if (options.file) {
    args.push(options.file);
  }
  if (options.grep) {
    args.push("--grep", options.grep);
  }

  return runCommand("npx", args, projectRoot, { SLIDEMUX: "1" });
}

export async function readBundleStatus(projectRoot: string): Promise<SlidemuxManifest> {
  const manifestPath = path.join(projectRoot, DEFAULT_BUNDLE_DIR, "manifest.json");
  const raw = await readFile(manifestPath, "utf8").catch(() => null);
  if (!raw) {
    throw new Error(
      `No SlideMux bundle at ${manifestPath}. Run record_test with SLIDEMUX=1 after wrapping tests in slidemux.step().`,
    );
  }
  return parseManifest(JSON.parse(raw));
}

async function installPackage(projectRoot: string): Promise<void> {
  try {
    await access(path.join(projectRoot, "node_modules/@slidemux/playwright"));
    return;
  } catch {
    // not installed yet
  }
  const result = await runCommand("npm", ["install", "-D", playwrightNpmSpec()], projectRoot);
  if (result.code !== 0) {
    throw new Error(`npm install @slidemux/playwright failed:\n${result.log}`);
  }
}

/** Drop host Playwright worker vars and the cloud PAT so nested test logs cannot leak it. */
export function playwrightChildEnv(
  parent: NodeJS.ProcessEnv,
  extra: Record<string, string> = {},
): NodeJS.ProcessEnv {
  const env = { ...parent, ...extra };
  for (const key of Object.keys(env)) {
    if (key === "PLAYWRIGHT_BROWSERS_PATH") {
      continue;
    }
    if (
      key.startsWith("PW_") ||
      key.startsWith("PLAYWRIGHT_") ||
      key === "TEST_WORKER_INDEX" ||
      key === "TEST_PARALLEL_INDEX"
    ) {
      delete env[key];
    }
  }
  delete env.SLIDEMUX_API_TOKEN;
  return env;
}

function runCommand(
  command: string,
  args: string[],
  cwd: string,
  extraEnv: Record<string, string> = {},
): Promise<{ code: number; log: string }> {
  return new Promise((resolve) => {
    const child = spawn(cliExecutable(command), args, {
      cwd,
      env: playwrightChildEnv(process.env, extraEnv),
      shell: false,
      windowsHide: true,
    });
    let log = "";
    child.stdout.on("data", (chunk) => {
      log += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      log += String(chunk);
    });
    child.on("close", (code) => {
      resolve({ code: code ?? 1, log });
    });
  });
}
