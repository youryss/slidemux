import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { cliExecutable, playwrightChildEnv, playwrightNpmSpec } from "./commands.js";

describe("playwrightChildEnv", () => {
  it("strips host Playwright worker env and keeps browsers path plus extras", () => {
    const env = playwrightChildEnv(
      {
        PATH: "/usr/bin",
        PW_TEST_SOURCE_TRANSFORM: "/tmp/transform.js",
        PLAYWRIGHT_TEST_BASE_TEST_ID: "abc",
        PLAYWRIGHT_BROWSERS_PATH: "/browsers",
        TEST_WORKER_INDEX: "0",
      },
      { SLIDEMUX: "1" },
    );
    expect(env.PATH).toBe("/usr/bin");
    expect(env.SLIDEMUX).toBe("1");
    expect(env.PLAYWRIGHT_BROWSERS_PATH).toBe("/browsers");
    expect(env.PW_TEST_SOURCE_TRANSFORM).toBeUndefined();
    expect(env.PLAYWRIGHT_TEST_BASE_TEST_ID).toBeUndefined();
    expect(env.TEST_WORKER_INDEX).toBeUndefined();
  });

  it("drops SLIDEMUX_API_TOKEN so a Playwright spec cannot leak the PAT", () => {
    const env = playwrightChildEnv(
      { PATH: "/usr/bin", SLIDEMUX_API_TOKEN: "pat_secret" },
      { SLIDEMUX: "1", SLIDEMUX_API_TOKEN: "pat_from_extra" },
    );
    expect(env.SLIDEMUX).toBe("1");
    expect(env.PATH).toBe("/usr/bin");
    expect(env.SLIDEMUX_API_TOKEN).toBeUndefined();
  });
});

describe("playwrightNpmSpec", () => {
  it("pins setup_playwright to this package name and version", () => {
    const pkg = JSON.parse(
      readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "package.json"), "utf8"),
    ) as { name: string; version: string };
    expect(playwrightNpmSpec()).toBe(`${pkg.name}@${pkg.version}`);
  });
});

describe("cliExecutable", () => {
  it("uses the bare command on Unix so spawn can run with shell:false", () => {
    expect(cliExecutable("npx", "darwin")).toBe("npx");
    expect(cliExecutable("npm", "linux")).toBe("npm");
  });

  it("uses the .cmd shim on Windows instead of shell:true", () => {
    expect(cliExecutable("npx", "win32")).toBe("npx.cmd");
    expect(cliExecutable("npm", "win32")).toBe("npm.cmd");
  });
});
