import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { GenerateCompletionSink } from "./generate-completion-signal.js";
import { GENERATE_JOB_RESOURCE_PREFIX } from "./generate-completion-signal.js";

/** MCP resource + list_changed sink. Example: `createMcpGenerateCompletionSink(server)` */
export function createMcpGenerateCompletionSink(server: McpServer): GenerateCompletionSink {
  return {
    publish(uri: string, payload: unknown) {
      if (!uri.startsWith(GENERATE_JOB_RESOURCE_PREFIX)) {
        throw new Error(
          `generate completion URI must start with ${GENERATE_JOB_RESOURCE_PREFIX}; got ${JSON.stringify(uri)}`,
        );
      }
      const jobId = uri.slice(GENERATE_JOB_RESOURCE_PREFIX.length);
      server.registerResource(
        `generate-job-${jobId}`,
        uri,
        { title: `Generate job ${jobId}`, mimeType: "application/json" },
        async () => ({
          contents: [{ uri, mimeType: "application/json", text: JSON.stringify(payload, null, 2) }],
        }),
      );
    },
    sendListChanged() {
      server.sendResourceListChanged();
    },
  };
}
