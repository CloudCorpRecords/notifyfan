#!/usr/bin/env node
/**
 * notifyfan CLI.
 *
 *   notifyfan health
 *   notifyfan status
 *   notifyfan help
 *   notifyfan notify <body> [--tag TAG] [--title T] [--type info|success|warning|failure]
 *   notifyfan notify-url <urls> <body> [--title T] [--type info|success|warning|failure]
 *   notifyfan mcp
 *   notifyfan --version
 *
 * Configuration from the environment: APPRISE_URL (default
 * http://localhost:8000), APPRISE_TOKEN (optional Bearer token,
 * env only — never a CLI or tool argument).
 * Exit codes: 0 success, 1 tool/API error, 2 usage error.
 */
import { formatPayload, helpText, resolveConfig, runApprise, VERSION } from "./notifyfan.js";
import type { AppriseCallOptions, FetchFn } from "./types.js";

function usage(): never {
  console.error(`Usage:
  notifyfan health
  notifyfan status
  notifyfan help
  notifyfan notify <body> [--tag TAG] [--title T] [--type info|success|warning|failure]
  notifyfan notify-url <urls> <body> [--title T] [--type info|success|warning|failure]
  notifyfan mcp
  notifyfan --version`);
  process.exit(2);
}

/** Split argv into positionals and --flag value pairs. */
function parseArgs(rest: string[]): { positionals: string[]; flags: Record<string, string> } {
  const positionals: string[] = [];
  const flags: Record<string, string> = {};
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === "--tag" || a === "--title" || a === "--type") {
      const v = rest[++i];
      if (!v) usage();
      flags[a] = v;
    } else if (a.startsWith("--")) {
      usage();
    } else {
      positionals.push(a);
    }
  }
  return { positionals, flags };
}

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === "--version" || cmd === "-v") {
    console.log(VERSION);
    return;
  }
  if (cmd === "mcp") {
    await import("./mcp.js");
    return;
  }
  if (cmd === "help" || cmd === "--help" || cmd === "-h") {
    console.log(helpText());
    return;
  }
  if (!cmd) usage();
  const known = ["health", "status", "notify", "notify-url"];
  if (!known.includes(cmd)) usage();

  let options: AppriseCallOptions;
  if (cmd === "health" || cmd === "status") {
    if (rest.length) usage();
    options = { action: cmd };
  } else if (cmd === "notify") {
    const { positionals, flags } = parseArgs(rest);
    if (positionals.length !== 1) usage();
    options = {
      action: "notify",
      body: positionals[0],
      tag: flags["--tag"],
      title: flags["--title"],
      type: flags["--type"],
    };
  } else {
    const { positionals, flags } = parseArgs(rest);
    if (positionals.length !== 2) usage();
    if (flags["--tag"] !== undefined) usage();
    options = {
      action: "notify_url",
      urls: positionals[0],
      body: positionals[1],
      title: flags["--title"],
      type: flags["--type"],
    };
  }

  const fetchFn = globalThis.fetch as unknown as FetchFn;
  const config = resolveConfig(process.env);
  try {
    const out = await runApprise(fetchFn, config, options);
    console.log(formatPayload(out));
  } catch (err) {
    console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

void main();
