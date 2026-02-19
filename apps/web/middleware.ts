import { NextRequest, NextResponse } from "next/server";

const adminHosts = new Set(["app.brand-shop.ai", "localhost", "127.0.0.1"]);

export function middleware(request: NextRequest) {
  const hostHeader = request.headers.get("host") ?? "";
  const host = hostHeader.split(":")[0];

  if (!host || adminHosts.has(host)) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  if (!url.pathname.startsWith("/storefront")) {
    url.pathname = "/storefront";
    url.searchParams.set("host", host);
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next).*)"]
};
