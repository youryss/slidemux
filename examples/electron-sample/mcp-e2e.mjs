// E2E driver: talks to the slidemux MCP server over stdio and records the
// Electron sample through the real record_test / get_bundle_status tools.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const exampleDir = path.dirname(fileURLToPath(import.meta.url));
const serverEntry = path.resolve(exampleDir, "../../dist/mcp.js");

const client = new Client({ name: "electron-sample-e2e", version: "0.0.0" });
await client.connect(new StdioClientTransport({ command: "node", args: [serverEntry], cwd: exampleDir }));

const record = await client.callTool({ name: "record_test", arguments: {} }, undefined, { timeout: 300_000 });
console.log("--- record_test ---");
console.log(record.content[0].text);

const status = await client.callTool({ name: "get_bundle_status", arguments: {} });
console.log("--- get_bundle_status ---");
console.log(status.content[0].text);

await client.close();

const manifest = JSON.parse(status.content[0].text);
const clips = manifest.tests[0]?.steps ?? [];
if (clips.length !== 2 || clips.some((clip) => clip.file === null)) {
  console.error("FAIL: expected 2 step clips with files, got", JSON.stringify(clips));
  process.exit(1);
}
console.log("OK: bundle has 2 aligned step clips");
