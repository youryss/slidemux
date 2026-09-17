import path from "node:path";

/** Resolve `segments` under `root`. Throws if any segment is absolute or the result leaves `root`. */
export function resolveContained(root: string, ...segments: string[]): string {
  for (const segment of segments) {
    if (path.isAbsolute(segment)) {
      throw new Error(`path ${JSON.stringify(segment)} must be relative to ${JSON.stringify(root)}`);
    }
  }
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, ...segments);
  const relative = path.relative(resolvedRoot, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`path ${JSON.stringify(path.join(...segments))} escapes ${JSON.stringify(resolvedRoot)}`);
  }
  return resolved;
}

/** Rejects absolute paths and `..` segments in untrusted manifest/MCP path fields. */
export function assertRelativePath(value: string, field: string): void {
  const parts = value.split(/[\\/]/);
  if (!value || path.isAbsolute(value) || parts.includes("..") || parts.includes("")) {
    throw new Error(`${field} must be a relative path inside the bundle, got ${JSON.stringify(value)}`);
  }
}
