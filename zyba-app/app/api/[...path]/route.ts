import { NextRequest } from "next/server";

const API_BASE = "https://zyba-costumer-app-915232350.development.catalystserverless.com/server/Zoho_api";

async function handler(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await ctx.params;
  const targetUrl = new URL(`${API_BASE}/${path.join("/")}${req.nextUrl.search}`);

  const headers = new Headers(req.headers);
  headers.delete("host");
  // Catalyst gateway may interpret Authorization as OAuth token and reject
  // our app session token before the function code runs.
  headers.delete("authorization");
  headers.delete("Authorization");

  const body =
    req.method === "GET" || req.method === "HEAD"
      ? undefined
      : await req.text();

  const response = await fetch(targetUrl.toString(), {
    method: req.method,
    headers,
    body,
    redirect: "manual",
  });

  const outHeaders = new Headers(response.headers);
  outHeaders.delete("content-encoding");
  outHeaders.delete("transfer-encoding");
  outHeaders.delete("connection");

  return new Response(response.body, {
    status: response.status,
    headers: outHeaders,
  });
}

export { handler as GET, handler as POST, handler as PUT, handler as PATCH, handler as DELETE, handler as OPTIONS, handler as HEAD };
