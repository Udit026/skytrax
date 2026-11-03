import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";
import { CLIENT_INTERNAL_PREFIX, clientSlug } from "@/lib/client-slug";

// Page-level gate. API routes are excluded here on purpose (large uploads must not be
// buffered by middleware) — every API route checks the session itself via requireAdminApi().
export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // Public, read-only client view: /<CLIENT_VIEW_SLUG>[/…] is rewritten to the internal /client-view/… routes.
  // No session is read or required. The internal path itself is never reachable directly.
  if (path === CLIENT_INTERNAL_PREFIX || path.startsWith(CLIENT_INTERNAL_PREFIX + "/")) {
    return new NextResponse("Not found", { status: 404 });
  }
  const slugPath = "/" + clientSlug();
  if (path === slugPath || path.startsWith(slugPath + "/")) {
    const url = req.nextUrl.clone();
    url.pathname = CLIENT_INTERNAL_PREFIX + path.slice(slugPath.length);
    const res = NextResponse.rewrite(url);
    res.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    res.headers.set("Cache-Control", "private, no-store");
    return res;
  }

  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  const isLogin = path === "/login";
  if (!session && !isLogin) {
    const url = new URL("/login", req.url);
    if (path !== "/") url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }
  if (session && isLogin) return NextResponse.redirect(new URL("/", req.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|robots.txt|.*\\.(?:png|svg|jpg|ico)$).*)"],
};
