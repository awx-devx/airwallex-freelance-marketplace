import { airwallexContext } from "./context";
import { AirwallexError } from "./errors";
import { loadAirwallexEnv, type AirwallexConfig } from "./env";
import { asObject, readString, type JsonObject } from "./json";
import { redact } from "./redact";

const EXPIRY_SKEW_MS = 60_000;

export type AirwallexLogEntry = {
  method: string;
  path: string;
  onBehalfOf: string | null;
  requestBody: unknown;
  status: number;
  responseBody: unknown;
  durationMs: number;
  relatedOfferId?: string;
  relatedMilestoneId?: string;
  relatedUserId?: string;
};

type Logger = (entry: AirwallexLogEntry) => void;

let logger: Logger = () => {
  // The Next server installs a Mongo logger. Spike scripts attach their own.
};

export function setAirwallexLogger(next: Logger): void {
  logger = next;
}

export type RequestOptions = {
  body?: JsonObject;
  query?: Record<string, string | number | boolean | undefined>;
  onBehalfOf?: string;
  /** Pass null to omit x-api-version even when AIRWALLEX_API_VERSION is set. */
  apiVersion?: string | null;
  relatedOfferId?: string;
  relatedMilestoneId?: string;
  relatedUserId?: string;
};

function relations(options: RequestOptions): Pick<AirwallexLogEntry, "relatedOfferId" | "relatedMilestoneId" | "relatedUserId"> {
  const current = airwallexContext();
  return {
    relatedOfferId: options.relatedOfferId ?? current?.relatedOfferId,
    relatedMilestoneId: options.relatedMilestoneId ?? current?.relatedMilestoneId,
    relatedUserId: options.relatedUserId ?? current?.relatedUserId,
  };
}

export type AirwallexResponse<T> = {
  data: T;
  status: number;
  headers: Headers;
};

type TokenCache = { token: string; expiresAtMs: number };

let tokenCache: TokenCache | undefined;
let loginInFlight: Promise<string> | undefined;

/** Airwallex returns `expires_at` like `2021-06-18T16:30:00+0000`. */
export function parseExpiresAt(value: string): number {
  const normalized = value.replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
  const ms = Date.parse(normalized);
  if (Number.isNaN(ms)) {
    throw new Error(`Airwallex login returned an unreadable expires_at: ${value}`);
  }
  return ms;
}

function withQuery(path: string, query: RequestOptions["query"]): string {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue;
    params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `${path}?${text}` : path;
}

function traceIdFrom(headers: Headers, body: unknown): string | null {
  return (
    headers.get("x-airwallex-trace-id") ??
    headers.get("x-trace-id") ??
    readString(body, "trace_id") ??
    null
  );
}

function errorFromResponse(status: number, body: unknown, headers: Headers): AirwallexError {
  const record = asObject(body);
  const code = readString(record, "code") ?? `http_${status}`;
  const message = readString(record, "message") ?? `Airwallex request failed with HTTP ${status}`;
  return new AirwallexError(status, code, message, traceIdFrom(headers, body), record?.details, body);
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function logCall(entry: AirwallexLogEntry): void {
  logger({
    ...entry,
    requestBody: redact(entry.requestBody),
    responseBody: redact(entry.responseBody),
  });
}

async function login(config: AirwallexConfig): Promise<string> {
  const started = Date.now();
  const path = "/api/v1/authentication/login";
  let response: Response;
  try {
    response = await fetch(`${config.apiBase}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-client-id": config.clientId,
        "x-api-key": config.apiKey,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logCall({
      method: "POST",
      path,
      onBehalfOf: null,
      requestBody: null,
      status: 0,
      responseBody: { message },
      durationMs: Date.now() - started,
    });
    throw new AirwallexError(0, "network_error", message, null, undefined, undefined);
  }

  const body = await readBody(response);
  logCall({
    method: "POST",
    path,
    onBehalfOf: null,
    requestBody: null,
    status: response.status,
    responseBody: body,
    durationMs: Date.now() - started,
  });

  if (!response.ok) throw errorFromResponse(response.status, body, response.headers);

  const token = readString(body, "token");
  const expiresAt = readString(body, "expires_at");
  if (!token || !expiresAt) {
    throw new AirwallexError(
      response.status,
      "invalid_login_response",
      "Login response did not include token and expires_at",
      traceIdFrom(response.headers, body),
      undefined,
      body,
    );
  }

  tokenCache = { token, expiresAtMs: parseExpiresAt(expiresAt) };
  return token;
}

async function getToken(config: AirwallexConfig): Promise<string> {
  // DEMO-ONLY: The access token is cached in module memory, so each server instance logs in on its own.
  // PROD: Share the cache across instances with a single-flight lock, and stay under the login rate limit.
  if (tokenCache && tokenCache.expiresAtMs - EXPIRY_SKEW_MS > Date.now()) return tokenCache.token;
  if (!loginInFlight) {
    loginInFlight = login(config).finally(() => {
      loginInFlight = undefined;
    });
  }
  return loginInFlight;
}

export function clearAirwallexTokenCache(): void {
  tokenCache = undefined;
}

export async function describeLogin(): Promise<{
  expiresAt: string;
  expiresInSeconds: number;
  tokenLength: number;
}> {
  const config = loadAirwallexEnv();
  clearAirwallexTokenCache();
  const token = await getToken(config);
  const expiresAtMs = tokenCache?.expiresAtMs;
  if (!expiresAtMs) {
    throw new Error("Login succeeded but expires_at was not cached");
  }
  return {
    expiresAt: new Date(expiresAtMs).toISOString(),
    expiresInSeconds: Math.round((expiresAtMs - Date.now()) / 1000),
    tokenLength: token.length,
  };
}

export async function requestDetailed<T>(
  method: "GET" | "POST",
  path: string,
  options: RequestOptions = {},
  retried = false,
): Promise<AirwallexResponse<T>> {
  const config = loadAirwallexEnv();
  const token = await getToken(config);
  const url = `${config.apiBase}${withQuery(path, options.query)}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  if (options.onBehalfOf) headers["x-on-behalf-of"] = options.onBehalfOf;

  const version = options.apiVersion === undefined ? config.apiVersion : options.apiVersion;
  if (version) headers["x-api-version"] = version;

  const started = Date.now();
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logCall({
      method,
      path,
      onBehalfOf: options.onBehalfOf ?? null,
      requestBody: options.body ?? null,
      status: 0,
      responseBody: { message },
      durationMs: Date.now() - started,
      ...relations(options),
    });
    throw new AirwallexError(0, "network_error", message, null, undefined, undefined);
  }

  const responseBody = await readBody(response);
  logCall({
    method,
    path,
    onBehalfOf: options.onBehalfOf ?? null,
    requestBody: options.body ?? null,
    status: response.status,
    responseBody,
    durationMs: Date.now() - started,
    ...relations(options),
  });

  if (response.status === 401 && !retried) {
    clearAirwallexTokenCache();
    return requestDetailed<T>(method, path, options, true);
  }

  if (!response.ok) throw errorFromResponse(response.status, responseBody, response.headers);

  return { data: responseBody as T, status: response.status, headers: response.headers };
}

export async function request<T>(method: "GET" | "POST", path: string, options?: RequestOptions): Promise<T> {
  const result = await requestDetailed<T>(method, path, options);
  return result.data;
}

export async function createResource(
  path: string,
  body: JsonObject,
  recover: () => Promise<JsonObject | undefined>,
  options?: Omit<RequestOptions, "body">,
): Promise<JsonObject> {
  try {
    return await request<JsonObject>("POST", path, { ...options, body });
  } catch (error) {
    if (!(error instanceof AirwallexError) || error.code !== "duplicate_request") throw error;
    try {
      const existing = await recover();
      if (existing) return existing;
    } catch {
      // Keep the original duplicate_request error if lookup fails.
    }
    throw error;
  }
}
