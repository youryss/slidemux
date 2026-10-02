const WORKFLOW_SKILL = "skill://slidemux/slidemux-workflow/SKILL.md";
const TUTORIAL_SKILL = "skill://slidemux/slidemux-tutorial/SKILL.md";
const TOPIC_SKILL = "skill://slidemux/slidemux-topic/SKILL.md";
const DESIGN_SKILL = "skill://slidemux/slidemux-design/SKILL.md";
const VIDEO_SKILL = "skill://slidemux/slidemux-video/SKILL.md";

/** Stdio MCP server instructions. Example: `stdioMcpInstructions()` */
export function stdioMcpInstructions(): string {
  return (
    "Authored slides (tutorials, subject decks): read " +
    `${TUTORIAL_SKILL} or ${TOPIC_SKILL}, then ${DESIGN_SKILL}, then ${WORKFLOW_SKILL} — ` +
    "plan → draft → review → steer → approve → generate. " +
    "Do not call start_generate until the user explicitly approves. " +
    "App tours (Path B film): invent a one-off stage (read slidemux-design for patterns, " +
    "brand tokens, and sync — do not use themes), read slidemux-video, then " +
    "record → upload → narrate → generate. Sync: open slidemux.step → play " +
    "entrance → settle → hold to narration. Shared beat list is " +
    "{ slug, narration, holdMs } — Path A will accept the same shape; reuse " +
    "narration and holdMs when swapping intake. No mid-animation start, no dead-air " +
    "holds, no theme chrome. Never change the visible screen between slidemux.step() " +
    "calls — gaps can inherit the previous narration."
  );
}

/** Hosted HTTP MCP server instructions. Example: `hostedMcpInstructions()` */
export function hostedMcpInstructions(): string {
  return (
    "Remote SlideMux MCP: cloud convert-loop tools. " +
    "Authored slides: read " +
    `${TUTORIAL_SKILL} or ${TOPIC_SKILL}, then ${DESIGN_SKILL}, then ${WORKFLOW_SKILL} — ` +
    "plan → draft → review → steer → approve → generate. " +
    "Do not call start_generate until the user explicitly approves. " +
    "App tutorials (Path B): invent a one-off stage (not a theme), record " +
    `Playwright locally (stdio), read ${VIDEO_SKILL} (step → play entrance → ` +
    "settle → hold), then upload → narrate → generate."
  );
}

export const MCP_SKILL_URIS = {
  workflow: WORKFLOW_SKILL,
  tutorial: TUTORIAL_SKILL,
  topic: TOPIC_SKILL,
  design: DESIGN_SKILL,
  video: VIDEO_SKILL,
} as const;
