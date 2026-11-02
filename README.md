# notifyfan

notifyfan sends notifications through an Apprise API server. A single
tool, `apprise`, fans a message out to the destinations Apprise is
configured with: send to one configured tag (or to every configured
service), fire a one-off send at raw Apprise URL schemas, and check
that the upstream server is alive — all through one action argument
instead of a tool per operation. One binary serves a command-line
interface and a stdio MCP server.

## Configuration

Two environment variables configure the upstream connection:

- `APPRISE_URL` — the Apprise API server base URL. Defaults to
  `http://localhost:8000`.
- `APPRISE_TOKEN` — optional. When the upstream requires bearer auth,
  set it and notifyfan sends `Authorization: Bearer <token>` on every
  upstream call. It is read from the environment only: it is never a
  CLI flag and never an MCP tool argument.

The `help` action works with nothing configured at all.

## Install

```bash
npx @reneturcios/notifyfan health
```

Or run the container image:

```bash
docker run -i ghcr.io/cloudcorprecords/notifyfan
```

The container defaults to the MCP server. Pass CLI arguments to use
it as a CLI instead.

## CLI

```bash
notifyfan health
notifyfan status
notifyfan help
notifyfan notify "Deployment succeeded" --tag ops --title "Deploy complete" --type success
notifyfan notify "Standup notes are posted"
notifyfan notify-url "mailto://user@example.com" "Build finished" --type info

notifyfan --version
```

`notify` needs only a body; omit `--tag` to send to all configured
services. `notify-url` takes the Apprise URLs first (one string;
separate several URLs with commas) and then the body. Exit codes:
`0` on success, `1` when a call fails (validation or upstream error),
`2` for usage errors.

## MCP server

```bash
npx -y @reneturcios/notifyfan mcp
```

MCP client configuration:

```json
{
  "mcpServers": {
    "notifyfan": {
      "command": "npx",
      "args": ["-y", "@reneturcios/notifyfan", "mcp"],
      "env": {
        "APPRISE_URL": "http://localhost:8000"
      }
    }
  }
}
```

Add `APPRISE_TOKEN` to the `env` block only when your Apprise API
server requires it.

### Tool

| Tool | Input | What it does |
| --- | --- | --- |
| `apprise` | `action` (string, required) plus the per-action parameters below | Runs the named action against the upstream Apprise API server. |

Actions:

| Action | Required | Optional | What it does |
| --- | --- | --- | --- |
| `health` | — | — | Check Apprise API server health. |
| `status` | — | — | Return authenticated deployment and runtime status. |
| `help` | — | — | Return built-in markdown tool help. Makes no upstream call. |
| `notify` | `body` | `tag`, `title`, `type` | Send to a configured Apprise tag, or to all configured services when `tag` is omitted. |
| `notify_url` | `urls`, `body` | `title`, `type` | Send a stateless one-off notification to one or more Apprise URL schemas. `urls` is a single string; separate multiple URLs with commas. |

`type` is one of `info` (informational), `success` (successful
operation), `warning` (non-critical warning), or `failure` (critical
failure or error). Unknown actions, a missing `body`/`urls`, and an
invalid `type` are errors raised before any upstream call.

Example call:

```json
{
  "name": "apprise",
  "arguments": {
    "action": "notify",
    "body": "Deployment succeeded",
    "tag": "ops",
    "title": "Deploy complete",
    "type": "success"
  }
}
```

### Upstream mapping and known gaps

The action catalogue above is the documented surface. The upstream
paths are documented reconstructions from the standard Apprise API:
`notify` posts `{body, tag?, title?, type?}` to `POST /notify`, and
`notify_url` posts `{urls, body, title?, type?}` to the same endpoint
— the stateless form; the upstream API has no separate `/notify_url`
route. `health` reads `GET /` (the upstream root) and `status` reads
`GET /details`. Payload fields that were not supplied are omitted,
never sent empty. Upstream failures surface the HTTP status plus the
upstream `message` or `error` string when one is present, and a
non-JSON success body is returned as raw text.

- The original's HTTP transport, OAuth, and `send_alert` prompt are
  not reproduced; this rebuild is stdio-only.
- No live Apprise API server was used while building: every upstream
  behaviour is verified against a fake fetch in the test suite.

## Development

```bash
npm install
npm run build   # tsc -> dist/
npm test        # node test runner over test/*.test.ts, no network (fake fetch fixtures)
npm run dev     # run the CLI from source via tsx
```

## License

MIT — see `LICENSE`.
