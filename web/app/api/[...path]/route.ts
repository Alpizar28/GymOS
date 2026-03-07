import { NextRequest } from "next/server";

const DEFAULT_BACKEND = "http://backend:8000";
const DEFAULT_PROXY_TIMEOUT_MS = 45000;
const DEFAULT_LONG_PROXY_TIMEOUT_MS = 120000;
const BACKEND_DISCOVERY_TTL_MS = 60_000;

let cachedBackendBase: string | null = null;
let cachedBackendAt = 0;

function backendBaseUrl() {
  return (
    process.env.BACKEND_URL ||
    process.env.SERVICE_URL_BACKEND ||
    process.env.COOLIFY_URL_BACKEND ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    DEFAULT_BACKEND
  ).replace(/\/$/, "");
}

function backendCandidates() {
  if (process.env.BACKEND_URL) {
    const primary = process.env.BACKEND_URL.replace(/\/$/, "");
    if (primary === DEFAULT_BACKEND) return [primary];
    return [primary, DEFAULT_BACKEND];
  }

  const values = [
    process.env.SERVICE_URL_BACKEND,
    process.env.COOLIFY_URL_BACKEND,
    process.env.NEXT_PUBLIC_BACKEND_URL,
    DEFAULT_BACKEND,
    "http://localhost:8000",
    "http://127.0.0.1:8000",
  ]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.replace(/\/$/, ""));

  return [...new Set(values)];
}

async function resolveBackendBaseUrl() {
  const now = Date.now();
  if (cachedBackendBase && now - cachedBackendAt < BACKEND_DISCOVERY_TTL_MS) {
    return cachedBackendBase;
  }

  const configuredBase = backendBaseUrl();

  // In containerized environments (Coolify/Docker), BACKEND_URL is the stable
  // internal service target and probing external candidates can cause slow
  // startup windows right after deployment.
  if (process.env.BACKEND_URL) {
    cachedBackendBase = configuredBase;
    cachedBackendAt = now;
    return configuredBase;
  }

  const candidates = backendCandidates();
  for (const candidate of candidates) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    try {
      const health = await fetch(`${candidate}/api/health`, {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
      });
      if (health.ok) {
        cachedBackendBase = candidate;
        cachedBackendAt = now;
        return candidate;
      }
    } catch {
      // Continue to next candidate.
    } finally {
      clearTimeout(timeout);
    }
  }

  cachedBackendBase = configuredBase;
  cachedBackendAt = now;
  return cachedBackendBase;
}

function isLongRunningPath(path: string[]) {
  const joined = path.join("/");
  return (
    joined === "generate-day" ||
    joined === "generate-today" ||
    joined === "today/log" ||
    joined.startsWith("manual-workouts")
  );
}

function proxyTimeoutMs(path: string[]) {
  const longRaw = process.env.PROXY_TIMEOUT_LONG_MS;
  const longParsed = longRaw ? Number(longRaw) : NaN;
  const longTimeout = Number.isFinite(longParsed) && longParsed > 0
    ? longParsed
    : DEFAULT_LONG_PROXY_TIMEOUT_MS;

  const raw = process.env.PROXY_TIMEOUT_MS;
  const parsed = raw ? Number(raw) : NaN;
  const baseTimeout = Number.isFinite(parsed) && parsed > 0
    ? parsed
    : DEFAULT_PROXY_TIMEOUT_MS;

  return isLongRunningPath(path) ? Math.max(baseTimeout, longTimeout) : baseTimeout;
}

async function proxy(request: NextRequest, method: string, path: string[]) {
  const url = new URL(request.url);
  const baseUrl = await resolveBackendBaseUrl();
  const target = `${baseUrl}/api/${path.join("/")}${url.search}`;

  const controller = new AbortController();
  const timeoutMs = proxyTimeoutMs(path);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers = new Headers(request.headers);
    headers.delete("host");
    headers.delete("content-length");

    // Some edge/proxy hops may strip Authorization from browser requests.
    // Accept a mirrored token header from the client and restore it.
    const mirroredToken = headers.get("x-supabase-access-token");
    if (!headers.get("authorization") && mirroredToken) {
      headers.set("authorization", `Bearer ${mirroredToken}`);
    }
    headers.delete("x-supabase-access-token");

    const response = await fetch(target, {
      method,
      headers,
      body: method === "GET" || method === "HEAD" ? undefined : await request.text(),
      cache: "no-store",
      signal: controller.signal,
    });

    const resHeaders = new Headers(response.headers);
    resHeaders.delete("content-encoding");
    resHeaders.delete("transfer-encoding");

    return new Response(await response.arrayBuffer(), {
      status: response.status,
      statusText: response.statusText,
      headers: resHeaders,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[api-proxy] ${method} ${target} failed: ${message}`);

    if (error instanceof Error && error.name === "AbortError") {
      return Response.json(
        { detail: `Backend timeout after ${timeoutMs}ms` },
        { status: 504 }
      );
    }

    return Response.json(
      { detail: "Backend unavailable" },
      { status: 502 }
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxy(request, "GET", path);
}

export async function POST(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxy(request, "POST", path);
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxy(request, "DELETE", path);
}

export async function PUT(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxy(request, "PUT", path);
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxy(request, "PATCH", path);
}

export async function OPTIONS(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path } = await context.params;
  return proxy(request, "OPTIONS", path);
}
