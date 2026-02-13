export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function buildBackendUrl(req: Request, pathParts: string[]) {
  // Keep this consistent with `next.config.mjs` for local + Vercel.
  const rawBase = process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
  const base = rawBase.replace(/\/api\/?$/, "").replace(/\/$/, "");
  const path = pathParts.map(encodeURIComponent).join("/");
  const url = new URL(`${base}/documents/${path}`);
  const requestUrl = new URL(req.url);
  url.search = requestUrl.search;
  return url;
}

async function proxy(req: Request, ctx: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await ctx.params;
  const url = buildBackendUrl(req, path);

  // Forward headers, including cookies, to preserve the session.
  const headers = new Headers(req.headers);
  headers.delete("host");

  const init: RequestInit & { duplex?: "half" } = {
    method: req.method,
    headers,
    // Streaming body passthrough for uploads.
    body: req.body,
    duplex: "half"
  };

  const upstream = await fetch(url, init);

  // Copy response headers. Keep `set-cookie` if present (session rotation).
  const outHeaders = new Headers(upstream.headers);

  // Vercel/Next may apply caching unless explicitly disabled for binary endpoints.
  outHeaders.set("Cache-Control", "no-store");

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: outHeaders
  });
}

type RouteContext = { params: Promise<{ path?: string[] }> };

export async function GET(req: Request, ctx: RouteContext) {
  return proxy(req, ctx);
}

export async function POST(req: Request, ctx: RouteContext) {
  return proxy(req, ctx);
}

export async function PUT(req: Request, ctx: RouteContext) {
  return proxy(req, ctx);
}

export async function PATCH(req: Request, ctx: RouteContext) {
  return proxy(req, ctx);
}

export async function DELETE(req: Request, ctx: RouteContext) {
  return proxy(req, ctx);
}

export async function HEAD(req: Request, ctx: RouteContext) {
  return proxy(req, ctx);
}
