import { NextRequest } from "next/server";

const DEFAULT_BACKEND = "http://backend:8000";
const DEFAULT_PROXY_TIMEOUT_MS = 60000;

function backendBaseUrl() {
  return (
    process.env.BACKEND_URL ||
    process.env.SERVICE_URL_BACKEND ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    DEFAULT_BACKEND
  ).replace(/\/$/, "");
}

function proxyTimeoutMs() {
  const raw = process.env.PROXY_TIMEOUT_MS;
  const parsed = raw ? Number(raw) : NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_PROXY_TIMEOUT_MS;
  return parsed;
}

async function proxy(request: NextRequest, method: string, path: string[]) {
  const url = new URL(request.url);
  const target = `${backendBaseUrl()}/api/${path.join("/")}${url.search}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), proxyTimeoutMs());

  try {
    const headers = new Headers(request.headers);
    headers.delete("host");
    headers.delete("content-length");

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
    if (error instanceof Error && error.name === "AbortError") {
      return Response.json(
        { detail: "Backend timeout" },
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
