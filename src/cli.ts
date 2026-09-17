#!/usr/bin/env node
import { readBundleStatus, recordPlaywrightTests, setupPlaywrightProject } from "./commands.js";
import { publishRecording } from "./publish.js";

const [command, ...rest] = process.argv.slice(2);

try {
  await runCli(command, rest);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
}

async function runCli(command: string | undefined, args: string[]): Promise<void> {
  if (command === "setup") {
    console.log(await setupPlaywrightProject(process.cwd()));
    return;
  }
  if (command === "record") {
    const result = await recordPlaywrightTests(process.cwd(), parseRecordArgs(args));
    process.stdout.write(result.log);
    process.exitCode = result.code;
    return;
  }
  if (command === "status") {
    console.log(JSON.stringify(await readBundleStatus(process.cwd()), null, 2));
    return;
  }
  if (command === "publish") {
    const flags = parseFlags(args, ["--voice", "--out"]);
    const published = await publishRecording({
      projectRoot: process.cwd(),
      voiceId: flags["--voice"],
      outDir: flags["--out"],
    });
    for (const project of published) {
      console.log(`${project.editorUrl} -> ${project.outputPath} (${project.bytes} bytes)`);
    }
    return;
  }
  printUsage();
  process.exitCode = command ? 1 : 0;
}

function parseRecordArgs(args: string[]): { grep?: string; file?: string } {
  const flags = parseFlags(args, ["--grep", "--file"]);
  return { grep: flags["--grep"], file: flags["--file"] };
}

function parseFlags(args: string[], names: readonly string[]): Record<string, string | undefined> {
  const flags: Record<string, string | undefined> = {};
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    const value = args[index + 1];
    if (flag && names.includes(flag) && value) {
      flags[flag] = value;
      index += 1;
    }
  }
  return flags;
}

function printUsage(): void {
  console.log(`slidemux setup
slidemux record [--file spec.ts] [--grep title]
slidemux status
slidemux publish [--voice elevenlabsVoiceId] [--out dir]   # upload -> generate -> poll -> download (needs SLIDEMUX_API_TOKEN, SLIDEMUX_API_URL)

MCP: npx -y -p @slidemux/playwright slidemux-mcp
`);
}
