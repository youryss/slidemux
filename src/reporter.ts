import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  FullConfig,
  Reporter,
  TestCase,
  TestResult,
} from "@playwright/test/reporter";
import { DEFAULT_BUNDLE_DIR, isSlidemuxRecording, SLIDEMUX_STEPS_ATTACHMENT } from "./env.js";
import { alignStepMarks, extractStepClips, probeVideoDurationMs } from "./extract-clips.js";
import {
  emptyManifest,
  type SlidemuxManifest,
  type SlidemuxStepMark,
  type SlidemuxTestBundle,
} from "./manifest.js";

type ReporterOptions = {
  outputDir?: string;
};

export default class SlidemuxReporter implements Reporter {
  private outputDir = DEFAULT_BUNDLE_DIR;
  private readonly tests: SlidemuxTestBundle[] = [];
  private drain: Promise<void> = Promise.resolve();

  constructor(options: ReporterOptions = {}) {
    this.outputDir = options.outputDir ?? DEFAULT_BUNDLE_DIR;
  }

  onBegin(config: FullConfig): void {
    const configured = config.reporter.find((entry) => entry[0]?.includes("slidemux"));
    const optionDir = (configured?.[1] as ReporterOptions | undefined)?.outputDir;
    if (optionDir) {
      this.outputDir = optionDir;
    }
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    this.drain = this.drain.then(() => this.recordPassedTest(test, result));
  }

  async onEnd(): Promise<void> {
    await this.drain;
    if (!isSlidemuxRecording()) {
      return;
    }
    await mkdir(this.outputDir, { recursive: true });
    const manifest: SlidemuxManifest = { ...emptyManifest(this.outputDir), tests: this.tests };
    await writeFile(path.join(this.outputDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  }

  private async recordPassedTest(test: TestCase, result: TestResult): Promise<void> {
    if (!isSlidemuxRecording() || result.status !== "passed") {
      return;
    }
    this.tests.push(await this.buildBundle(test, result));
  }

  private async buildBundle(test: TestCase, result: TestResult): Promise<SlidemuxTestBundle> {
    const video = result.attachments.find((item) => item.name === "video")?.path ?? null;
    const { steps, elapsedAtAttachMs } = readStepsPayload(result);
    const aligned = video
      ? alignStepMarks(steps, elapsedAtAttachMs, await probeVideoDurationMs(video))
      : steps;
    const clips = video ? await extractStepClips(video, this.outputDir, aligned) : aligned.map((step) => ({
      ...step,
      file: null,
    }));
    return {
      title: test.title,
      file: test.location.file,
      video,
      steps: clips,
    };
  }
}

type StepsPayload = {
  steps: SlidemuxStepMark[];
  /** Null for the legacy bare-array format, which carries no timing anchor. */
  elapsedAtAttachMs: number | null;
};

function readStepsPayload(result: TestResult): StepsPayload {
  const attachment = result.attachments.find((item) => item.name === SLIDEMUX_STEPS_ATTACHMENT);
  if (!attachment?.body) {
    return { steps: [], elapsedAtAttachMs: null };
  }
  const parsed = JSON.parse(attachment.body.toString()) as unknown;
  if (Array.isArray(parsed)) {
    return { steps: parsed.filter(isStepMark), elapsedAtAttachMs: null };
  }
  if (!parsed || typeof parsed !== "object" || !Array.isArray((parsed as Record<string, unknown>).steps)) {
    return { steps: [], elapsedAtAttachMs: null };
  }
  const record = parsed as { steps: unknown[]; elapsedAtAttachMs?: unknown };
  return {
    steps: record.steps.filter(isStepMark),
    elapsedAtAttachMs: typeof record.elapsedAtAttachMs === "number" ? record.elapsedAtAttachMs : null,
  };
}

function isStepMark(value: unknown): value is SlidemuxStepMark {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return typeof record.slug === "string" && typeof record.startMs === "number" && typeof record.endMs === "number";
}
