import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { MissingSlidemuxApiConfigError } from "./api-config.js";
import {
  addImageBox,
  addTextBox,
  addVideoBox,
  appendSlide,
  createTopicDeck,
  deleteTextBox,
  getEntitlements,
  getGenerateStatus,
  getProject,
  listVoices,
  patchTextBox,
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

  it("updates narration when given a studio slideId", async () => {
    const project = {
      id: "proj-1",
      voiceId: "voice-a",
      slides: [
        {
          id: "slide-uuid-1",
          narration: "",
          layers: [{ id: "open-invite", type: "video" }],
        },
      ],
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ project }), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ project: { ...project, slides: [{ ...project.slides[0], narration: "UUID path" }] } }), {
          status: 200,
        }),
      );
    await setSlideNarration("proj-1", { slideId: "slide-uuid-1" }, "UUID path", fetchMock);
    expect(JSON.parse(String((fetchMock.mock.calls[1]?.[1] as RequestInit).body))).toEqual({
      project: {
        ...project,
        slides: [{ ...project.slides[0], narration: "UUID path" }],
      },
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

describe("createTopicDeck", () => {
  beforeEach(() => {
    process.env.SLIDEMUX_API_TOKEN = "pat_test_secret";
    process.env.SLIDEMUX_API_URL = "https://slidemux.com";
  });

  it("POSTs /api/topic-decks with title, orientation, and theme", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          projectId: "proj-topic-1",
          editorUrl: "https://slidemux.com/projects/proj-topic-1",
          project: { id: "proj-topic-1", slides: [] },
        }),
        { status: 201 },
      ),
    );
    const result = await createTopicDeck("Coffee Deck", "landscape", "editorial", fetchMock);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://slidemux.com/api/topic-decks",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer pat_test_secret",
          "Content-Type": "application/json",
        }),
      }),
    );
    expect(JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit).body))).toEqual({
      title: "Coffee Deck",
      orientation: "landscape",
      theme: "editorial",
    });
    expect(result).toMatchObject({ projectId: "proj-topic-1" });
  });
});

describe("getProject", () => {
  beforeEach(() => {
    process.env.SLIDEMUX_API_TOKEN = "pat_test_secret";
    process.env.SLIDEMUX_API_URL = "https://slidemux.com";
  });

  it("GETs /api/projects/:id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ project: { id: "proj-1", slides: [] } }), { status: 200 }),
    );
    const result = await getProject("proj-1", fetchMock);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://slidemux.com/api/projects/proj-1",
      expect.objectContaining({
        headers: { Authorization: "Bearer pat_test_secret" },
      }),
    );
    expect(result).toEqual({ project: { id: "proj-1", slides: [] } });
  });
});

describe("appendSlide", () => {
  beforeEach(() => {
    process.env.SLIDEMUX_API_TOKEN = "pat_test_secret";
    process.env.SLIDEMUX_API_URL = "https://slidemux.com";
  });

  it("POSTs /api/projects/:id/scenes", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ project: { id: "proj-1", slides: [{ id: "slide-1" }] } }),
        { status: 201 },
      ),
    );
    const result = await appendSlide("proj-1", fetchMock);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://slidemux.com/api/projects/proj-1/scenes",
      expect.objectContaining({ method: "POST" }),
    );
    expect(result).toEqual({ project: { id: "proj-1", slides: [{ id: "slide-1" }] } });
  });
});

describe("addTextBox", () => {
  beforeEach(() => {
    process.env.SLIDEMUX_API_TOKEN = "pat_test_secret";
    process.env.SLIDEMUX_API_URL = "https://slidemux.com";
  });

  it("POSTs text box fields to the slide route", async () => {
    const fields = { copy: "Hello", x: 0.1, y: 0.2, width: 0.8, height: 0.2 };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ box: { id: "box-1", type: "text", ...fields } }), { status: 201 }),
    );
    const result = await addTextBox("proj-1", "slide-1", fields, fetchMock);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://slidemux.com/api/projects/proj-1/scenes/slide-1/text-boxes",
      expect.objectContaining({ method: "POST" }),
    );
    expect(JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit).body))).toEqual(fields);
    expect(result).toMatchObject({ box: { id: "box-1" } });
  });
});

describe("patchTextBox", () => {
  beforeEach(() => {
    process.env.SLIDEMUX_API_TOKEN = "pat_test_secret";
    process.env.SLIDEMUX_API_URL = "https://slidemux.com";
  });

  it("PATCHes one text box by id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ box: { id: "box-1", copy: "Updated" } }), { status: 200 }),
    );
    await patchTextBox("proj-1", "slide-1", "box-1", { copy: "Updated" }, fetchMock);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://slidemux.com/api/projects/proj-1/scenes/slide-1/text-boxes/box-1",
      expect.objectContaining({ method: "PATCH" }),
    );
  });
});

describe("deleteTextBox", () => {
  beforeEach(() => {
    process.env.SLIDEMUX_API_TOKEN = "pat_test_secret";
    process.env.SLIDEMUX_API_URL = "https://slidemux.com";
  });

  it("DELETEs one text box by id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ project: { slides: [] } }), { status: 200 }),
    );
    await deleteTextBox("proj-1", "slide-1", "box-1", fetchMock);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://slidemux.com/api/projects/proj-1/scenes/slide-1/text-boxes/box-1",
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});

describe("addImageBox", () => {
  beforeEach(() => {
    process.env.SLIDEMUX_API_TOKEN = "pat_test_secret";
    process.env.SLIDEMUX_API_URL = "https://slidemux.com";
  });

  it("POSTs base64 bytes with rect query and asset filename", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ box: { id: "box-img", type: "image" } }), { status: 201 }),
    );
    await addImageBox(
      "proj-1",
      "slide-1",
      { filename: "hero.png", base64: "aGVsbG8=", x: 0, y: 0, width: 1, height: 1 },
      fetchMock,
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://slidemux.com/api/projects/proj-1/scenes/slide-1/image-boxes?x=0&y=0&width=1&height=1",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "X-Asset-Filename": "hero.png",
          "Content-Type": "application/octet-stream",
        }),
      }),
    );
    expect(Buffer.from((fetchMock.mock.calls[0]?.[1] as RequestInit).body as Buffer)).toEqual(
      Buffer.from("hello"),
    );
  });

  it("POSTs raw file bytes when filePath is set instead of base64", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "slidemux-image-box-"));
    const filePath = path.join(dir, "hero.jpg");
    await writeFile(filePath, Buffer.from("jpeg-bytes"));
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ box: { id: "box-img", type: "image" } }), { status: 201 }),
    );
    await addImageBox(
      "proj-1",
      "slide-1",
      { filename: "hero.jpg", filePath, x: 0, y: 0, width: 1, height: 1 },
      fetchMock,
    );
    expect(Buffer.from((fetchMock.mock.calls[0]?.[1] as RequestInit).body as Buffer)).toEqual(
      Buffer.from("jpeg-bytes"),
    );
  });
});

describe("addVideoBox", () => {
  beforeEach(() => {
    process.env.SLIDEMUX_API_TOKEN = "pat_test_secret";
    process.env.SLIDEMUX_API_URL = "https://slidemux.com";
  });

  it("POSTs base64 clip bytes to the video box route", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ box: { id: "box-vid", type: "video" } }), { status: 201 }),
    );
    await addVideoBox(
      "proj-1",
      "slide-1",
      { filename: "clip.mp4", base64: "ZGF0YQ==", x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
      fetchMock,
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://slidemux.com/api/projects/proj-1/scenes/slide-1/video-boxes?x=0.1&y=0.1&width=0.8&height=0.8",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("POSTs raw clip bytes when filePath is set instead of base64", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "slidemux-video-box-"));
    const filePath = path.join(dir, "clip.mp4");
    await writeFile(filePath, Buffer.from("mp4-bytes"));
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ box: { id: "box-vid", type: "video" } }), { status: 201 }),
    );
    await addVideoBox(
      "proj-1",
      "slide-1",
      { filename: "clip.mp4", filePath, x: 0, y: 0, width: 1, height: 1 },
      fetchMock,
    );
    expect(Buffer.from((fetchMock.mock.calls[0]?.[1] as RequestInit).body as Buffer)).toEqual(
      Buffer.from("mp4-bytes"),
    );
  });
});
