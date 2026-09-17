import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { MissingSlidemuxApiConfigError } from "./api-config.js";
import {
  getEntitlements,
  getGenerateStatus,
  listVoices,
  setSlideNarration,
  setVoice,
  startGenerate,
  uploadRecording,
} from "./cloud-api.js";

describe("listVoices", () => {
  const priorToken = process.env.SLIDEMUX_API_TOKEN;
  const priorUrl = process.env.SLIDEMUX_API_URL;

  beforeEach(() => {
    process.env.SLIDEMUX_API_TOKEN = "pat_test_secret";
    process.env.SLIDEMUX_API_URL = "https://slidemux.com";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (priorToken === undefined) {
      delete process.env.SLIDEMUX_API_TOKEN;
    } else {
      process.env.SLIDEMUX_API_TOKEN = priorToken;
    }
    if (priorUrl === undefined) {
      delete process.env.SLIDEMUX_API_URL;
    } else {
      process.env.SLIDEMUX_API_URL = priorUrl;
    }
  });

  it("fails clearly when SLIDEMUX_API_TOKEN is missing", async () => {
    delete process.env.SLIDEMUX_API_TOKEN;
    await expect(listVoices()).rejects.toBeInstanceOf(MissingSlidemuxApiConfigError);
  });

  it("GETs ElevenLabs voices with the bearer token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ voices: [{ id: "voice-a", name: "Voice A" }] }), { status: 200 }),
    );
    const result = await listVoices(fetchMock);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://slidemux.com/api/tts/voices?provider=elevenlabs",
      expect.objectContaining({
        headers: { Authorization: "Bearer pat_test_secret" },
      }),
    );
    expect(result).toEqual({ voices: [{ id: "voice-a", name: "Voice A" }] });
  });

  it("rejects a Google Neural2 fallback instead of returning those voices", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          voices: [{ id: "en-US-Neural2-G", name: "Neural2 G · English (US) · Female" }],
        }),
        { status: 200 },
      ),
    );
    await expect(listVoices(fetchMock)).rejects.toThrow(
      /ElevenLabs voices are not available for this token/,
    );
  });
});

describe("getEntitlements", () => {
  beforeEach(() => {
    process.env.SLIDEMUX_API_TOKEN = "pat_test_secret";
    process.env.SLIDEMUX_API_URL = "https://slidemux.com";
  });

  it("GETs /api/auth/entitlements with an optional projectId", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ entitlements: { lifetimeVideosRemaining: 2 } }), { status: 200 }),
    );
    const result = await getEntitlements("proj-1", fetchMock);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://slidemux.com/api/auth/entitlements?projectId=proj-1",
      expect.any(Object),
    );
    expect(result).toEqual({ entitlements: { lifetimeVideosRemaining: 2 } });
  });
});

describe("uploadRecording", () => {
  let projectRoot: string;

  beforeEach(async () => {
    process.env.SLIDEMUX_API_TOKEN = "pat_test_secret";
    process.env.SLIDEMUX_API_URL = "https://slidemux.com";
    projectRoot = await mkdtemp(path.join(tmpdir(), "slidemux-upload-"));
    const bundleDir = path.join(projectRoot, "test-results/slidemux");
    await mkdir(bundleDir, { recursive: true });
    await writeFile(
      path.join(bundleDir, "manifest.json"),
      JSON.stringify({
        schemaVersion: 1,
        outputDir: "test-results/slidemux",
        tests: [
          {
            title: "invite",
            file: "invite.spec.ts",
            video: null,
            steps: [{ slug: "open-invite", startMs: 0, endMs: 900, file: "open-invite.mp4" }],
          },
        ],
      }),
    );
    await writeFile(path.join(bundleDir, "open-invite.mp4"), "fake-mp4");
  });

  it("POSTs the last bundle to /api/playwright-imports", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ projects: [{ projectId: "proj-1" }] }), { status: 200 }),
    );
    const result = await uploadRecording(projectRoot, fetchMock);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://slidemux.com/api/playwright-imports",
      expect.objectContaining({ method: "POST" }),
    );
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.headers).toMatchObject({ Authorization: "Bearer pat_test_secret" });
    expect(String(init.headers && (init.headers as Record<string, string>)["Content-Type"])).toMatch(
      /^multipart\/form-data; boundary=/,
    );
    expect(result).toEqual({ projects: [{ projectId: "proj-1" }] });
  });

  it("refuses a manifest whose clip path leaves the bundle", async () => {
    await writeFile(
      path.join(projectRoot, "test-results/slidemux/manifest.json"),
      JSON.stringify({
        schemaVersion: 1,
        outputDir: "test-results/slidemux",
        tests: [
          {
            title: "invite",
            file: "invite.spec.ts",
            video: null,
            steps: [{ slug: "open-invite", startMs: 0, endMs: 900, file: "../../.env" }],
          },
        ],
      }),
    );
    const fetchMock = vi.fn();
    await expect(uploadRecording(projectRoot, fetchMock)).rejects.toThrow(/inside the bundle/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("setVoice", () => {
  beforeEach(() => {
    process.env.SLIDEMUX_API_TOKEN = "pat_test_secret";
    process.env.SLIDEMUX_API_URL = "https://slidemux.com";
  });

  it("loads the project and PUTs voiceId", async () => {
    const project = { id: "proj-1", voiceId: "", slides: [] };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ project }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ project: { ...project, voiceId: "voice-a" } }), { status: 200 }));
    const result = await setVoice("proj-1", "voice-a", fetchMock);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://slidemux.com/api/projects/proj-1");
    expect(fetchMock.mock.calls[1]?.[0]).toBe("https://slidemux.com/api/projects/proj-1");
    expect(JSON.parse(String((fetchMock.mock.calls[1]?.[1] as RequestInit).body))).toEqual({
      project: { ...project, voiceId: "voice-a" },
    });
    expect(result).toEqual({ project: { ...project, voiceId: "voice-a" } });
  });
});

describe("setSlideNarration", () => {
  beforeEach(() => {
    process.env.SLIDEMUX_API_TOKEN = "pat_test_secret";
    process.env.SLIDEMUX_API_URL = "https://slidemux.com";
  });

  it("updates narration on the slide whose video layer id matches the slug", async () => {
    const project = {
      id: "proj-1",
      voiceId: "voice-a",
      slides: [
        {
          id: "slide-1",
          narration: "",
          layers: [{ id: "open-invite", type: "video" }],
        },
      ],
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ project }), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            project: {
              ...project,
              slides: [{ ...project.slides[0], narration: "Hello team" }],
            },
          }),
          { status: 200 },
        ),
      );
    const result = await setSlideNarration("proj-1", "open-invite", "Hello team", fetchMock);
    expect(JSON.parse(String((fetchMock.mock.calls[1]?.[1] as RequestInit).body))).toEqual({
      project: {
        ...project,
        slides: [{ ...project.slides[0], narration: "Hello team" }],
      },
    });
    expect(result.project).toMatchObject({
      slides: [{ narration: "Hello team" }],
    });
  });
});

describe("startGenerate", () => {
  beforeEach(() => {
    process.env.SLIDEMUX_API_TOKEN = "pat_test_secret";
    process.env.SLIDEMUX_API_URL = "https://slidemux.com";
  });

  it("POSTs /api/projects/:id/generate and returns the job payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ job: { id: "job-1", status: { status: "queued" } } }), { status: 202 }),
    );
    const result = await startGenerate("proj-1", { voiceId: "voice-a" }, fetchMock);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://slidemux.com/api/projects/proj-1/generate",
      expect.objectContaining({ method: "POST" }),
    );
    expect(JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit).body))).toEqual({
      voiceId: "voice-a",
      provider: "elevenlabs",
    });
    expect(result).toEqual({ job: { id: "job-1", status: { status: "queued" } } });
  });

  it("still requests ElevenLabs when voiceId is omitted", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ job: { id: "job-1", status: { status: "queued" } } }), { status: 202 }),
    );
    await startGenerate("proj-1", {}, fetchMock);
    expect(JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit).body))).toEqual({
      provider: "elevenlabs",
    });
  });

  it("refuses a Google Neural2 voiceId instead of sending it to generate", async () => {
    const fetchMock = vi.fn();
    await expect(
      startGenerate("proj-1", { voiceId: "en-US-Neural2-G" }, fetchMock),
    ).rejects.toThrow(/ElevenLabs voice id from list_voices/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("getGenerateStatus", () => {
  beforeEach(() => {
    process.env.SLIDEMUX_API_TOKEN = "pat_test_secret";
    process.env.SLIDEMUX_API_URL = "https://slidemux.com";
  });

  it("GETs /api/projects/:id/generate/:jobId", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ job: { id: "job-1", status: { status: "completed" } } }), { status: 200 }),
    );
    const result = await getGenerateStatus("proj-1", "job-1", fetchMock);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://slidemux.com/api/projects/proj-1/generate/job-1",
      expect.any(Object),
    );
    expect(result).toEqual({ job: { id: "job-1", status: { status: "completed" } } });
  });
});
