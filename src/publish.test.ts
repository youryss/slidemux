import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { downloadVideo } from "./cloud-api.js";
import { publishRecording } from "./publish.js";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("downloadVideo", () => {
  let projectRoot: string;

  beforeEach(async () => {
    process.env.SLIDEMUX_API_TOKEN = "pat_test_secret";
    process.env.SLIDEMUX_API_URL = "https://slidemux.com";
    projectRoot = await mkdtemp(path.join(tmpdir(), "slidemux-download-"));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("streams the MP4 to the default bundle path and reports bytes", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(Buffer.from("mp4-bytes"), { status: 200 }));

    const result = await downloadVideo("proj-1", { projectRoot }, fetchMock);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://slidemux.com/api/projects/proj-1/output/video.mp4",
      expect.objectContaining({ headers: { Authorization: "Bearer pat_test_secret" } }),
    );
    expect(result).toEqual({
      path: path.join(projectRoot, "test-results", "slidemux", "proj-1.mp4"),
      bytes: 9,
    });
    expect(await readFile(result.path, "utf8")).toBe("mp4-bytes");
  });

  it("surfaces the API error (no output / expired) instead of writing a file", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ error: { code: "NOT_FOUND", message: "Output file not found." } }, 404),
    );

    await expect(downloadVideo("proj-1", { projectRoot }, fetchMock)).rejects.toThrow(
      /Output file not found/,
    );
  });

  it("refuses an outPath that leaves the project root", async () => {
    const fetchMock = vi.fn();
    await expect(
      downloadVideo("proj-1", { projectRoot, outPath: "../../.ssh/id_rsa" }, fetchMock),
    ).rejects.toThrow(/escapes|must be relative/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("publishRecording", () => {
  let projectRoot: string;

  beforeEach(async () => {
    process.env.SLIDEMUX_API_TOKEN = "pat_test_secret";
    process.env.SLIDEMUX_API_URL = "https://slidemux.com";
    projectRoot = await mkdtemp(path.join(tmpdir(), "slidemux-publish-"));
    const bundleDir = path.join(projectRoot, "test-results/slidemux");
    await mkdir(bundleDir, { recursive: true });
    await writeFile(
      path.join(bundleDir, "manifest.json"),
      JSON.stringify({
        schemaVersion: 1,
        outputDir: "test-results/slidemux",
        tests: [
          {
            title: "happy path",
            file: "e2e/happy-path.spec.ts",
            video: null,
            steps: [{ slug: "select-deck", startMs: 0, endMs: 900, file: "select-deck.mp4" }],
          },
        ],
      }),
    );
    await writeFile(path.join(bundleDir, "select-deck.mp4"), "clip");
  });

  it("uploads, generates, polls to completion, and downloads", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ projects: [{ projectId: "proj-1", editorUrl: "https://slidemux.com/projects/proj-1" }] }),
      )
      .mockResolvedValueOnce(jsonResponse({ job: { id: "job-1", status: { status: "running" } } }, 202))
      .mockResolvedValueOnce(jsonResponse({ job: { id: "job-1", status: { status: "running" } } }))
      .mockResolvedValueOnce(jsonResponse({ job: { id: "job-1", status: { status: "completed" } } }))
      .mockResolvedValueOnce(new Response(Buffer.from("final"), { status: 200 }));

    const result = await publishRecording(
      { projectRoot, pollIntervalMs: 0, timeoutMs: 10_000 },
      fetchMock,
    );

    expect(fetchMock.mock.calls.map((call) => String(call[0]))).toEqual([
      "https://slidemux.com/api/playwright-imports",
      "https://slidemux.com/api/projects/proj-1/generate",
      "https://slidemux.com/api/projects/proj-1/generate/job-1",
      "https://slidemux.com/api/projects/proj-1/generate/job-1",
      "https://slidemux.com/api/projects/proj-1/output/video.mp4",
    ]);
    expect(result).toEqual([
      {
        projectId: "proj-1",
        editorUrl: "https://slidemux.com/projects/proj-1",
        jobId: "job-1",
        outputPath: path.join(projectRoot, "test-results", "slidemux", "proj-1.mp4"),
        bytes: 5,
      },
    ]);
  });

  it("fails with the quota code when generate is denied", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ projects: [{ projectId: "proj-1", editorUrl: "x" }] }))
      .mockResolvedValueOnce(
        jsonResponse(
          { error: { code: "VIDEO_METER_EXHAUSTED", message: "You have used all videos this month." } },
          402,
        ),
      );

    await expect(
      publishRecording({ projectRoot, pollIntervalMs: 0, timeoutMs: 10_000 }, fetchMock),
    ).rejects.toThrow(/VIDEO_METER_EXHAUSTED/);
  });

  it("fails when the job ends in a non-completed state", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ projects: [{ projectId: "proj-1", editorUrl: "x" }] }))
      .mockResolvedValueOnce(jsonResponse({ job: { id: "job-1", status: { status: "running" } } }, 202))
      .mockResolvedValueOnce(
        jsonResponse({
          job: { id: "job-1", status: { status: "failed", error: { code: "TTS_UNAVAILABLE", message: "vendor" } } },
        }),
      );

    await expect(
      publishRecording({ projectRoot, pollIntervalMs: 0, timeoutMs: 10_000 }, fetchMock),
    ).rejects.toThrow(/TTS_UNAVAILABLE/);
  });
});
