#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createStdioMcpServer } from "./mcp-stdio-server.js";

await createStdioMcpServer().connect(new StdioServerTransport());
