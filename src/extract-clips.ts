import { execFile } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { buildStepClipArgs, type SlidemuxClip, type SlidemuxStepMark } from "./manifest.js";

const execFileAsync = promisify(execFile);

export function sanitizeSlug(slug: string): string {
  const cleaned = slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (!cleaned) {
    throw new Error(`step slug must contain letters or digits, got ${JSON.stringify(slug)}`);
  }
  return cleaned;
}

/** Video duration in ms via ffprobe, or null when the probe fails. */
export async function probeVideoDurationMs(videoPath: string): Promise<number | null> {
  try {
    const { stdout } = await execFileAsync("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "csv=p=0",
      videoPath,
    ]);
    const seconds = Number.parseFloat(stdout.trim());
    return Number.isFinite(seconds) ? Math.round(seconds * 1000) : null;
  } catch {
    return null;
  }
}

/**
 * Shift step marks so they index into the real video timeline. The video
 * starts before the recorder's origin (the page exists first), so marks are
 * early by videoDurationMs - elapsedAtAttachMs.
 * ponytail: assumes the video ends ~when attachSteps ran; context teardown
 * after attach adds tens of ms of late shift. Upgrade path: probe the video
 * start timestamp instead of the duration.
 */
export function alignStepMarks(
  steps: SlidemuxStepMark[],
  elapsedAtAttachMs: number | null,
  videoDurationMs: number | null,
): SlidemuxStepMark[] {
  if (elapsedAtAttachMs === null || videoDurationMs === null) {
    return steps;
  }
  const offsetMs = Math.max(0, videoDurationMs - elapsedAtAttachMs);
  return steps.map((step) => ({
    ...step,
    startMs: step.startMs + offsetMs,
    endMs: step.endMs + offsetMs,
  }));
}

export async function extractStepClips(
  webmPath: string,
  outputDir: string,
  steps: SlidemuxStepMark[],
): Promise<SlidemuxClip[]> {
  await mkdir(outputDir, { recursive: true });
  const clips: SlidemuxClip[] = [];
  for (const step of steps) {
    const slug = sanitizeSlug(step.slug);
    const file = `${slug}.mp4`;
    const mp4Path = path.join(outputDir, file);
    try {
      await execFileAsync("ffmpeg", buildStepClipArgs(webmPath, mp4Path, step.startMs, step.endMs));
      clips.push({ ...step, slug, file });
    } catch {
      clips.push({ ...step, slug, file: null });
    }
  }
  return clips;
}
