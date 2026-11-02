# notifyfan — Build Report

MCP Rebuild 1000, Tranche #101+ Batch 5. Clean-room rebuild of
dinglebear-ai/rapprise (Apprise) (rank 177, 2 stars), built from
the public README "MCP Tool Reference" spec captured in
`harness/fixtures/apprise-rmcp-tools-original.json`. That fixture
is docs-derived: the single `apprise` router tool and its full
documented action catalogue are as the README documents them, and
the upstream endpoint paths are documented reconstructions from
the standard Apprise API — no original server was probed. Parity
proves the rebuild matches this program's defined spec, labelled
docs-derived. Local build only — nothing pushed or published.

Identity: repo `notifyfan`, npm `@reneturcios/notifyfan`,
MCP name `io.github.CloudCorpRecords/notifyfan`, version `0.1.0`.
Build dir: `~/workspace/mcp-rebuild-100/builds/notifyfan/`

## Files created (19/19 per TEMPLATE.md checklist)

- `package.json` — bin `notifyfan: dist/cli.js`, `mcpName` set,
  scripts build=`tsc` / dev=`tsx src/cli.ts` / test=`tsx --test test/*.test.ts`
- `server.json` — description "Apprise notification fan-out:
  health, status, and tagged or one-off sends." = **74 chars**
  (≤100 ✓); npm entry carries `version: 0.1.0`; OCI entry
  `ghcr.io/cloudcorprecords/notifyfan:0.1.0` carries **no**
  `version` field (verified programmatically)
- `Dockerfile` — node:20-alpine two-stage, ENTRYPOINT
  `node /app/dist/cli.js`, CMD `mcp`, label
  `io.modelcontextprotocol.server.name="io.github.CloudCorpRecords/notifyfan"`
- `tsconfig.json` (identical to the fleet template), `.gitignore`,
  `LICENSE` (MIT, Copyright (c) 2026 Rene Turcios), `README.md`
  (fresh text), `CHANGELOG.md` (single 0.1.0 entry, 2026-10-27)
- `src/index.ts`, `src/cli.ts` (`health`, `status`, `help`,
  `notify <body> [--tag] [--title] [--type]`, `notify-url <urls>
  <body> [--title] [--type]`, `mcp`, `--version`; exit 2 usage /
  1 tool error), `src/mcp.ts`, `src/types.ts`, `src/notifyfan.ts`
  (core logic, `VERSION = "0.1.0"`)
- `test/notifyfan.test.ts`
- `.github/workflows/{ci,publish,publish-container,registry-publish}.yml`
  (from the fleet template; image name and smoke-test server name
  changed to notifyfan)

Fixture created first:
`~/workspace/mcp-rebuild-100/harness/fixtures/apprise-rmcp-tools-original.json`
— 1 tool (`apprise`), with a `_source` recording the docs-derived
provenance (README MCP Tool Reference retrieved 2026-10-27) and
labelling the endpoint reconstructions.

## Tools implemented (1 tool, 5 actions — the exact documented catalogue)

Single router tool `apprise` (required `action`, per-action
optional params). The README MCP Tool Reference documents exactly
these actions — no others were built:

Read actions:

- `health` — Check Apprise API server health. No params.
- `status` — Return authenticated deployment and runtime status.
  No params.
- `help` — Return built-in markdown tool help. No params.

Write actions:

- `notify` — Send to a configured Apprise tag, or all configured
  services when `tag` is omitted. Required: `body`. Optional:
  `tag`, `title`, `type`.
- `notify_url` — Send a stateless one-off notification to one or
  more Apprise URL schemas. Required: `urls`, `body`. Optional:
  `title`, `type`.

Notification types (documented): `info`, `success`, `warning`,
`failure` — enforced as the `type` enum in schema, zod, and core.

## Implementation notes

- `src/mcp.ts` uses the SDK's low-level `Server` with an explicit
  inputSchema literal, per the standing fleet rule: `McpServer`'s
  zod-to-JSON-Schema conversion injects `$schema` /
  `additionalProperties` keys that are absent from the defined spec
  and break exact schema parity. Zod still validates every
  `tools/call` (action and type are zod enums).
- Upstream: base URL from env `APPRISE_URL` (default
  `http://localhost:8000`, trailing slashes stripped). Optional
  `APPRISE_TOKEN` is sent as `Authorization: Bearer <token>` only
  when set, and only from the environment — it is never a tool
  argument, a CLI flag, or part of the schema (per the original's
  documented safety rule).
- Endpoint mapping — **documented reconstructions** from the
  standard Apprise API (the README documents the actions, not the
  upstream paths; labelled as reconstructions in the fixture
  `_source`, the core header, the README, and here):
  `health` → `GET /` (upstream root); `status` → `GET /details`;
  `notify` → `POST /notify` with JSON `{body, tag?, title?,
  type?}`; `notify_url` → `POST /notify` with JSON `{urls, body,
  title?, type?}` — the stateless form of the same endpoint; the
  upstream API has no separate `/notify_url` route, so the action
  name maps to the `urls` payload form. Supplied-only fields are
  sent; absent optionals are omitted, never sent empty.
- `help` is answered locally with markdown help text — no upstream
  call and no environment needed.
- Local validation before any request: unknown action (error
  lists the valid actions), `notify` without a non-empty `body`,
  `notify_url` without non-empty `urls` or `body`, and a `type`
  outside the four documented values all fail with zero fetch
  calls (tests assert this).
- The `urls` parameter is modelled as a single string
  (comma-separated when more than one URL), matching the original
  CLI's `<urls>` positional form and the Apprise API's string form.
- HTTP failures surface the status plus the upstream `message` or
  `error` string when present (a non-JSON error body is included
  truncated); network failures are wrapped with context. A
  non-JSON success body (e.g. an HTML root page from `health`) is
  returned as raw text.
- All HTTP flows through an injectable `FetchFn` (types.ts). The
  test suite uses a fake fetch returning hand-written
  Apprise-shaped fixtures; no live call is made in tests.

## Verification (foreground, exact outputs)

### 1. Build
```
$ ./node_modules/.bin/tsc ; echo tsc_exit=$?
tsc_exit=0
```
(clean rebuild from a removed `dist/`; `dist/` produced including
`dist/cli.js`.)

### 2. Tests
```
$ ./node_modules/.bin/tsx --test test/*.test.ts
ℹ tests 18
ℹ pass 18
ℹ fail 0
```
Covers: base-URL default/custom/trailing-slash and token config;
the exact 5-action and 4-type catalogues; help locally with no
fetch; unknown-action, missing body, missing urls/body, and
invalid-type rejections all with no-fetch assertions; notify and
notify_url payload builders (supplied fields only); health `GET /`
on the default base with no Authorization header when no token
is set; status `GET /details` with the Bearer header when set;
notify `POST /notify` full and body-only payloads; notify_url
stateless `POST /notify` on a custom base; non-JSON success body
returned as text; HTTP 424 surfacing the upstream message;
network failure wrapping.

### 3. CLI / MCP smoke
`--version` → `0.1.0` (exit 0); unknown command exits 2 with
Usage; `help` prints the local help text. MCP `initialize` over
stdio → `serverInfo: {"name":"notifyfan","version":"0.1.0"}`;
`tools/list` → the single `apprise` tool with the fixture schema;
a stdio `tools/call` for `{"action":"help"}` returned the local
markdown help. No live Apprise call was made in smoke — the help
path needs no network, and no live result is claimed.

### 4. Parity (harness, from ~/workspace/mcp-rebuild-100/harness/)
```
$ python3 parity.py --original fixtures/apprise-rmcp-tools-original.json \
    --rebuild "stdio:node .../builds/notifyfan/dist/cli.js mcp" \
    --out .../builds/notifyfan/parity-out
verdict=PASS parity_pct=100.0 original_tools=1 rebuild_tools=1 missing=[] extra=[] schema_diffs=[]
(exit 0)
```
(parity.json: identical_tools 1/1.) Original side is tools-file
mode, so `fixture_results` records `SKIPPED-TOOLS-FILE-MODE` —
expected harness semantics, not an error.

## Lockfile status

`package-lock.json` was generated clean via Route 3: a temp copy
holding only `package.json` (no `node_modules`), offline
`npm install --package-lock-only --ignore-scripts`, verified after
generation — parses as JSON, top-level `name` is
`@reneturcios/notifyfan`, version `0.1.0`, `lockfileVersion` 3,
128 package entries — then only the lockfile was copied back and
re-verified in place (name and 128 entries). Local `node_modules`
is a symlink to fxrates' tree, used only for the local build/test;
it is not part of the lockfile generation. (A bulk `cp -a` of the
tree was attempted first and the VM write guard silently
zero-truncated 1,540 of its files; the damaged copy was removed
and replaced with the symlink, then the build and tests were
re-run clean from scratch.)

## Gaps / honest notes

- Docs-derived spec: the action catalogue is exactly what the
  README MCP Tool Reference documents (5 actions). The README
  notes that `docs/INVENTORY.md` in the original repo is the
  source of truth for complete parameters until a generated
  schema doc exists; per this task's spec-retrieval scope (the
  README Tool Reference), no further parameters were invented —
  if the inventory documents more, they are not in this rebuild.
- Endpoint paths are documented reconstructions (see above), not
  probed paths: `GET /`, `GET /details`, and the two `POST
  /notify` forms follow the standard Apprise API, but field-level
  drift against a real Apprise API server — and against the
  original server's exact upstream shaping for `health`/`status`
  — is unverified until a live smoke.
- `urls` is a single comma-separated string, not a JSON array;
  callers holding an array must join it. This follows the
  original CLI's `<urls>` form.
- The original's `send_alert` prompt, HTTP transport, and
  OAuth/bearer inbound auth are not reproduced; this rebuild is
  stdio-only with the env-token model above. Its CLI-only
  `doctor`/`setup` commands are likewise out of the MCP tool
  catalogue and not reproduced.
- No live call was made: every endpoint is fake-fetch tested
  only, so live payload/response-shape drift against a real
  Apprise API server is unverified until the publish wave.
- Container build not exercised locally; the publish-container
  workflow smoke-tests the image at publish time.
