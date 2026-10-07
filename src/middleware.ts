import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { LANGUAGE_HEADER, parseLocale } from "@/lib/language";

export function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-ananthi-path", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  const locale = parseLocale(request.nextUrl.searchParams.get("lang"));
  if (locale) requestHeaders.set(LANGUAGE_HEADER, locale);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|jpg|jpeg|ico|webp|avif|html)$).*)"],
};
