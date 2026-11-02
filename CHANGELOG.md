# Changelog

## 0.1.0 (2026-10-27)

- Initial release.
- CLI: `notifyfan health|status|help`, `notifyfan notify <body>
  [--tag TAG] [--title T] [--type TYPE]`, `notifyfan notify-url
  <urls> <body> [--title T] [--type TYPE]`, and `notifyfan mcp`.
- MCP server (`notifyfan mcp`, stdio) with one tool: `apprise`, an
  action router covering exactly the documented catalogue — read
  actions `health`, `status`, `help` and write actions `notify`
  (body required; tag, title, type optional) and `notify_url`
  (urls and body required; title, type optional). Notification
  types: `info`, `success`, `warning`, `failure`.
- Calls go to the Apprise API server under the base URL from
  `APPRISE_URL`, defaulting to `http://localhost:8000`; when
  `APPRISE_TOKEN` is set it is sent as an `Authorization: Bearer`
  header from the environment only, never as a tool argument.
- Upstream paths are documented reconstructions from the standard
  Apprise API: `POST /notify` for both write actions (tagged form
  and stateless urls form), `GET /` for health, `GET /details` for
  status. The `help` action is answered locally.
- HTTP failures surface the status plus the upstream `message` or
  `error` when present.
- All HTTP goes through an injectable fetch function, so the test
  suite runs entirely on hand-written fixtures with no network access.
