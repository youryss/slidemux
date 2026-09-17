import { randomBytes } from "node:crypto";
import type { SlidemuxManifest } from "./manifest.js";

export type ImportManifest = {
  schemaVersion: 1;
  tests: Array<{
    title: string;
    file: string;
    steps: Array<{ slug: string; file: string | null }>;
  }>;
};

export type ImportMultipartBody = {
  contentType: string;
  body: Buffer;
};

/** Converts a local recording manifest to the Playwright import API shape. */
export function buildImportManifest(manifest: SlidemuxManifest): ImportManifest {
  return {
    schemaVersion: 1,
    tests: manifest.tests.map((test) => ({
      title: test.title,
      file: test.file,
      steps: test.steps.map((step) => ({ slug: step.slug, file: step.file })),
    })),
  };
}

/** Builds a multipart/form-data body for POST /api/playwright-imports. */
export function buildImportMultipart(
  manifest: ImportManifest,
  clips: Map<string, Buffer>,
): ImportMultipartBody {
  const boundary = `slidemux-${randomBytes(16).toString("hex")}`;
  const parts: Buffer[] = [];
  parts.push(buildFieldPart(boundary, "manifest", JSON.stringify(manifest)));
  for (const [filename, bytes] of clips) {
    parts.push(buildFilePart(boundary, filename, bytes));
  }
  parts.push(Buffer.from(`--${boundary}--\r\n`));
  return {
    contentType: `multipart/form-data; boundary=${boundary}`,
    body: Buffer.concat(parts),
  };
}

function buildFieldPart(boundary: string, name: string, value: string): Buffer {
  return Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
  );
}

function buildFilePart(boundary: string, filename: string, bytes: Buffer): Buffer {
  const header = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="${filename}"; filename="${filename}"\r\nContent-Type: application/octet-stream\r\n\r\n`,
  );
  const footer = Buffer.from("\r\n");
  return Buffer.concat([header, bytes, footer]);
}
