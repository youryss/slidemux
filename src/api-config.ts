export class MissingSlidemuxApiConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MissingSlidemuxApiConfigError";
  }
}

export type SlidemuxApiConfig = {
  apiUrl: string;
  token: string;
};

/** Reads PAT env for cloud MCP tools. Example: `const { apiUrl, token } = readSlidemuxApiConfig();` */
export function readSlidemuxApiConfig(): SlidemuxApiConfig {
  const token = process.env.SLIDEMUX_API_TOKEN?.trim();
  if (!token) {
    throw new MissingSlidemuxApiConfigError(
      "SLIDEMUX_API_TOKEN is not set. Sign in → Account → API tokens, then add the secret to the SlideMux MCP server env.",
    );
  }
  const apiUrl = process.env.SLIDEMUX_API_URL?.trim();
  if (!apiUrl) {
    throw new MissingSlidemuxApiConfigError(
      "SLIDEMUX_API_URL is not set. Point it at your SlideMux app origin, e.g. https://slidemux.com.",
    );
  }
  return { apiUrl: apiUrl.replace(/\/$/, ""), token };
}
