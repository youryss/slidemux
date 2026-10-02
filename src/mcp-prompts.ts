import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { MCP_SKILL_URIS } from "./mcp-instructions.js";

const {
  tutorial: TUTORIAL_SKILL,
  video: VIDEO_SKILL,
  topic: TOPIC_SKILL,
  design: DESIGN_SKILL,
  workflow: WORKFLOW_SKILL,
} = MCP_SKILL_URIS;

export type StdioPromptMessages = {
  messages: Array<{ role: "user"; content: { type: "text"; text: string } }>;
};

export const createTutorialArgs = {
  product: z.string(),
  language: z.string(),
};

export const regenerateAfterUiChangeArgs = {
  product: z.string(),
  language: z.string().optional(),
};

/** First-video workflow: read shipped skills, then the existing stdio convert loop. */
export async function createTutorialPrompt(args: {
  product: string;
  language: string;
}): Promise<StdioPromptMessages> {
  return userPrompt(
    `Path B filmed walkthrough of ${args.product} in ${args.language}: invent a one-off stage, not a theme. ` +
      `First read ${VIDEO_SKILL} (sync: step → play entrance → settle → hold), then ${TUTORIAL_SKILL} only if they wanted authored slides instead. ` +
      `Then record → upload → narrate → generate → download with existing stdio tools. ` +
      `Cloud tools need SLIDEMUX_API_TOKEN; local record does not.`,
  );
}

/** Subject presentation: read topic skill, brief gate, then topic-deck convert loop. */
export async function createTopicPresentationPrompt(args: {
  topic: string;
  language: string;
}): Promise<StdioPromptMessages> {
  return userPrompt(
    `Make a presentation about ${args.topic} in ${args.language}. ` +
      `First read ${TOPIC_SKILL}, ${DESIGN_SKILL}, and ${WORKFLOW_SKILL}. Ask only for missing brief fields ` +
      `(topic, orientation, language). You choose the deck theme (snap to the closest id if they named a look without hexes) and name it in the plan. For a product site, pass brand accent, ink, ground, and logo. Then plan → draft → wait for review. ` +
      `Generate only when the user explicitly approves. Cloud tools need SLIDEMUX_API_TOKEN.`,
  );
}

/** UI-changed workflow: re-record, upsert, keep narration on unchanged slugs. */
export async function regenerateAfterUiChangePrompt(args: {
  product: string;
  language?: string;
}): Promise<StdioPromptMessages> {
  const languageLine = args.language ? ` Narrate in ${args.language}.` : "";
  return userPrompt(
    `The UI for ${args.product} changed.${languageLine} Read ${VIDEO_SKILL}. ` +
      `Update the Playwright test, re-record, upload (keep narration and holdMs on unchanged slugs, script new slugs), generate, download.`,
  );
}

export const createTopicPresentationArgs = {
  topic: z.string(),
  language: z.string(),
};

export const stdioMcpPromptCatalog = [
  {
    name: "create_tutorial",
    description: "Create a narrated tutorial from a Playwright flow (stdio + PAT).",
    argsSchema: createTutorialArgs,
    callback: createTutorialPrompt,
  },
  {
    name: "create_topic_presentation",
    description: "Build a narrated presentation about a subject (stdio + PAT).",
    argsSchema: createTopicPresentationArgs,
    callback: createTopicPresentationPrompt,
  },
  {
    name: "regenerate_after_ui_change",
    description: "Re-record and regenerate after a UI change; keep narration and holdMs on unchanged slugs.",
    argsSchema: regenerateAfterUiChangeArgs,
    callback: regenerateAfterUiChangePrompt,
  },
] as const;

/** Registers stdio-only MCP prompts. Example: `registerStdioMcpPrompts(server)`. */
export function registerStdioMcpPrompts(server: McpServer): void {
  server.registerPrompt(
    "create_tutorial",
    {
      description: stdioMcpPromptCatalog[0].description,
      argsSchema: createTutorialArgs,
    },
    (args) => createTutorialPrompt(args),
  );
  server.registerPrompt(
    "create_topic_presentation",
    {
      description: stdioMcpPromptCatalog[1].description,
      argsSchema: createTopicPresentationArgs,
    },
    (args) => createTopicPresentationPrompt(args),
  );
  server.registerPrompt(
    "regenerate_after_ui_change",
    {
      description: stdioMcpPromptCatalog[2].description,
      argsSchema: regenerateAfterUiChangeArgs,
    },
    (args) => regenerateAfterUiChangePrompt(args),
  );
}

function userPrompt(text: string): StdioPromptMessages {
  return { messages: [{ role: "user", content: { type: "text", text } }] };
}
