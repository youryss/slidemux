import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { readSlidemuxApiConfig, type SlidemuxApiConfig } from "./api-config.js";
import { readBundleStatus } from "./commands.js";
import { buildImportManifest, buildImportMultipart } from "./build-import-body.js";
import { resolveContained } from "./contained-path.js";

export type FetchFn = typeof fetch;

type ApiJson = Record<string, unknown>;

/** Thrown for non-2xx SlideMux responses; `code` carries the server error code (e.g. VIDEO_METER_EXHAUSTED). */
export class SlidemuxApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string | undefined,
  ) {
    super(code ? `${code}: ${message}` : message);
    this.name = "SlidemuxApiError";
  }
}

async function throwApiError(response: Response, pathname: string): Promise<never> {
  const body = (await response.json().catch(() => ({}))) as ApiJson;
  const error = body.error;
  const field = (name: string): string | undefined =>
    typeof error === "object" && error && name in error && typeof (error as ApiJson)[name] === "string"
      ? ((error as ApiJson)[name] as string)
      : undefined;
  throw new SlidemuxApiError(
    field("message") ?? `SlideMux API ${response.status} for ${pathname}`,
    response.status,
    field("code"),
  );
}

async function apiFetch(
  config: SlidemuxApiConfig,
  fetchFn: FetchFn,
  pathname: string,
  init: RequestInit = {},
): Promise<Response> {
  const response = await fetchFn(`${config.apiUrl}${pathname}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.token}`,
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) {
    await throwApiError(response, pathname);
  }
  return response;
}

async function apiRequest(
  config: SlidemuxApiConfig,
  fetchFn: FetchFn,
  pathname: string,
  init: RequestInit = {},
): Promise<ApiJson> {
  const response = await apiFetch(config, fetchFn, pathname, init);
  return (await response.json()) as ApiJson;
}

export type DownloadVideoOptions = {
  projectRoot: string;
  /** Defaults to `<projectRoot>/test-results/slidemux/<projectId>.mp4`. */
  outPath?: string;
};

export type DownloadVideoResult = { path: string; bytes: number };

/** Saves the finished MP4 from GET /api/projects/:id/output/video.mp4. Never starts a generate. */
export async function downloadVideo(
  projectId: string,
  options: DownloadVideoOptions,
  fetchFn: FetchFn = fetch,
): Promise<DownloadVideoResult> {
  const target = resolveContained(
    options.projectRoot,
    options.outPath ?? path.join("test-results", "slidemux", `${projectId}.mp4`),
  );
  const config = readSlidemuxApiConfig();
  const response = await apiFetch(config, fetchFn, `/api/projects/${projectId}/output/video.mp4`);
  const bytes = Buffer.from(await response.arrayBuffer());
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, bytes);
  return { path: target, bytes: bytes.byteLength };
}

/** Lists ElevenLabs TTS voices from GET /api/tts/voices?provider=elevenlabs. */
export async function listVoices(fetchFn: FetchFn = fetch): Promise<ApiJson> {
  const config = readSlidemuxApiConfig();
  const body = await apiRequest(config, fetchFn, "/api/tts/voices?provider=elevenlabs");
  return keepElevenLabsVoices(body);
}

/** Returns entitlements from GET /api/auth/entitlements. */
export async function getEntitlements(
  projectId: string | undefined,
  fetchFn: FetchFn = fetch,
): Promise<ApiJson> {
  const config = readSlidemuxApiConfig();
  const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
  return apiRequest(config, fetchFn, `/api/auth/entitlements${query}`);
}

/** POSTs the last local bundle to /api/playwright-imports. */
export async function uploadRecording(
  projectRoot: string,
  fetchFn: FetchFn = fetch,
): Promise<ApiJson> {
  const config = readSlidemuxApiConfig();
  const localManifest = await readBundleStatus(projectRoot);
  const manifest = buildImportManifest(localManifest);
  const clips = await readBundleClips(projectRoot, localManifest.outputDir, manifest);
  const multipart = buildImportMultipart(manifest, clips);
  return apiRequest(config, fetchFn, "/api/playwright-imports", {
    method: "POST",
    headers: { "Content-Type": multipart.contentType },
    body: new Uint8Array(multipart.body),
  });
}

/** Persists voiceId on a project via PUT /api/projects/:id. */
export async function setVoice(
  projectId: string,
  voiceId: string,
  fetchFn: FetchFn = fetch,
): Promise<ApiJson> {
  const config = readSlidemuxApiConfig();
  const loaded = await apiRequest(config, fetchFn, `/api/projects/${projectId}`);
  const project = loaded.project as Record<string, unknown>;
  project.voiceId = voiceId;
  return apiRequest(config, fetchFn, `/api/projects/${projectId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project }),
  });
}

type ProjectSlide = {
  narration: string;
  layers?: Array<{ id?: string; type?: string }>;
};

/** Updates one slide's narration by Playwright step slug. */
export async function setSlideNarration(
  projectId: string,
  slug: string,
  text: string,
  fetchFn: FetchFn = fetch,
): Promise<ApiJson> {
  const config = readSlidemuxApiConfig();
  const loaded = await apiRequest(config, fetchFn, `/api/projects/${projectId}`);
  const project = loaded.project as { slides: ProjectSlide[] };
  const slide = project.slides.find((item) =>
    item.layers?.some((layer) => layer.type === "video" && layer.id === slug),
  );
  if (!slide) {
    throw new Error(`No slide with step slug ${JSON.stringify(slug)} in project ${JSON.stringify(projectId)}`);
  }
  slide.narration = text;
  return apiRequest(config, fetchFn, `/api/projects/${projectId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project }),
  });
}

/** Starts generate with ElevenLabs (admin generate defaults to Google if provider is omitted). */
export async function startGenerate(
  projectId: string,
  body: Record<string, unknown> = {},
  fetchFn: FetchFn = fetch,
): Promise<ApiJson> {
  const voiceId = body.voiceId;
  if (typeof voiceId === "string" && voiceId.includes("Neural2")) {
    throw new Error(
      `Voice id ${JSON.stringify(voiceId)} is Google Neural2. Use an ElevenLabs voice id from list_voices.`,
    );
  }
  const config = readSlidemuxApiConfig();
  return apiRequest(config, fetchFn, `/api/projects/${projectId}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, provider: "elevenlabs" }),
  });
}

/** Polls GET /api/projects/:id/generate/:jobId. */
export async function getGenerateStatus(
  projectId: string,
  jobId: string,
  fetchFn: FetchFn = fetch,
): Promise<ApiJson> {
  const config = readSlidemuxApiConfig();
  return apiRequest(config, fetchFn, `/api/projects/${projectId}/generate/${jobId}`);
}

async function readBundleClips(
  projectRoot: string,
  outputDir: string,
  manifest: ReturnType<typeof buildImportManifest>,
): Promise<Map<string, Buffer>> {
  const bundleDir = resolveContained(projectRoot, outputDir);
  const clips = new Map<string, Buffer>();
  for (const test of manifest.tests) {
    for (const step of test.steps) {
      if (!step.file) {
        continue;
      }
      clips.set(step.file, await readFile(resolveContained(bundleDir, step.file)));
    }
  }
  return clips;
}

function voiceIdOf(voice: unknown): string | undefined {
  if (!voice || typeof voice !== "object" || !("id" in voice)) {
    return undefined;
  }
  return typeof voice.id === "string" ? voice.id : undefined;
}

/** Drops Google Neural2 ids; errors if the catalog was only Neural2 (ungranted token). */
function keepElevenLabsVoices(body: ApiJson): ApiJson {
  if (!Array.isArray(body.voices)) {
    return body;
  }
  const voices = body.voices.filter((voice) => {
    const id = voiceIdOf(voice);
    return id !== undefined && !id.includes("Neural2");
  });
  if (voices.length === 0 && body.voices.length > 0) {
    throw new Error(
      "ElevenLabs voices are not available for this token. Grant ElevenLabs on the invite, then retry list_voices.",
    );
  }
  return { ...body, voices };
}
