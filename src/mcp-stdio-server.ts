import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { readBundleStatus, recordPlaywrightTests, setupPlaywrightProject } from "./commands.js";
import {
  addImageBox,
  addTextBox,
  addVideoBox,
  appendSlide,
  createTopicDeck,
  layerBoxBytes,
  type TopicDeckBrandBody,
  deleteImageBox,
  deleteSlide,
  deleteTextBox,
  deleteVideoBox,
  downloadVideo,
  getEntitlements,
  getGenerateStatus,
  getProject,
  listVoices,
  patchImageBox,
  patchTextBox,
  patchVideoBox,
  setSlideNarration,
  setVoice,
  startGenerate,
  uploadRecording,
} from "./cloud-api.js";
import { appendSlideFromRecipe, lintDeck, moveSlide, replaceSlideFromRecipe } from "./cloud-api-recipe-slides.js";
import { followStartGenerateCompletion } from "./generate-completion-signal.js";
import { createMcpGenerateCompletionSink } from "./mcp-generate-completion-sink.js";
import { stdioMcpInstructions } from "./mcp-instructions.js";
import { registerStdioMcpPrompts } from "./mcp-prompts.js";
import { TOPIC_DECK_RECIPES, TOPIC_DECK_THEMES } from "./topic-deck-catalog.js";

const cwd = process.cwd();
const packageVersion = (
  JSON.parse(
    readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "package.json"), "utf8"),
  ) as { version: string }
).version;

/** Stdio MCP server (no transport). Example: `createStdioMcpServer().connect(stdio)` */
export function createStdioMcpServer(): McpServer {
  const server = new McpServer(
    { name: "slidemux", version: packageVersion },
    {
      capabilities: { resources: { listChanged: true } },
      instructions: stdioMcpInstructions(),
    },
  );
  registerSkillResources(server);
  registerStdioMcpPrompts(server);
  registerStdioTools(server);
  return server;
}

function registerStdioTools(server: McpServer): void {
  const completionSink = createMcpGenerateCompletionSink(server);
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
    async ({ projectRoot }) => jsonResult(await uploadRecording(resolveRoot(projectRoot))),
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
    "Set narration text on one slide by slideId and/or Playwright step slug (requires SLIDEMUX_API_TOKEN).",
    { projectId: z.string(), slug: z.string().optional(), slideId: z.string().optional(), text: z.string() },
    async ({ projectId, slug, slideId, text }) =>
      jsonResult(await setSlideNarration(projectId, { slug, slideId }, text)),
  );
  server.tool(
    "set_voice",
    "Persist an ElevenLabs voice `id` from list_voices (not the display name). Never Google Neural2. Requires SLIDEMUX_API_TOKEN.",
    { projectId: z.string(), voiceId: z.string() },
    async ({ projectId, voiceId }) => jsonResult(await setVoice(projectId, voiceId)),
  );
  server.tool(
    "start_generate",
    "Start ElevenLabs generate; pass list_voices `id` (not the name). Never use Google Neural2. Returns jobId immediately (requires SLIDEMUX_API_TOKEN).",
    { projectId: z.string(), voiceId: z.string().optional() },
    async ({ projectId, voiceId }) => {
      const result = await startGenerate(projectId, voiceId ? { voiceId } : {});
      void followStartGenerateCompletion(result, {
        projectId,
        reader: { read: getGenerateStatus },
        sink: completionSink,
      });
      return jsonResult(result);
    },
  );
  server.tool(
    "get_generate_status",
    "Poll generate job status and output URLs when complete (requires SLIDEMUX_API_TOKEN).",
    { projectId: z.string(), jobId: z.string() },
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

  const orientationSchema = z.enum(["landscape", "portrait"]);
  const layerRectSchema = {
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
  };
  const textBoxFieldsSchema = z.object({
    copy: z.string(),
    fontFamily: z.string(),
    fontSizePx: z.number(),
    fontWeight: z.string(),
    fontStyle: z.string(),
    fillColor: z.string(),
    textColor: z.string(),
    textAlign: z.string(),
    ...layerRectSchema,
  });
  const layerUploadSchema = z.object({
    filename: z.string(),
    base64: z.string().optional(),
    filePath: z.string().optional(),
    ...layerRectSchema,
  });

  server.tool(
    "create_topic_deck",
    "Create an empty topic studio project with title and landscape or portrait orientation. `theme` is required and chooses composition (see slidemux-design). For a product or a site, pass brand { accent, ink, ground } as #RRGGBB and brand.logo as filePath or base64. Optional themeOverride replaces style and/or backgrounds.hero|base (full sections; brand recolors last). The server paints the logo top-left with no card. A named look with no hexes snaps to the closest theme (requires SLIDEMUX_API_TOKEN).",
    {
      title: z.string(),
      orientation: orientationSchema,
      theme: z.enum(TOPIC_DECK_THEMES),
      brand: z
        .object({
          accent: z.string(),
          ink: z.string(),
          ground: z.string(),
          logo: z
            .object({
              filename: z.string(),
              filePath: z.string().optional(),
              base64: z.string().optional(),
            })
            .optional(),
        })
        .optional(),
      themeOverride: z.record(z.string(), z.unknown()).optional(),
    },
    async ({ title, orientation, theme, brand, themeOverride }) =>
      jsonResult(
        await createTopicDeck(title, orientation, theme, fetch, await stdioBrandBody(brand), themeOverride),
      ),
  );
  server.tool(
    "get_project",
    "Read a topic or Playwright project: slide ids, narration, boxes, voiceId, and orientation (requires SLIDEMUX_API_TOKEN).",
    { projectId: z.string() },
    async ({ projectId }) => jsonResult(await getProject(projectId)),
  );
  server.tool(
    "append_slide",
    "Append one blank slide at the end of the rail (requires SLIDEMUX_API_TOKEN).",
    { projectId: z.string() },
    async ({ projectId }) => jsonResult(await appendSlide(projectId)),
  );
  const recipeSlideFields = {
    recipe: z.enum(TOPIC_DECK_RECIPES),
    headline: z.string().describe("≤ 8 words (≤ 16 on quote); the only sentence on the slide."),
    kicker: z.string().optional(),
    support: z.string().optional(),
    name: z.string().optional(),
    number: z.string().optional(),
    options: z.array(z.string()).optional(),
    items: z.array(z.object({ title: z.string(), detail: z.string().optional() })).optional(),
    groundColor: z.string().optional(),
    narration: z.string().optional().describe("Spoken script for this slide; saves a set_slide_narration call."),
    upload: z
      .object({
        filename: z.string(),
        filePath: z.string().optional(),
        base64: z.string().optional(),
      })
      .optional()
      .describe("Picture for split / full-bleed / screenshot. Omit to draft with a placeholder."),
  };
  server.tool(
    "append_slide_from_recipe",
    "Append one designed, themed slide from a named recipe; the server places and fits boxes. Never repeat a recipe back to back. split, full-bleed, and screenshot take upload.filePath (placeholder when omitted). List recipes (steps, agenda, checklist, timeline, comparison) take items. Pass narration inline and afterSlideId to insert mid-deck. Result lists warnings — fix them with replace_slide_from_recipe (requires SLIDEMUX_API_TOKEN).",
    { projectId: z.string(), afterSlideId: z.string().optional(), ...recipeSlideFields },
    async ({ projectId, ...args }) => jsonResult(await appendSlideFromRecipe(projectId, args)),
  );
  server.tool(
    "replace_slide_from_recipe",
    "Rebuild one slide from a recipe in place: same id, position, and narration unless new narration is passed. Use instead of delete + append (requires SLIDEMUX_API_TOKEN).",
    { projectId: z.string(), slideId: z.string(), ...recipeSlideFields },
    async ({ projectId, slideId, ...args }) => jsonResult(await replaceSlideFromRecipe(projectId, slideId, args)),
  );
  server.tool(
    "move_slide",
    "Move one slide right after afterSlideId; omit it to move to the front (requires SLIDEMUX_API_TOKEN).",
    { projectId: z.string(), slideId: z.string(), afterSlideId: z.string().optional() },
    async ({ projectId, slideId, afterSlideId }) => jsonResult(await moveSlide(projectId, slideId, afterSlideId)),
  );
  server.tool(
    "lint_deck",
    "Server-side design check: recipe repeats, title/close bookends, variety, section breaks, placeholder pictures, missing narration. Run first in every design-critic pass (requires SLIDEMUX_API_TOKEN).",
    { projectId: z.string() },
    async ({ projectId }) => jsonResult(await lintDeck(projectId)),
  );
  server.tool(
    "delete_slide",
    "Delete one slide by id (requires SLIDEMUX_API_TOKEN).",
    { projectId: z.string(), slideId: z.string() },
    async ({ projectId, slideId }) => jsonResult(await deleteSlide(projectId, slideId)),
  );
  server.tool(
    "add_text_box",
    "Add one text box on a slide; server assigns box id (requires SLIDEMUX_API_TOKEN).",
    { projectId: z.string(), slideId: z.string(), fields: textBoxFieldsSchema },
    async ({ projectId, slideId, fields }) =>
      jsonResult(await addTextBox(projectId, slideId, fields)),
  );
  server.tool(
    "patch_text_box",
    "Patch one text box by id; only sent fields change (requires SLIDEMUX_API_TOKEN).",
    {
      projectId: z.string(),
      slideId: z.string(),
      boxId: z.string(),
      patch: textBoxFieldsSchema.partial(),
    },
    async ({ projectId, slideId, boxId, patch }) =>
      jsonResult(await patchTextBox(projectId, slideId, boxId, patch)),
  );
  server.tool(
    "delete_text_box",
    "Delete one text box by id (requires SLIDEMUX_API_TOKEN).",
    { projectId: z.string(), slideId: z.string(), boxId: z.string() },
    async ({ projectId, slideId, boxId }) =>
      jsonResult(await deleteTextBox(projectId, slideId, boxId)),
  );
  server.tool(
    "add_image_box",
    "Add one image box from a local filePath (preferred) or tiny base64 PNG/JPEG/WebP/GIF (requires SLIDEMUX_API_TOKEN).",
    { projectId: z.string(), slideId: z.string(), upload: layerUploadSchema },
    async ({ projectId, slideId, upload }) =>
      jsonResult(await addImageBox(projectId, slideId, upload)),
  );
  server.tool(
    "patch_image_box",
    "Patch one image box by id (requires SLIDEMUX_API_TOKEN).",
    {
      projectId: z.string(),
      slideId: z.string(),
      boxId: z.string(),
      patch: z.record(z.string(), z.unknown()),
    },
    async ({ projectId, slideId, boxId, patch }) =>
      jsonResult(await patchImageBox(projectId, slideId, boxId, patch)),
  );
  server.tool(
    "delete_image_box",
    "Delete one image box by id (requires SLIDEMUX_API_TOKEN).",
    { projectId: z.string(), slideId: z.string(), boxId: z.string() },
    async ({ projectId, slideId, boxId }) =>
      jsonResult(await deleteImageBox(projectId, slideId, boxId)),
  );
  server.tool(
    "add_video_box",
    "Add one video box from a local filePath (preferred) or tiny base64 MP4/WebM; one video box per slide (requires SLIDEMUX_API_TOKEN).",
    { projectId: z.string(), slideId: z.string(), upload: layerUploadSchema },
    async ({ projectId, slideId, upload }) =>
      jsonResult(await addVideoBox(projectId, slideId, upload)),
  );
  server.tool(
    "patch_video_box",
    "Patch one video box by id (requires SLIDEMUX_API_TOKEN).",
    {
      projectId: z.string(),
      slideId: z.string(),
      boxId: z.string(),
      patch: z.record(z.string(), z.unknown()),
    },
    async ({ projectId, slideId, boxId, patch }) =>
      jsonResult(await patchVideoBox(projectId, slideId, boxId, patch)),
  );
  server.tool(
    "delete_video_box",
    "Delete one video box by id (requires SLIDEMUX_API_TOKEN).",
    { projectId: z.string(), slideId: z.string(), boxId: z.string() },
    async ({ projectId, slideId, boxId }) =>
      jsonResult(await deleteVideoBox(projectId, slideId, boxId)),
  );
}

type StdioBrand = {
  accent: string;
  ink: string;
  ground: string;
  logo?: { filename: string; filePath?: string; base64?: string };
};

async function stdioBrandBody(brand: StdioBrand | undefined): Promise<TopicDeckBrandBody | undefined> {
  if (!brand) {
    return undefined;
  }
  const colors = { accent: brand.accent, ink: brand.ink, ground: brand.ground };
  if (!brand.logo) {
    return colors;
  }
  const bytes = await layerBoxBytes({ ...brand.logo, x: 0, y: 0, width: 1, height: 1 });
  return { ...colors, logo: { filename: brand.logo.filename, base64: bytes.toString("base64") } };
}

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

function registerSkillResources(target: McpServer): void {
  const files = [
    { skill: "slidemux-tutorial", file: "SKILL.md", title: "SlideMux tutorial authoring skill" },
    { skill: "slidemux-video", file: "SKILL.md", title: "SlideMux video skill" },
    { skill: "slidemux-video", file: "narration-examples.md", title: "SlideMux narration examples" },
    { skill: "slidemux-topic", file: "SKILL.md", title: "SlideMux topic deck skill" },
    { skill: "slidemux-design", file: "SKILL.md", title: "SlideMux design skill" },
    { skill: "slidemux-workflow", file: "SKILL.md", title: "SlideMux authored-slide review loop" },
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
