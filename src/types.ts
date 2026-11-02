/**
 * notifyfan types.
 *
 * One router tool (`apprise`) fronts an upstream Apprise API server.
 * HTTP access is described by a minimal response surface so tests
 * can inject a fake fetch and never touch the network.
 */

export type AppriseAction = "health" | "status" | "help" | "notify" | "notify_url";

export type NotificationType = "info" | "success" | "warning" | "failure";

export interface AppriseCallOptions {
  action: AppriseAction;
  body?: string;
  tag?: string;
  title?: string;
  type?: string;
  urls?: string;
}

export interface AppriseConfig {
  baseUrl?: string;
  token?: string;
}

/** Minimal HTTP response surface so tests can inject fixtures. */
export interface HttpResponse {
  ok: boolean;
  status: number;
  statusText?: string;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
  json(): Promise<unknown>;
}

export type FetchFn = (
  url: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    redirect?: string;
  },
) => Promise<HttpResponse>;
