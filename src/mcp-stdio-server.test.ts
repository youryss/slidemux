import { afterEach, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { ResourceListChangedNotificationSchema } from "@modelcontextprotocol/sdk/types.js";
import { createStdioMcpServer } from "./mcp-stdio-server.js";
import { createMcpGenerateCompletionSink } from "./mcp-generate-completion-sink.js";

describe("stdio MCP generate completion signal", () => {
  const clients: Client[] = [];

  afterEach(async () => {
    await Promise.all(clients.map((client) => client.close().catch(() => undefined)));
    clients.length = 0;
  });

  it("advertises resources.listChanged and notifies when a terminal job resource appears", async () => {
    const server = createStdioMcpServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "test", version: "0.0.0" });
    clients.push(client);
    await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);

    expect(client.getServerCapabilities()?.resources?.listChanged).toBe(true);

    const listedBefore = await client.listResources();
    expect(listedBefore.resources.some((row) => row.uri.startsWith("slidemux://generate/jobs/"))).toBe(
      false,
    );

    const listChanged = new Promise<void>((resolve) => {
      client.setNotificationHandler(ResourceListChangedNotificationSchema, () => resolve());
    });

    const sink = createMcpGenerateCompletionSink(server);
    const payload = { job: { id: "job-42", status: { status: "completed" } } };
    sink.publish("slidemux://generate/jobs/job-42", payload);
    sink.sendListChanged();
    await listChanged;

    const listed = await client.listResources();
    expect(listed.resources.map((row) => row.uri)).toContain("slidemux://generate/jobs/job-42");
    const read = await client.readResource({ uri: "slidemux://generate/jobs/job-42" });
    expect(read.contents[0]).toMatchObject({
      uri: "slidemux://generate/jobs/job-42",
      mimeType: "application/json",
    });
    expect(JSON.parse(String((read.contents[0] as { text?: string }).text))).toEqual(payload);
  });

  it("lists the topic skill resource beside the recording skills", async () => {
    const server = createStdioMcpServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "test", version: "0.0.0" });
    clients.push(client);
    await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);

    const uris = (await client.listResources()).resources.map((row) => row.uri);
    expect(uris).toContain("skill://slidemux/slidemux-topic/SKILL.md");
    expect(uris).toContain("skill://slidemux/slidemux-design/SKILL.md");
    expect(uris).toContain("skill://slidemux/slidemux-workflow/SKILL.md");
    const read = await client.readResource({ uri: "skill://slidemux/slidemux-topic/SKILL.md" });
    expect(String((read.contents[0] as { text?: string }).text)).toMatch(/slidemux-topic/);
  });

  it("registers topic-deck authoring tools on stdio", async () => {
    const server = createStdioMcpServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "test", version: "0.0.0" });
    clients.push(client);
    await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);

    const names = (await client.listTools()).tools.map((tool) => tool.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "create_topic_deck",
        "get_project",
        "append_slide",
        "append_slide_from_recipe",
        "add_text_box",
        "add_image_box",
        "add_video_box",
        "upload_recording",
      ]),
    );
    for (const tool of (await client.listTools()).tools) {
      expect(tool.inputSchema?.properties?.prompt).toBeUndefined();
      expect(tool.inputSchema?.properties?.duration).toBeUndefined();
    }
  });

  it("lets add_image_box and add_video_box take a disk filePath instead of base64", async () => {
    const server = createStdioMcpServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "test", version: "0.0.0" });
    clients.push(client);
    await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);

    const tools = (await client.listTools()).tools;
    for (const name of ["add_image_box", "add_video_box"] as const) {
      const upload = (tools.find((tool) => tool.name === name)?.inputSchema as {
        properties?: { upload?: { properties?: Record<string, unknown>; required?: string[] } };
      }).properties?.upload;
      expect(upload?.properties?.filePath).toEqual(expect.objectContaining({ type: "string" }));
      expect(upload?.required).not.toContain("base64");
    }
  });
});
