/**
 * notifyfan core: one action router over an upstream Apprise API
 * server. The action catalogue is exactly the set documented in the
 * public README MCP Tool Reference of dinglebear-ai/rapprise:
 *
 *   health      Check Apprise API server health.        (read)
 *   status      Authenticated deployment/runtime status. (read)
 *   help        Built-in markdown tool help.             (read, local)
 *   notify      Send to a configured tag, or to all configured
 *               services when tag is omitted. Requires body;
 *               optional tag, title, type.               (write)
 *   notify_url  Stateless one-off send to one or more Apprise
 *               URL schemas. Requires urls and body;
 *               optional title, type.                    (write)
 *
 * Notification types: info, success, warning, failure.
 *
 * Endpoint mapping (DOCUMENTED RECONSTRUCTIONS from the standard
 * Apprise API — the README documents the actions, not the upstream
 * paths):
 *
 *   health      GET  /          upstream root liveness
 *   status      GET  /details   server details (Bearer when set)
 *   notify      POST /notify    JSON {body, tag?, title?, type?}
 *   notify_url  POST /notify    JSON {urls, body, title?, type?}
 *               (stateless form of the same endpoint; the upstream
 *               API has no separate /notify_url route)
 *   help        no HTTP; returns local documentation
 *
 * Configuration comes from the environment: APPRISE_URL is the
 * upstream base URL and defaults to http://localhost:8000;
 * APPRISE_TOKEN, when set, is sent as an `Authorization: Bearer`
 * header and is never accepted as a tool argument.
 *
 * All HTTP goes through an injected FetchFn so tests run entirely
 * on fixtures with no network.
 */
import type {
  AppriseAction,
  AppriseCallOptions,
  AppriseConfig,
  FetchFn,
  NotificationType,
} from "./types.js";

export const VERSION = "0.1.0";

export const DEFAULT_BASE_URL = "http://localhost:8000";

export const BASE_URL_ENV = "APPRISE_URL";
export const TOKEN_ENV = "APPRISE_TOKEN";

export const ACTIONS: readonly AppriseAction[] = [
  "health",
  "status",
  "help",
  "notify",
  "notify_url",
];

export const NOTIFICATION_TYPES: readonly NotificationType[] = [
  "info",
  "success",
  "warning",
  "failure",
];

/** Resolve runtime configuration from an environment-like record. */
export function resolveConfig(
  env: Record<string, string | undefined>,
): Required<AppriseConfig> {
  const url = typeof env[BASE_URL_ENV] === "string" ? env[BASE_URL_ENV]!.trim() : "";
  const token = typeof env[TOKEN_ENV] === "string" ? env[TOKEN_ENV]!.trim() : "";
  return {
    baseUrl: (url ? url : DEFAULT_BASE_URL).replace(/\/+$/, ""),
    token,
  };
}

/** Merge explicit config over defaults; base URL falls back to the default. */
export function normalizeConfig(config: AppriseConfig = {}): Required<AppriseConfig> {
  const base = typeof config.baseUrl === "string" ? config.baseUrl.trim() : "";
  const token = typeof config.token === "string" ? config.token.trim() : "";
  return {
    baseUrl: (base ? base : DEFAULT_BASE_URL).replace(/\/+$/, ""),
    token,
  };
}

function requireNonEmpty(value: unknown, field: string, action: string): string {
  const v = typeof value === "string" ? value.trim() : "";
  if (!v) throw new Error(`${field} is required for action "${action}"`);
  return v;
}

function optionalParam(value: unknown): string | undefined {
  const v = typeof value === "string" ? value.trim() : "";
  return v ? v : undefined;
}

function requireValidType(value: unknown): NotificationType | undefined {
  const v = optionalParam(value);
  if (v === undefined) return undefined;
  if (!(NOTIFICATION_TYPES as readonly string[]).includes(v)) {
    throw new Error(`type must be one of: ${NOTIFICATION_TYPES.join(", ")}`);
  }
  return v as NotificationType;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Local documentation for the router, returned by the help action. */
export function helpText(): string {
  return [
    "# apprise — notification fan-out router",
    "",
    "One tool, selected by the required `action` argument:",
    "",
    "## Read actions",
    "",
    "- `health` — Check Apprise API server health. No parameters.",
    "- `status` — Return authenticated deployment and runtime status. No parameters.",
    "- `help` — Return this built-in markdown tool help. No parameters, no upstream call.",
    "",
    "## Write actions",
    "",
    "- `notify` — Send to a configured Apprise tag, or to all configured",
    "  services when `tag` is omitted. Required: `body`. Optional: `tag`,",
    "  `title`, `type`.",
    "- `notify_url` — Send a stateless one-off notification to one or more",
    "  Apprise URL schemas. Required: `urls`, `body`. Optional: `title`, `type`.",
    "  `urls` is a single string; separate multiple URLs with commas.",
    "",
    "## Notification types",
    "",
    "- `info` — Informational notification.",
    "- `success` — Successful operation.",
    "- `warning` — Non-critical warning.",
    "- `failure` — Critical failure or error.",
    "",
    `Configuration: ${BASE_URL_ENV} (default ${DEFAULT_BASE_URL});`,
    `${TOKEN_ENV} is read from the environment only and is never a tool argument.`,
  ].join("\n");
}

/** JSON body for the notify action: body plus supplied optionals only. */
export function buildNotifyBody(options: AppriseCallOptions): Record<string, unknown> {
  const out: Record<string, unknown> = {
    body: requireNonEmpty(options.body, "body", "notify"),
  };
  const tag = optionalParam(options.tag);
  if (tag) out.tag = tag;
  const title = optionalParam(options.title);
  if (title) out.title = title;
  const type = requireValidType(options.type);
  if (type) out.type = type;
  return out;
}

/** JSON body for the notify_url action: urls and body plus supplied optionals only. */
export function buildNotifyUrlBody(options: AppriseCallOptions): Record<string, unknown> {
  const out: Record<string, unknown> = {
    urls: requireNonEmpty(options.urls, "urls", "notify_url"),
    body: requireNonEmpty(options.body, "body", "notify_url"),
  };
  const title = optionalParam(options.title);
  if (title) out.title = title;
  const type = requireValidType(options.type);
  if (type) out.type = type;
  return out;
}

async function callApi(
  fetchFn: FetchFn,
  config: Required<AppriseConfig>,
  method: string,
  path: string,
  body?: unknown,
): Promise<unknown> {
  const url = `${config.baseUrl}${path}`;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (config.token) headers.Authorization = `Bearer ${config.token}`;
  const init: { method: string; headers: Record<string, string>; body?: string } = {
    method,
    headers,
  };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  let response;
  try {
    response = await fetchFn(url, init);
  } catch (err) {
    throw new Error(
      `Apprise API request failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  const raw = await response.text().catch(() => "");
  let payload: unknown;
  let parsed = false;
  if (raw) {
    try {
      payload = JSON.parse(raw);
      parsed = true;
    } catch {
      parsed = false;
    }
  }
  if (!response.ok) {
    let detail = "";
    if (parsed && isRecord(payload)) {
      if (typeof payload.message === "string" && payload.message) {
        detail = `: ${payload.message}`;
      } else if (typeof payload.error === "string" && payload.error) {
        detail = `: ${payload.error}`;
      }
    } else if (raw) {
      detail = `: ${raw.slice(0, 200)}`;
    }
    throw new Error(
      `Apprise API request failed: HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ""}${detail}`,
    );
  }
  if (parsed) return payload;
  return raw ? raw : { ok: true, status: response.status };
}

/** Run one router action. This is the single entry point behind the tool. */
export async function runApprise(
  fetchFn: FetchFn,
  config: AppriseConfig,
  options: AppriseCallOptions,
): Promise<unknown> {
  const action = options.action;
  if (!ACTIONS.includes(action)) {
    throw new Error(`Unknown action: ${String(action)}. Valid actions: ${ACTIONS.join(", ")}`);
  }
  if (action === "help") return helpText();

  const cfg = normalizeConfig(config);
  switch (action) {
    case "health":
      return callApi(fetchFn, cfg, "GET", "/");
    case "status":
      return callApi(fetchFn, cfg, "GET", "/details");
    case "notify":
      return callApi(fetchFn, cfg, "POST", "/notify", buildNotifyBody(options));
    case "notify_url":
      return callApi(fetchFn, cfg, "POST", "/notify", buildNotifyUrlBody(options));
  }
}

/** Render a payload as the JSON text block MCP clients show. */
export function formatPayload(payload: unknown): string {
  return typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
}
