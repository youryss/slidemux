import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { appendSlideFromRecipe, lintDeck, moveSlide, replaceSlideFromRecipe } from "./cloud-api-recipe-slides.js";

type RecordedRequest = { url: string; method: string; body: unknown };

/** Answers every request with `{ ok: true }` (or an asset filename) and records what was sent. */
class RecordingSlidemuxFetch {
  readonly requests: RecordedRequest[] = [];

  fetch: typeof fetch = async (input, init) => {
    const url = String(input);
    const raw = init?.body;
    const body = typeof raw === "string" ? JSON.parse(raw) : raw ? "<bytes>" : undefined;
    this.requests.push({ url, method: init?.method ?? "GET", body });
    const reply = url.endsWith("/assets") ? { filename: "stored.png" } : { ok: true };
    return new Response(JSON.stringify(reply), { status: 200 });
  };
}

describe("stdio recipe slide client", () => {
  const prior = { token: process.env.SLIDEMUX_API_TOKEN, url: process.env.SLIDEMUX_API_URL };
  let recorder: RecordingSlidemuxFetch;

  beforeEach(() => {
    process.env.SLIDEMUX_API_TOKEN = "pat_test_secret";
    process.env.SLIDEMUX_API_URL = "https://slidemux.com";
    recorder = new RecordingSlidemuxFetch();
  });

  afterEach(() => {
    process.env.SLIDEMUX_API_TOKEN = prior.token;
    process.env.SLIDEMUX_API_URL = prior.url;
    if (prior.token === undefined) delete process.env.SLIDEMUX_API_TOKEN;
    if (prior.url === undefined) delete process.env.SLIDEMUX_API_URL;
  });

  it("appends with narration and a mid-deck position", async () => {
    await appendSlideFromRecipe("p1", { recipe: "stat", headline: "Cups a day", number: "2B", narration: "Two billion.", afterSlideId: "s1" }, recorder.fetch);

    expect(recorder.requests).toEqual([
      {
        url: "https://slidemux.com/api/projects/p1/recipe-slides",
        method: "POST",
        body: { recipe: "stat", headline: "Cups a day", number: "2B", narration: "Two billion.", afterSlideId: "s1" },
      },
    ]);
  });

  it("uploads the picture first, then replaces the slide in place", async () => {
    const base64 = Buffer.from("png-bytes").toString("base64");

    await replaceSlideFromRecipe("p1", "s2", { recipe: "split", headline: "Where beans grow", upload: { filename: "farm.png", base64 } }, recorder.fetch);

    expect(recorder.requests.map((row) => `${row.method} ${row.url}`)).toEqual([
      "POST https://slidemux.com/api/projects/p1/assets",
      "PUT https://slidemux.com/api/projects/p1/recipe-slides/s2",
    ]);
    expect(recorder.requests[1]!.body).toEqual({ recipe: "split", headline: "Where beans grow", imageAsset: "stored.png" });
  });

  it("moves a slide and reads the deck lint", async () => {
    await moveSlide("p1", "s3", undefined, recorder.fetch);
    await lintDeck("p1", recorder.fetch);

    expect(recorder.requests).toEqual([
      { url: "https://slidemux.com/api/projects/p1/scenes/s3/move", method: "POST", body: {} },
      { url: "https://slidemux.com/api/projects/p1/deck-lint", method: "GET", body: undefined },
    ]);
  });
});
