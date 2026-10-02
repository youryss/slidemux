// ponytail: duplicate of shared/generate-completion-signal.ts — this package cannot import the monorepo.
export const GENERATE_JOB_RESOURCE_PREFIX = "slidemux://generate/jobs/";

const TERMINAL_STATUSES = new Set(["completed", "failed", "cancelled"]);

export type GenerateStatusReader = {
  read: (projectId: string, jobId: string) => Promise<unknown>;
};

export type GenerateCompletionSink = {
  publish: (uri: string, payload: unknown) => void;
  sendListChanged: () => void | Promise<void>;
};

export type WatchGenerateCompletionArgs = {
  projectId: string;
  jobId: string;
  reader: GenerateStatusReader;
  sink: GenerateCompletionSink;
  intervalMs?: number;
  sleep?: (ms: number) => Promise<void>;
};

/** Builds the locked generate-job resource URI. Example: `generateJobResourceUri("job-1")` */
export function generateJobResourceUri(jobId: string): string {
  if (!jobId || jobId.includes("/") || jobId.includes(" ")) {
    throw new Error(`jobId must be a single path segment; got ${JSON.stringify(jobId)}`);
  }
  return `${GENERATE_JOB_RESOURCE_PREFIX}${jobId}`;
}

export function readGenerateJobId(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") {
    return undefined;
  }
  const job = (payload as { job?: { id?: unknown } }).job;
  if (job && typeof job.id === "string" && job.id.length > 0) {
    return job.id;
  }
  const jobId = (payload as { jobId?: unknown }).jobId;
  return typeof jobId === "string" && jobId.length > 0 ? jobId : undefined;
}

export function readGenerateStatusName(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") {
    return undefined;
  }
  const nested = (payload as { job?: { status?: { status?: unknown } | string } }).job?.status;
  if (nested && typeof nested === "object" && typeof nested.status === "string") {
    return nested.status;
  }
  if (typeof nested === "string") {
    return nested;
  }
  const top = (payload as { status?: unknown }).status;
  return typeof top === "string" ? top : undefined;
}

/** Returns the list_changed payload only when the job is terminal. Example: `completionSignalFromStatus(id, json)` */
export function completionSignalFromStatus(
  jobId: string,
  payload: unknown,
): { uri: string; payload: unknown } | null {
  const status = readGenerateStatusName(payload);
  if (!status || !TERMINAL_STATUSES.has(status)) {
    return null;
  }
  return { uri: generateJobResourceUri(jobId), payload };
}

export async function watchGenerateCompletion(args: WatchGenerateCompletionArgs): Promise<void> {
  const intervalMs = args.intervalMs ?? 5_000;
  const sleep = args.sleep ?? defaultSleep;
  for (;;) {
    const payload = await args.reader.read(args.projectId, args.jobId);
    const signal = completionSignalFromStatus(args.jobId, payload);
    if (signal) {
      args.sink.publish(signal.uri, signal.payload);
      await args.sink.sendListChanged();
      return;
    }
    await sleep(intervalMs);
  }
}

/** Starts the watch without blocking the caller. Example: `void armGenerateCompletionWatch(args)` */
export function armGenerateCompletionWatch(args: WatchGenerateCompletionArgs): Promise<void> {
  return watchGenerateCompletion(args);
}

/** Arms the watch after start_generate JSON. Example: `void followStartGenerateCompletion(json, args)` */
export function followStartGenerateCompletion(
  startPayload: unknown,
  args: Omit<WatchGenerateCompletionArgs, "jobId">,
): Promise<void> | undefined {
  const jobId = readGenerateJobId(startPayload);
  if (!jobId) {
    return undefined;
  }
  return armGenerateCompletionWatch({ ...args, jobId });
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
