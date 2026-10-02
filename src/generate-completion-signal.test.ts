import { describe, expect, it } from "vitest";
import {
  armGenerateCompletionWatch,
  completionSignalFromStatus,
  followStartGenerateCompletion,
  generateJobResourceUri,
} from "./generate-completion-signal.js";

class FakeGenerateCompletionSink {
  readonly published: Array<{ uri: string; payload: unknown }> = [];
  listChangedCount = 0;

  publish(uri: string, payload: unknown): void {
    this.published.push({ uri, payload });
  }

  sendListChanged(): void {
    this.listChangedCount += 1;
  }
}

class FakeGenerateStatusReader {
  private readonly payloads: unknown[] = [];

  queue(...payloads: unknown[]): void {
    this.payloads.push(...payloads);
  }

  async read(_projectId: string, _jobId: string): Promise<unknown> {
    const next = this.payloads.shift();
    if (next === undefined) {
      throw new Error("FakeGenerateStatusReader.read called with no queued payload");
    }
    return next;
  }
}

describe("completionSignalFromStatus", () => {
  it("does not signal while the job is still running", () => {
    expect(
      completionSignalFromStatus("job-1", { job: { id: "job-1", status: { status: "running" } } }),
    ).toBeNull();
  });

  it("signals once for completed, failed, and cancelled", () => {
    for (const status of ["completed", "failed", "cancelled"] as const) {
      const payload = { job: { id: "job-9", status: { status } } };
      expect(completionSignalFromStatus("job-9", payload)).toEqual({
        uri: "slidemux://generate/jobs/job-9",
        payload,
      });
    }
  });
});

describe("generateJobResourceUri", () => {
  it("uses the locked URI pattern", () => {
    expect(generateJobResourceUri("abc")).toBe("slidemux://generate/jobs/abc");
  });
});

describe("armGenerateCompletionWatch", () => {
  it("returns before the job is terminal and then publishes list_changed once", async () => {
    const reader = new FakeGenerateStatusReader();
    const sink = new FakeGenerateCompletionSink();
    reader.queue(
      { job: { id: "job-1", status: { status: "running" } } },
      { job: { id: "job-1", status: { status: "completed" } } },
    );
    const done = armGenerateCompletionWatch({
      projectId: "proj-1",
      jobId: "job-1",
      reader,
      sink,
      intervalMs: 0,
      sleep: async () => undefined,
    });
    expect(sink.listChangedCount).toBe(0);
    expect(sink.published).toEqual([]);
    await done;
    expect(sink.published).toEqual([
      {
        uri: "slidemux://generate/jobs/job-1",
        payload: { job: { id: "job-1", status: { status: "completed" } } },
      },
    ]);
    expect(sink.listChangedCount).toBe(1);
  });

  it("does not arm a watch when start_generate JSON has no job id", () => {
    const sink = new FakeGenerateCompletionSink();
    const reader = new FakeGenerateStatusReader();
    expect(
      followStartGenerateCompletion({ ok: true }, { projectId: "proj-1", reader, sink }),
    ).toBeUndefined();
    expect(sink.listChangedCount).toBe(0);
  });
});
