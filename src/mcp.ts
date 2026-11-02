/**
 * notifyfan MCP server. One tool: apprise (action router).
 *
 * Why the low-level Server instead of McpServer: the high-level
 * helper converts zod schemas to JSON Schema and injects keys that
 * are not in this tool's public spec ("$schema" and
 * "additionalProperties"), which breaks exact tool-list/schema
 * parity with the spec. This file serves tools/list with the
 * spec's exact input schema as an explicit literal, while zod
 * still validates every tools/call argument set.
 *
 * Configuration is read from the environment at call time:
 * APPRISE_URL (default http://localhost:8000) and APPRISE_TOKEN
 * (optional, sent only as an Authorization Bearer header; it is
 * never a tool argument).
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { ACTIONS, formatPayload, NOTIFICATION_TYPES, resolveConfig, runApprise, VERSION } from "./notifyfan.js";
import type { AppriseAction, FetchFn, NotificationType } from "./types.js";

const AppriseArgs = z.object({
  action: z.enum(ACTIONS as unknown as [AppriseAction, ...AppriseAction[]]),
  body: z.string().optional(),
  tag: z.string().optional(),
  title: z.string().optional(),
  type: z.enum(NOTIFICATION_TYPES as unknown as [NotificationType, ...NotificationType[]]).optional(),
  urls: z.string().optional(),
});

const TOOLS = [
  {
    name: "apprise",
    description:
      "Run one Apprise notification action: health, status, help, notify, or notify_url.",
    inputSchema: {
      type: "object" as const,
      properties: {
        action: {
          type: "string",
          enum: ["health", "status", "help", "notify", "notify_url"],
          description: "Action to run: health, status, help, notify, or notify_url.",
        },
        body: { type: "string", description: "Notification body text, for the notify action." },
        tag: { type: "string", description: "Tag filter selecting which configured services receive the notification." },
        title: { type: "string", description: "Notification title, for the notify action." },
        type: {
          type: "string",
          enum: ["info", "success", "warning", "failure"],
          description: "Notification type: info, success, warning, or failure.",
        },
        urls: { type: "string", description: "Apprise URL or URLs to send to, for the notify_url action." },
      },
      required: ["action"],
    },
  },
];

function textResult(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: typeof value === "string" ? value : JSON.stringify(value, null, 2),
      },
    ],
  };
}

function errorResult(err: unknown) {
  return {
    content: [
      { type: "text" as const, text: err instanceof Error ? err.message : String(err) },
    ],
    isError: true,
  };
}

const server = new Server(
  { name: "notifyfan", version: VERSION },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const fetchFn = globalThis.fetch as unknown as FetchFn;
  const config = resolveConfig(process.env);
  try {
    if (name !== "apprise") {
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
    const parsed = AppriseArgs.parse(args ?? {});
    const out = await runApprise(fetchFn, config, parsed);
    return textResult(formatPayload(out));
  } catch (err) {
    if (err instanceof McpError) throw err;
    return errorResult(err);
  }
});

async function main(): Promise<void> {
  await server.connect(new StdioServerTransport());
}

void main();
