const IMPORT_LINE =
  'import { slidemuxPlaywrightUse, slidemuxReporter } from "@slidemux/playwright";';

/** Inserts SlideMux reporter + use() into a Playwright config source. */
export function patchPlaywrightConfig(source: string): { next: string; changed: boolean } {
  if (source.includes("@slidemux/playwright")) {
    return { next: source, changed: false };
  }

  let next = `${IMPORT_LINE}\n${source}`;
  next = ensureReporter(next);
  next = ensureUseSpread(next);
  return { next, changed: true };
}

function ensureReporter(source: string): string {
  if (source.includes("slidemuxReporter(")) {
    return source;
  }
  if (/reporter:\s*\[/.test(source)) {
    return source.replace(/reporter:\s*\[/, "reporter: [slidemuxReporter(), ");
  }
  return source.replace(/defineConfig\(\s*\{/, "defineConfig({\n  reporter: [slidemuxReporter()],");
}

function ensureUseSpread(source: string): string {
  if (source.includes("slidemuxPlaywrightUse(")) {
    return source;
  }
  if (/use:\s*\{/.test(source)) {
    return source.replace(/use:\s*\{/, "use: {\n    ...slidemuxPlaywrightUse(),");
  }
  return source.replace(/defineConfig\(\s*\{/, "defineConfig({\n  use: {\n    ...slidemuxPlaywrightUse(),\n  },");
}
