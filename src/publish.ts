import {
  downloadVideo,
  getGenerateStatus,
  setVoice,
  startGenerate,
  uploadRecording,
  type FetchFn,
} from "./cloud-api.js";

export type PublishOptions = {
  projectRoot: string;
  /** ElevenLabs voice id; omit to use the voice already saved on the project. */
  voiceId?: string;
  /** Directory for MP4s; defaults to the bundle dir. Files are named `<projectId>.mp4`. */
  outDir?: string;
  pollIntervalMs?: number;
  timeoutMs?: number;
};

export type PublishedProject = {
  projectId: string;
  editorUrl: string;
  jobId: string;
  outputPath: string;
  bytes: number;
};

type ImportedProject = { projectId: string; editorUrl: string };
type JobStatus = { status: string; error?: { code?: string; message?: string } };

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

function readJob(body: Record<string, unknown>): { id: string; status: JobStatus } {
  const job = body.job as { id?: string; status?: JobStatus } | undefined;
  if (!job?.id || !job.status) {
    throw new Error(`Generate response has no job; received ${JSON.stringify(body)}`);
  }
  return { id: job.id, status: job.status };
}

async function waitForJob(
  projectId: string,
  jobId: string,
  initial: JobStatus,
  options: Required<Pick<PublishOptions, "pollIntervalMs" | "timeoutMs">>,
  fetchFn: FetchFn,
): Promise<void> {
  const deadline = Date.now() + options.timeoutMs;
  let status = initial;
  while (status.status === "running") {
    if (Date.now() > deadline) {
      throw new Error(`Generate job ${jobId} still running after ${options.timeoutMs}ms`);
    }
    await sleep(options.pollIntervalMs);
    status = readJob(await getGenerateStatus(projectId, jobId, fetchFn)).status;
  }
  if (status.status !== "completed") {
    const code = status.error?.code ?? status.status.toUpperCase();
    throw new Error(`${code}: generate job ${jobId} ended as ${status.status}${status.error?.message ? ` (${status.error.message})` : ""}`);
  }
}

async function publishProject(
  imported: ImportedProject,
  options: PublishOptions,
  fetchFn: FetchFn,
): Promise<PublishedProject> {
  if (options.voiceId) {
    await setVoice(imported.projectId, options.voiceId, fetchFn);
  }
  const started = readJob(await startGenerate(imported.projectId, {}, fetchFn));
  await waitForJob(
    imported.projectId,
    started.id,
    started.status,
    { pollIntervalMs: options.pollIntervalMs ?? 3_000, timeoutMs: options.timeoutMs ?? 15 * 60_000 },
    fetchFn,
  );
  const outPath = options.outDir ? `${options.outDir}/${imported.projectId}.mp4` : undefined;
  const saved = await downloadVideo(imported.projectId, { projectRoot: options.projectRoot, outPath }, fetchFn);
  return { ...imported, jobId: started.id, outputPath: saved.path, bytes: saved.bytes };
}

/**
 * CI one-liner: upload the last bundle, generate every imported project, poll, download the MP4s.
 * Example: `await publishRecording({ projectRoot: process.cwd(), voiceId })`
 */
export async function publishRecording(
  options: PublishOptions,
  fetchFn: FetchFn = fetch,
): Promise<PublishedProject[]> {
  const uploaded = await uploadRecording(options.projectRoot, fetchFn);
  const projects = (uploaded.projects as ImportedProject[] | undefined) ?? [];
  if (projects.length === 0) {
    throw new Error(`Upload returned no projects; received ${JSON.stringify(uploaded)}`);
  }
  // ponytail: sequential on purpose — the hosted runner generates one job at a time (PRD 62 known ceiling).
  const published: PublishedProject[] = [];
  for (const project of projects) {
    published.push(await publishProject(project, options, fetchFn));
  }
  return published;
}
