import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { readSlidemuxApiConfig, type SlidemuxApiConfig } from "./api-config.js";
import { readBundleStatus } from "./commands.js";
import { buildImportManifest, buildImportMultipart } from "./build-import-body.js";
import { resolveContained } from "./contained-path.js";
import type { NarrationSlideKeys } from "./mcp-narration-slide-target.js";
import { resolveNarrationSlide } from "./mcp-narration-slide-target.js";

export type FetchFn = typeof fetch;

export type ApiJson = Record<string, unknown>;

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

/** Authenticated JSON request against the SlideMux API. Example: `await apiRequest(config, fetch, "/api/projects/p1")` */
export async function apiRequest(
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

export type TopicDeckBrandBody = {
  accent: string;
  ink: string;
  ground: string;
  logo?: { filename: string; base64: string };
};

/** Creates an empty topic deck via POST /api/topic-decks. */
export async function createTopicDeck(
  title: string,
  orientation: "landscape" | "portrait",
  theme: string,
  fetchFn: FetchFn = fetch,
  brand?: TopicDeckBrandBody,
  themeOverride?: Record<string, unknown>,
): Promise<ApiJson> {
  const config = readSlidemuxApiConfig();
  return apiRequest(config, fetchFn, "/api/topic-decks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title,
      orientation,
      theme,
      ...(brand ? { brand } : {}),
      ...(themeOverride ? { themeOverride } : {}),
    }),
  });
}

/** Reads a project via GET /api/projects/:id. */
export async function getProject(projectId: string, fetchFn: FetchFn = fetch): Promise<ApiJson> {
  const config = readSlidemuxApiConfig();
  return apiRequest(config, fetchFn, `/api/projects/${projectId}`);
}

/** Appends a blank slide via POST /api/projects/:id/scenes. */
export async function appendSlide(projectId: string, fetchFn: FetchFn = fetch): Promise<ApiJson> {
  const config = readSlidemuxApiConfig();
  return apiRequest(config, fetchFn, `/api/projects/${projectId}/scenes`, { method: "POST" });
}

/** Deletes one slide via DELETE /api/projects/:id/scenes/:slideId. */
export async function deleteSlide(
  projectId: string,
  slideId: string,
  fetchFn: FetchFn = fetch,
): Promise<ApiJson> {
  const config = readSlidemuxApiConfig();
  return apiRequest(config, fetchFn, `/api/projects/${projectId}/scenes/${slideId}`, {
    method: "DELETE",
  });
}

export type TextBoxInput = Record<string, unknown>;

/** Adds a text box via POST /api/projects/:id/scenes/:slideId/text-boxes. */
export async function addTextBox(
  projectId: string,
  slideId: string,
  fields: TextBoxInput,
  fetchFn: FetchFn = fetch,
): Promise<ApiJson> {
  const config = readSlidemuxApiConfig();
  return apiRequest(config, fetchFn, `/api/projects/${projectId}/scenes/${slideId}/text-boxes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
}

/** Patches a text box via PATCH /api/projects/:id/scenes/:slideId/text-boxes/:boxId. */
export async function patchTextBox(
  projectId: string,
  slideId: string,
  boxId: string,
  patch: TextBoxInput,
  fetchFn: FetchFn = fetch,
): Promise<ApiJson> {
  const config = readSlidemuxApiConfig();
  return apiRequest(
    config,
    fetchFn,
    `/api/projects/${projectId}/scenes/${slideId}/text-boxes/${boxId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    },
  );
}

/** Deletes a text box via DELETE /api/projects/:id/scenes/:slideId/text-boxes/:boxId. */
export async function deleteTextBox(
  projectId: string,
  slideId: string,
  boxId: string,
  fetchFn: FetchFn = fetch,
): Promise<ApiJson> {
  const config = readSlidemuxApiConfig();
  return apiRequest(
    config,
    fetchFn,
    `/api/projects/${projectId}/scenes/${slideId}/text-boxes/${boxId}`,
    { method: "DELETE" },
  );
}

export type LayerBoxRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type LayerBoxUpload = LayerBoxRect & {
  filename: string;
  base64?: string;
  /** Stdio-only: read bytes from disk instead of stuffing base64 through the tool call. */
  filePath?: string;
};

function layerBoxQuery(rect: LayerBoxRect): string {
  const params = new URLSearchParams({
    x: String(rect.x),
    y: String(rect.y),
    width: String(rect.width),
    height: String(rect.height),
  });
  return params.toString();
}

/** Upload bytes from a local filePath or base64. Example: `await layerBoxBytes({ filename: "a.png", filePath, x: 0, y: 0, width: 1, height: 1 })` */
export async function layerBoxBytes(upload: LayerBoxUpload): Promise<Buffer> {
  if (upload.filePath && upload.base64) {
    throw new Error(
      `upload must use filePath or base64, not both; got filename ${JSON.stringify(upload.filename)}`,
    );
  }
  if (upload.filePath) {
    return readFile(upload.filePath);
  }
  if (upload.base64) {
    return Buffer.from(upload.base64, "base64");
  }
  throw new Error(`upload needs filePath or base64; got filename ${JSON.stringify(upload.filename)}`);
}

async function uploadLayerBox(
  pathname: string,
  upload: LayerBoxUpload,
  config: SlidemuxApiConfig,
  fetchFn: FetchFn,
): Promise<ApiJson> {
  const bytes = await layerBoxBytes(upload);
  const response = await apiFetch(config, fetchFn, `${pathname}?${layerBoxQuery(upload)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "X-Asset-Filename": upload.filename,
    },
    body: new Uint8Array(bytes),
  });
  return (await response.json()) as ApiJson;
}

/** Adds an image box from local filePath or base64 bytes. */
export async function addImageBox(
  projectId: string,
  slideId: string,
  upload: LayerBoxUpload,
  fetchFn: FetchFn = fetch,
): Promise<ApiJson> {
  const config = readSlidemuxApiConfig();
  return uploadLayerBox(
    `/api/projects/${projectId}/scenes/${slideId}/image-boxes`,
    upload,
    config,
    fetchFn,
  );
}

/** Patches an image box. */
export async function patchImageBox(
  projectId: string,
  slideId: string,
  boxId: string,
  patch: Record<string, unknown>,
  fetchFn: FetchFn = fetch,
): Promise<ApiJson> {
  const config = readSlidemuxApiConfig();
  return apiRequest(
    config,
    fetchFn,
    `/api/projects/${projectId}/scenes/${slideId}/image-boxes/${boxId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    },
  );
}

/** Deletes an image box. */
export async function deleteImageBox(
  projectId: string,
  slideId: string,
  boxId: string,
  fetchFn: FetchFn = fetch,
): Promise<ApiJson> {
  const config = readSlidemuxApiConfig();
  return apiRequest(
    config,
    fetchFn,
    `/api/projects/${projectId}/scenes/${slideId}/image-boxes/${boxId}`,
    { method: "DELETE" },
  );
}

/** Adds a video box from local filePath or base64 bytes. */
export async function addVideoBox(
  projectId: string,
  slideId: string,
  upload: LayerBoxUpload,
  fetchFn: FetchFn = fetch,
): Promise<ApiJson> {
  const config = readSlidemuxApiConfig();
  return uploadLayerBox(
    `/api/projects/${projectId}/scenes/${slideId}/video-boxes`,
    upload,
    config,
    fetchFn,
  );
}

/** Patches a video box. */
export async function patchVideoBox(
  projectId: string,
  slideId: string,
  boxId: string,
  patch: Record<string, unknown>,
  fetchFn: FetchFn = fetch,
): Promise<ApiJson> {
  const config = readSlidemuxApiConfig();
  return apiRequest(
    config,
    fetchFn,
    `/api/projects/${projectId}/scenes/${slideId}/video-boxes/${boxId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    },
  );
}

/** Deletes a video box. */
export async function deleteVideoBox(
  projectId: string,
  slideId: string,
  boxId: string,
  fetchFn: FetchFn = fetch,
): Promise<ApiJson> {
  const config = readSlidemuxApiConfig();
  return apiRequest(
    config,
    fetchFn,
    `/api/projects/${projectId}/scenes/${slideId}/video-boxes/${boxId}`,
    { method: "DELETE" },
  );
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
  id: string;
  narration: string;
  layers?: Array<{ id?: string; type?: string }>;
};

function narrationKeys(slugOrKeys: string | NarrationSlideKeys): NarrationSlideKeys {
  return typeof slugOrKeys === "string" ? { slug: slugOrKeys } : slugOrKeys;
}

/** Updates one slide's narration by slideId and/or Playwright step slug. */
export async function setSlideNarration(
  projectId: string,
  slugOrKeys: string | NarrationSlideKeys,
  text: string,
  fetchFn: FetchFn = fetch,
): Promise<ApiJson> {
  const config = readSlidemuxApiConfig();
  const loaded = await apiRequest(config, fetchFn, `/api/projects/${projectId}`);
  const project = loaded.project as { slides: ProjectSlide[] };
  const resolved = resolveNarrationSlide(project.slides, narrationKeys(slugOrKeys));
  if (!resolved.ok) {
    throw new Error(`${resolved.message} in project ${JSON.stringify(projectId)}`);
  }
  resolved.slide.narration = text;
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
