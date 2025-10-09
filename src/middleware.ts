import { NextResponse } from "next/server";

import { auth } from "@/auth";

const publicRoutes = ["/login", "/forgot-password", "/reset-password"];

export default auth((req) => {
  const { nextUrl } = req;
  const isAuthenticated = Boolean(req.auth);
  const isPublicRoute = publicRoutes.some((route) => nextUrl.pathname.startsWith(route));

  if (!isAuthenticated && !isPublicRoute) {
    const loginUrl = new URL("/login", nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", nextUrl.href);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthenticated && isPublicRoute) {
    return NextResponse.redirect(new URL("/profile", nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon\\.ico|assets|public).*)"],
};
