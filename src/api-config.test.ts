import { afterEach, describe, expect, it } from "vitest";
import { MissingSlidemuxApiConfigError, readSlidemuxApiConfig } from "./api-config.js";

describe("readSlidemuxApiConfig", () => {
  const priorToken = process.env.SLIDEMUX_API_TOKEN;
  const priorUrl = process.env.SLIDEMUX_API_URL;

  afterEach(() => {
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

  it("throws a clear error when SLIDEMUX_API_TOKEN is missing", () => {
    delete process.env.SLIDEMUX_API_TOKEN;
    process.env.SLIDEMUX_API_URL = "https://slidemux.com";
    expect(() => readSlidemuxApiConfig()).toThrow(MissingSlidemuxApiConfigError);
    expect(() => readSlidemuxApiConfig()).toThrow(
      "SLIDEMUX_API_TOKEN is not set. Sign in → Account → API tokens, then add the secret to the SlideMux MCP server env.",
    );
  });

  it("throws a clear error when SLIDEMUX_API_URL is missing", () => {
    process.env.SLIDEMUX_API_TOKEN = "pat_test_secret";
    delete process.env.SLIDEMUX_API_URL;
    expect(() => readSlidemuxApiConfig()).toThrow(/SLIDEMUX_API_URL/);
  });

  it("strips a trailing slash from the API URL", () => {
    process.env.SLIDEMUX_API_TOKEN = "pat_test_secret";
    process.env.SLIDEMUX_API_URL = "https://slidemux.com/";
    expect(readSlidemuxApiConfig()).toEqual({
      apiUrl: "https://slidemux.com",
      token: "pat_test_secret",
    });
  });
});
