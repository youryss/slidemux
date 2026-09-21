#!/usr/bin/env node
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readBundleStatus, recordPlaywrightTests, setupPlaywrightProject } from "./commands.js";
import {
  downloadVideo,
  getEntitlements,
  getGenerateStatus,
  listVoices,
  setSlideNarration,
  setVoice,
  startGenerate,
  uploadRecording,
} from "./cloud-api.js";

const cwd = process.cwd();
const packageVersion = (
  JSON.parse(
    readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "package.json"), "utf8"),
  ) as { version: string }
).version;
const server = new McpServer(
  { name: "slidemux", version: packageVersion },
  {
    instructions:
      "When creating or redesigning tutorial slides, first read the slidemux-tutorial skill " +
      "(skill://slidemux/slidemux-tutorial/SKILL.md). To turn the approved source into a narrated " +
      "video, read the slidemux-video skill (skill://slidemux/slidemux-video/SKILL.md), then follow " +
      "its record -> upload -> narrate -> generate pipeline. Never change the visible screen " +
      "between slidemux.step() calls — gaps can inherit the previous narration.",
  },
);

registerSkillResources(server);

server.tool(
  "setup_playwright",
  "Add @slidemux/playwright to this repo's Playwright config so tests can use slidemux.step().",
  { projectRoot: z.string().optional() },
  async ({ projectRoot }) => textResult(await setupPlaywrightProject(resolveRoot(projectRoot))),
);

server.tool(
  "record_test",
  "Run Playwright with SLIDEMUX=1 so passed tests write test-results/slidemux/manifest.json and step MP4s.",
  {
    projectRoot: z.string().optional(),
    file: z.string().optional(),
    grep: z.string().optional(),
  },
  async ({ projectRoot, file, grep }) => {
    const result = await recordPlaywrightTests(resolveRoot(projectRoot), { file, grep });
    return textResult(`exit ${result.code}\n${result.log}`);
  },
);

server.tool(
  "get_bundle_status",
  "Read the last SlideMux recording bundle (manifest + per-step clip files).",
  { projectRoot: z.string().optional() },
  async ({ projectRoot }) =>
    textResult(JSON.stringify(await readBundleStatus(resolveRoot(projectRoot)), null, 2)),
);

server.tool(
  "upload_recording",
  "Upload the last local SlideMux bundle to SlideMux (requires SLIDEMUX_API_TOKEN).",
  { projectRoot: z.string().optional() },
  async ({ projectRoot }) =>
    jsonResult(await uploadRecording(resolveRoot(projectRoot))),
);

server.tool(
  "list_voices",
  "List ElevenLabs TTS voices. Use each row's `id`. Pick a row that matches the narration language the user asked for. Lily (pFZP5JQG7iQjIQuC4Bku) is the English default only.",
  {},
  async () => jsonResult(await listVoices()),
);

server.tool(
  "get_entitlements",
  "Read invite quota: lifetime videos, slide cap, regenerates (requires SLIDEMUX_API_TOKEN).",
  { projectId: z.string().optional() },
  async ({ projectId }) => jsonResult(await getEntitlements(projectId)),
);

server.tool(
  "set_slide_narration",
  "Set narration text on one slide by Playwright step slug (requires SLIDEMUX_API_TOKEN).",
  {
    projectId: z.string(),
    slug: z.string(),
    text: z.string(),
  },
  async ({ projectId, slug, text }) => jsonResult(await setSlideNarration(projectId, slug, text)),
);

server.tool(
  "set_voice",
  "Persist an ElevenLabs voice `id` from list_voices (not the display name). Never Google Neural2. Requires SLIDEMUX_API_TOKEN.",
  {
    projectId: z.string(),
    voiceId: z.string(),
  },
  async ({ projectId, voiceId }) => jsonResult(await setVoice(projectId, voiceId)),
);

server.tool(
  "start_generate",
  "Start ElevenLabs generate; pass list_voices `id` (not the name). Never use Google Neural2. Returns jobId immediately (requires SLIDEMUX_API_TOKEN).",
  {
    projectId: z.string(),
    voiceId: z.string().optional(),
  },
  async ({ projectId, voiceId }) => {
    const body = voiceId ? { voiceId } : {};
    return jsonResult(await startGenerate(projectId, body));
  },
);

server.tool(
  "get_generate_status",
  "Poll generate job status and output URLs when complete (requires SLIDEMUX_API_TOKEN).",
  {
    projectId: z.string(),
    jobId: z.string(),
  },
  async ({ projectId, jobId }) => jsonResult(await getGenerateStatus(projectId, jobId)),
);

server.tool(
  "download_video",
  "Save the finished MP4 for a project to disk (default test-results/slidemux/<projectId>.mp4). Fails if there is no completed output; never starts a generate. Requires SLIDEMUX_API_TOKEN.",
  {
    projectId: z.string(),
    projectRoot: z.string().optional(),
    outPath: z.string().optional(),
  },
  async ({ projectId, projectRoot, outPath }) =>
    jsonResult(await downloadVideo(projectId, { projectRoot: resolveRoot(projectRoot), outPath })),
);

await server.connect(new StdioServerTransport());

function textResult(text: string): { content: Array<{ type: "text"; text: string }> } {
  return { content: [{ type: "text", text }] };
}

function jsonResult(value: unknown): { content: Array<{ type: "text"; text: string }> } {
  return textResult(JSON.stringify(value, null, 2));
}

function resolveRoot(value: string | undefined): string {
  if (!value) {
    return cwd;
  }
  return path.resolve(cwd, value);
}

/** Ships SlideMux skills so any MCP client can read them on demand. */
function registerSkillResources(target: McpServer): void {
  const files = [
    { skill: "slidemux-tutorial", file: "SKILL.md", title: "SlideMux tutorial authoring skill" },
    { skill: "slidemux-video", file: "SKILL.md", title: "SlideMux video skill" },
    { skill: "slidemux-video", file: "narration-examples.md", title: "SlideMux narration examples" },
  ];
  const skillsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "skills");
  for (const { skill, file, title } of files) {
    const uri = `skill://slidemux/${skill}/${file}`;
    target.registerResource(
      `${skill}-${file}`,
      uri,
      { title, mimeType: "text/markdown" },
      async () => ({
        contents: [{
          uri,
          mimeType: "text/markdown",
          text: readFileSync(path.join(skillsDir, skill, file), "utf8"),
        }],
      }),
    );
  }
}
