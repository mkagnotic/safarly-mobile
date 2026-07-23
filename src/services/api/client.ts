import { supabase } from "@/integrations/supabase/client";
import { SUPABASE_ANON_KEY, SUPABASE_FUNCTIONS_URL } from "@/integrations/supabase/env";

/**
 * Edge-function HTTP client.
 *
 * Mirrors the web client's surface so service modules port over verbatim, with
 * three deliberate improvements:
 *
 *   1. Auth headers are built in one place and reused by JSON + multipart paths.
 *   2. A single 401 -> refreshSession -> retry path covers both paths
 *      (web only retries the JSON path).
 *   3. Every method accepts an optional `AbortSignal` so screens can cancel
 *      in-flight requests on unmount instead of writing into unmounted state.
 */

export type QueryParamValue = string | number | boolean | null | undefined;
/**
 * Accept any object as query params — typed param interfaces (e.g.
 * `ParcelListParams`) don't have an index signature, so a strict
 * `Record<string, ...>` would force ugly casts at every call site. The
 * runtime serializer drops anything that isn't a primitive.
 */
export type QueryParams = object;

export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  meta?: { page: number; per_page: number; total: number };
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown[];
  };
}

export class ApiClientError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown[];

  constructor(message: string, code: string, status: number, details?: unknown[]) {
    super(message);
    this.name = "ApiClientError";
    this.code = code;
    this.status = status;
    this.details = details;
    // Restore prototype chain for instanceof checks across the RN bundler.
    Object.setPrototypeOf(this, ApiClientError.prototype);
  }
}

/**
 * Build query string from a typed param object. Drops `null`/`undefined`/`""`
 * and ignores anything that isn't a primitive (string/number/boolean) or an
 * array of primitives — keeps the wire format predictable even if a caller
 * accidentally passes a nested object.
 */
function buildQuery(params?: QueryParams): string {
  if (!params) return "";
  const search = new URLSearchParams();
  const isPrimitive = (v: unknown): v is string | number | boolean =>
    typeof v === "string" || typeof v === "number" || typeof v === "boolean";

  for (const [key, value] of Object.entries(params as Record<string, unknown>)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        if (!isPrimitive(item) || item === "") continue;
        search.append(key, String(item));
      }
    } else if (isPrimitive(value)) {
      search.set(key, String(value));
    }
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

async function authHeaders(extra?: Record<string, string>): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const headers: Record<string, string> = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token ?? SUPABASE_ANON_KEY}`,
    ...extra,
  };
  return headers;
}

async function parseError(response: Response): Promise<never> {
  let payload: ApiError | null = null;
  try {
    payload = (await response.json()) as ApiError;
  } catch {
    // Non-JSON body (e.g. 502 from a gateway) — fall back to a generic message.
  }
  throw new ApiClientError(
    payload?.error?.message ?? `Request failed with status ${response.status}`,
    payload?.error?.code ?? "UNKNOWN_ERROR",
    response.status,
    payload?.error?.details,
  );
}

interface RequestOptions {
  signal?: AbortSignal;
  /** Sent as the `Idempotency-Key` header — reuse the same key across retries. */
  idempotencyKey?: string;
}

async function send(url: string, init: RequestInit, signal?: AbortSignal): Promise<Response> {
  let response = await fetch(url, { ...init, signal });

  // Stale token race: supabase-js may serve a JWT that just expired before its
  // own refresh fires. Force a refresh and retry exactly once.
  if (response.status === 401) {
    const { data } = await supabase.auth.refreshSession();
    if (data?.session?.access_token) {
      const retryHeaders = await authHeaders(
        // Preserve any non-auth headers the caller set (Content-Type, etc.).
        Object.fromEntries(
          Object.entries((init.headers as Record<string, string>) ?? {}).filter(
            ([k]) => k.toLowerCase() !== "authorization" && k.toLowerCase() !== "apikey",
          ),
        ),
      );
      response = await fetch(url, { ...init, headers: retryHeaders, signal });
    }
  }

  return response;
}

async function request<T>(
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH",
  path: string,
  body?: unknown,
  params?: QueryParams,
  options?: RequestOptions,
): Promise<ApiResponse<T>> {
  const url = `${SUPABASE_FUNCTIONS_URL}${path}${buildQuery(params)}`;
  const headers = await authHeaders({
    "Content-Type": "application/json",
    ...(options?.idempotencyKey ? { "Idempotency-Key": options.idempotencyKey } : {}),
  });
  const init: RequestInit = { method, headers };
  if (body !== undefined && method !== "GET") {
    init.body = JSON.stringify(body);
  }

  const response = await send(url, init, options?.signal);
  if (!response.ok) await parseError(response);
  return response.json() as Promise<ApiResponse<T>>;
}

async function requestMultipart<T>(
  method: "POST" | "PUT",
  path: string,
  formData: FormData,
  options?: RequestOptions,
): Promise<ApiResponse<T>> {
  const url = `${SUPABASE_FUNCTIONS_URL}${path}`;
  // No Content-Type: fetch sets the multipart boundary automatically.
  const headers = await authHeaders();
  const init: RequestInit = { method, headers, body: formData as unknown as BodyInit };

  const response = await send(url, init, options?.signal);
  if (!response.ok) await parseError(response);
  return response.json() as Promise<ApiResponse<T>>;
}

/** A React Native file blob: a local `uri` plus its display name and MIME type. */
export interface RNFileBlob {
  uri: string;
  name: string;
  type: string;
}

/** ASCII (Latin-1) string → bytes, for the multipart envelope we fully control. */
function latin1Bytes(str: string): Uint8Array {
  const out = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i += 1) out[i] = str.charCodeAt(i) & 0xff;
  return out;
}

/**
 * Reliable multipart single-file upload for React Native.
 *
 * WHY THIS EXISTS: appending a `{ uri, name, type }` blob to `FormData` and
 * POSTing it — the shape web and several of our service modules use — does NOT
 * stream the file bytes to a Deno edge function under Expo/Hermes. The server's
 * `req.formData()` receives no usable `file` part and rejects with 422. (A DOM
 * `File` in the browser carries real bytes, so web is fine.)
 *
 * So we read the bytes ourselves — `fetch(uri).arrayBuffer()`, the same tactic
 * the KYC uploader already relies on for local picker URIs — and hand-build the
 * multipart envelope as one contiguous byte array. RN fetch transmits a raw
 * byte body verbatim, so the edge function gets a well-formed `file` field.
 *
 * Field name is always `file` (what every handler expects). Extra text fields
 * can be supplied via `fields`.
 */
async function uploadRNFile<T>(
  path: string,
  file: RNFileBlob,
  fields?: Record<string, string>,
  options?: RequestOptions,
): Promise<ApiResponse<T>> {
  const fileBytes = new Uint8Array(await (await fetch(file.uri)).arrayBuffer());

  const boundary = `----safarly${newIdempotencyKey().replace(/-/g, "")}`;
  const CRLF = "\r\n";
  // Filenames are echoed back into the header we control; strip anything that
  // could break the multipart framing or isn't plain ASCII.
  const safeName = (file.name || "upload")
    .replace(/[\r\n"\\]/g, "_")
    .replace(/[^\x20-\x7E]/g, "_");

  let head = "";
  for (const [key, value] of Object.entries(fields ?? {})) {
    head += `--${boundary}${CRLF}Content-Disposition: form-data; name="${key}"${CRLF}${CRLF}${value}${CRLF}`;
  }
  head +=
    `--${boundary}${CRLF}` +
    `Content-Disposition: form-data; name="file"; filename="${safeName}"${CRLF}` +
    `Content-Type: ${file.type || "application/octet-stream"}${CRLF}${CRLF}`;
  const tail = `${CRLF}--${boundary}--${CRLF}`;

  const headBytes = latin1Bytes(head);
  const tailBytes = latin1Bytes(tail);
  const body = new Uint8Array(headBytes.length + fileBytes.length + tailBytes.length);
  body.set(headBytes, 0);
  body.set(fileBytes, headBytes.length);
  body.set(tailBytes, headBytes.length + fileBytes.length);

  const url = `${SUPABASE_FUNCTIONS_URL}${path}`;
  const headers = await authHeaders({
    "Content-Type": `multipart/form-data; boundary=${boundary}`,
    ...(options?.idempotencyKey ? { "Idempotency-Key": options.idempotencyKey } : {}),
  });
  const init: RequestInit = { method: "POST", headers, body: body as unknown as BodyInit };

  const response = await send(url, init, options?.signal);
  if (!response.ok) await parseError(response);
  return response.json() as Promise<ApiResponse<T>>;
}

export const api = {
  get: <T>(path: string, params?: QueryParams, options?: RequestOptions) =>
    request<T>("GET", path, undefined, params, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("POST", path, body, undefined, options),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("PUT", path, body, undefined, options),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("PATCH", path, body, undefined, options),
  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>("DELETE", path, undefined, undefined, options),
  upload: <T>(path: string, formData: FormData, options?: RequestOptions) =>
    requestMultipart<T>("POST", path, formData, options),
  /**
   * RN-safe single-file multipart upload — reads the file bytes and builds the
   * body by hand. Use this (not `upload`) whenever the file comes from a picker
   * `uri`, or the edge function's `req.formData()` will 422 on an empty part.
   */
  uploadRNFile: <T>(
    path: string,
    file: RNFileBlob,
    fields?: Record<string, string>,
    options?: RequestOptions,
  ) => uploadRNFile<T>(path, file, fields, options),
};

/** v4-style id for `Idempotency-Key` — unique per action, not cryptographic. */
export function newIdempotencyKey(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) return error.message;
  if (error instanceof Error) return error.message;
  return "An unexpected error occurred";
}

/** True when an error came from `AbortController.abort()` — safe to swallow. */
export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException
    ? error.name === "AbortError"
    : error instanceof Error && error.name === "AbortError";
}
