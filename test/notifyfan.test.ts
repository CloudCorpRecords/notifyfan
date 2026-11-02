import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ACTIONS,
  buildNotifyBody,
  buildNotifyUrlBody,
  helpText,
  NOTIFICATION_TYPES,
  normalizeConfig,
  resolveConfig,
  runApprise,
} from "../src/notifyfan.js";
import type { FetchFn, HttpResponse } from "../src/types.js";

function jsonResponse(body: unknown, status = 200, statusText = "OK"): HttpResponse {
  const raw = typeof body === "string" ? body : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    headers: { get: () => "application/json" },
    text: async () => raw,
    json: async () => (typeof body === "string" ? JSON.parse(body) : body),
  };
}

interface Captured {
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

function fakeFetch(captured: Captured, body: unknown = {}): FetchFn {
  return async (url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => {
    captured.url = url;
    captured.method = init?.method;
    captured.headers = init?.headers;
    captured.body = init?.body;
    return jsonResponse(body);
  };
}

const BASE = "http://localhost:8000";

describe("config resolution", () => {
  it("defaults to http://localhost:8000 with no token", () => {
    const cfg = resolveConfig({});
    assert.equal(cfg.baseUrl, BASE);
    assert.equal(cfg.token, "");
    assert.equal(normalizeConfig({}).baseUrl, BASE);
  });

  it("honours a custom APPRISE_URL, strips trailing slashes, keeps the token", () => {
    const cfg = resolveConfig({ APPRISE_URL: "http://apprise.test:9000/", APPRISE_TOKEN: "sekret" });
    assert.equal(cfg.baseUrl, "http://apprise.test:9000");
    assert.equal(cfg.token, "sekret");
    assert.equal(normalizeConfig({ baseUrl: "http://x.test//" }).baseUrl, "http://x.test");
  });

  it("exposes exactly the five documented actions and four notification types", () => {
    assert.deepEqual([...ACTIONS], ["health", "status", "help", "notify", "notify_url"]);
    assert.deepEqual([...NOTIFICATION_TYPES], ["info", "success", "warning", "failure"]);
  });
});

describe("help", () => {
  it("returns local markdown help without any fetch", async () => {
    let called = false;
    const spy: FetchFn = async () => { called = true; return jsonResponse({}); };
    const out = (await runApprise(spy, {}, { action: "help" })) as string;
    assert.match(out, /notify_url/);
    assert.match(out, /failure/);
    assert.ok(helpText().length > 200);
    assert.equal(called, false);
  });
});

describe("validation", () => {
  it("rejects an unknown action listing valid actions, without fetching", async () => {
    let called = false;
    const spy: FetchFn = async () => { called = true; return jsonResponse({}); };
    await assert.rejects(
      () => runApprise(spy, {}, { action: "nope" as never }),
      /Unknown action: nope.*health.*notify_url/,
    );
    assert.equal(called, false);
  });

  it("notify requires a non-empty body before any request", async () => {
    let called = false;
    const spy: FetchFn = async () => { called = true; return jsonResponse({}); };
    await assert.rejects(() => runApprise(spy, {}, { action: "notify" }), /body is required/);
    await assert.rejects(() => runApprise(spy, {}, { action: "notify", body: "   " }), /body is required/);
    assert.equal(called, false);
  });

  it("notify_url requires urls and body before any request", async () => {
    let called = false;
    const spy: FetchFn = async () => { called = true; return jsonResponse({}); };
    await assert.rejects(() => runApprise(spy, {}, { action: "notify_url", body: "hi" }), /urls is required/);
    await assert.rejects(() => runApprise(spy, {}, { action: "notify_url", urls: "mailto://a@b.c" }), /body is required/);
    assert.equal(called, false);
  });

  it("an invalid notification type is rejected before any request", async () => {
    let called = false;
    const spy: FetchFn = async () => { called = true; return jsonResponse({}); };
    await assert.rejects(
      () => runApprise(spy, {}, { action: "notify", body: "hi", type: "error" }),
      /type must be one of: info, success, warning, failure/,
    );
    assert.equal(called, false);
  });
});

describe("payload builders", () => {
  it("notify body carries only the supplied fields", () => {
    assert.deepEqual(buildNotifyBody({ action: "notify", body: "Deploy done" }), { body: "Deploy done" });
    assert.deepEqual(
      buildNotifyBody({ action: "notify", body: "Deploy done", tag: "ops", title: "Deploy", type: "success" }),
      { body: "Deploy done", tag: "ops", title: "Deploy", type: "success" },
    );
  });

  it("notify_url body carries urls, body, and supplied optionals only", () => {
    assert.deepEqual(
      buildNotifyUrlBody({ action: "notify_url", urls: "mailto://a@b.c", body: "hi" }),
      { urls: "mailto://a@b.c", body: "hi" },
    );
    assert.deepEqual(
      buildNotifyUrlBody({ action: "notify_url", urls: "mailto://a@b.c", body: "hi", title: "T", type: "warning" }),
      { urls: "mailto://a@b.c", body: "hi", title: "T", type: "warning" },
    );
  });
});

describe("upstream calls", () => {
  it("health GETs the upstream root on the default base, with no Authorization header when no token is set", async () => {
    const c: Captured = {};
    const out = (await runApprise(fakeFetch(c, { status: "ok" }), {}, { action: "health" })) as Record<string, unknown>;
    assert.equal(out.status, "ok");
    assert.equal(c.url, `${BASE}/`);
    assert.equal(c.method, "GET");
    assert.equal(c.headers?.Authorization, undefined);
  });

  it("status GETs /details and sends the env token as a Bearer header only when set", async () => {
    const c: Captured = {};
    await runApprise(fakeFetch(c, { version: "1.0" }), resolveConfig({ APPRISE_TOKEN: "sekret" }), { action: "status" });
    assert.equal(c.url, `${BASE}/details`);
    assert.equal(c.method, "GET");
    assert.equal(c.headers?.Authorization, "Bearer sekret");
  });

  it("notify POSTs /notify with the documented payload", async () => {
    const c: Captured = {};
    await runApprise(
      fakeFetch(c, { error: null }),
      {},
      { action: "notify", body: "Deployment succeeded", tag: "ops", title: "Deploy complete", type: "success" },
    );
    assert.equal(c.url, `${BASE}/notify`);
    assert.equal(c.method, "POST");
    assert.equal(c.headers?.["Content-Type"], "application/json");
    assert.deepEqual(JSON.parse(c.body ?? "{}"), {
      body: "Deployment succeeded",
      tag: "ops",
      title: "Deploy complete",
      type: "success",
    });
  });

  it("notify without a tag posts the body only (all configured services)", async () => {
    const c: Captured = {};
    await runApprise(fakeFetch(c, {}), {}, { action: "notify", body: "hello" });
    assert.deepEqual(JSON.parse(c.body ?? "{}"), { body: "hello" });
  });

  it("notify_url POSTs the stateless /notify form with urls on a custom base", async () => {
    const c: Captured = {};
    await runApprise(
      fakeFetch(c, {}),
      { baseUrl: "http://apprise.test:9000/" },
      { action: "notify_url", urls: "mailto://a@b.c,discord://id/token", body: "hi", type: "failure" },
    );
    assert.equal(c.url, "http://apprise.test:9000/notify");
    assert.equal(c.method, "POST");
    assert.deepEqual(JSON.parse(c.body ?? "{}"), {
      urls: "mailto://a@b.c,discord://id/token",
      body: "hi",
      type: "failure",
    });
  });

  it("a non-JSON success body is returned as raw text", async () => {
    const c: Captured = {};
    const out = await runApprise(fakeFetch(c, "<html>welcome</html>"), {}, { action: "health" });
    assert.equal(out, "<html>welcome</html>");
  });
});

describe("errors", () => {
  it("HTTP 424 surfaces status and the upstream message", async () => {
    const failing: FetchFn = async () => jsonResponse({ message: "no services matched the tag" }, 424, "Failed Dependency");
    await assert.rejects(
      () => runApprise(failing, {}, { action: "notify", body: "hi", tag: "nope" }),
      /HTTP 424.*no services matched the tag/,
    );
  });

  it("network failure is wrapped with context", async () => {
    const failing: FetchFn = async () => { throw new Error("connect ECONNREFUSED"); };
    await assert.rejects(() => runApprise(failing, {}, { action: "health" }), /Apprise API request failed: connect ECONNREFUSED/);
  });
});
