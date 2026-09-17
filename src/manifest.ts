import { assertRelativePath } from "./contained-path.js";

export type SlidemuxStepMark = {
  slug: string;
  startMs: number;
  endMs: number;
};

export type SlidemuxClip = {
  slug: string;
  startMs: number;
  endMs: number;
  file: string | null;
};

export type SlidemuxTestBundle = {
  title: string;
  file: string;
  video: string | null;
  steps: SlidemuxClip[];
};

export type SlidemuxManifest = {
  schemaVersion: 1;
  outputDir: string;
  tests: SlidemuxTestBundle[];
};

export function emptyManifest(outputDir: string): SlidemuxManifest {
  return { schemaVersion: 1, outputDir, tests: [] };
}

export function parseManifest(raw: unknown): SlidemuxManifest {
  if (!raw || typeof raw !== "object") {
    throw new Error(`slidemux manifest must be an object, got ${JSON.stringify(raw)}`);
  }
  const record = raw as Record<string, unknown>;
  if (record.schemaVersion !== 1) {
    throw new Error(`unsupported slidemux manifest schemaVersion ${JSON.stringify(record.schemaVersion)}`);
  }
  if (typeof record.outputDir !== "string" || record.outputDir.length === 0) {
    throw new Error(`manifest.outputDir must be a non-empty string, got ${JSON.stringify(record.outputDir)}`);
  }
  assertRelativePath(record.outputDir, "manifest.outputDir");
  if (!Array.isArray(record.tests)) {
    throw new Error(`manifest.tests must be an array, got ${JSON.stringify(record.tests)}`);
  }
  return {
    schemaVersion: 1,
    outputDir: record.outputDir,
    tests: record.tests.map((test, index) => parseTestBundle(test, index)),
  };
}

function parseTestBundle(raw: unknown, index: number): SlidemuxTestBundle {
  if (!raw || typeof raw !== "object") {
    throw new Error(`manifest.tests[${index}] must be an object`);
  }
  const record = raw as Record<string, unknown>;
  if (typeof record.title !== "string") {
    throw new Error(`manifest.tests[${index}].title must be a string`);
  }
  if (typeof record.file !== "string") {
    throw new Error(`manifest.tests[${index}].file must be a string`);
  }
  if (record.video !== null && typeof record.video !== "string") {
    throw new Error(`manifest.tests[${index}].video must be a string or null`);
  }
  if (!Array.isArray(record.steps)) {
    throw new Error(`manifest.tests[${index}].steps must be an array`);
  }
  return {
    title: record.title,
    file: record.file,
    video: record.video,
    steps: record.steps.map((step, stepIndex) => parseClip(step, index, stepIndex)),
  };
}

function parseClip(raw: unknown, testIndex: number, stepIndex: number): SlidemuxClip {
  if (!raw || typeof raw !== "object") {
    throw new Error(`manifest.tests[${testIndex}].steps[${stepIndex}] must be an object`);
  }
  const record = raw as Record<string, unknown>;
  if (typeof record.slug !== "string" || record.slug.length === 0) {
    throw new Error(`step slug must be a non-empty string at tests[${testIndex}].steps[${stepIndex}]`);
  }
  if (typeof record.startMs !== "number" || typeof record.endMs !== "number") {
    throw new Error(`step startMs/endMs must be numbers for slug ${record.slug}`);
  }
  if (record.file !== null && typeof record.file !== "string") {
    throw new Error(`step file must be a string or null for slug ${record.slug}`);
  }
  if (typeof record.file === "string") {
    assertRelativePath(record.file, `step file for slug ${record.slug}`);
  }
  return {
    slug: record.slug,
    startMs: record.startMs,
    endMs: record.endMs,
    file: record.file,
  };
}

/** ffmpeg args to cut one step clip from a recorded webm. */
export function buildStepClipArgs(
  webmPath: string,
  mp4Path: string,
  startMs: number,
  endMs: number,
): string[] {
  const startSec = (Math.max(0, startMs) / 1000).toFixed(3);
  const durationSec = Math.max(0.4, (endMs - startMs) / 1000).toFixed(3);
  return [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-i",
    webmPath,
    "-ss",
    startSec,
    "-t",
    durationSec,
    "-an",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    mp4Path,
  ];
}
