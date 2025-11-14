import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { logger } from "@/lib/logging/logger";
import { publicRoutes } from "./lib/constants";

const proxyLogger = logger.child({ module: "proxy" });

export default auth((req) => {
  const { nextUrl } = req;
  const isAuthenticated = Boolean(req.auth);
  const isPublicRoute = publicRoutes.some((route) => nextUrl.pathname.startsWith(route));
  const baseLog = proxyLogger.child({
    path: nextUrl.pathname,
    method: req.method,
    isAuthenticated,
    isPublicRoute,
    userId: req.auth?.user?.id,
  });

  if (req.auth && !req.auth.user) {
    baseLog.warn(
      { event: "anomaly_missing_user" },
      "Authenticated request is missing user payload",
    );
  }

  baseLog.debug(
    { event: "proxy_evaluation" },
    "Evaluating access control decision",
  );

  if (!isAuthenticated && !isPublicRoute) {
    const loginUrl = new URL("/login", nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", nextUrl.href);
    baseLog.info(
      { event: "redirect_to_login", callbackUrl: nextUrl.href },
      "Redirecting unauthenticated request to login",
    );
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthenticated && isPublicRoute) {
    baseLog.info(
      { event: "redirect_to_dashboard" },
      "Authenticated user attempted to access a public route; redirecting to dashboard",
    );
    return NextResponse.redirect(new URL("/dashboard", nextUrl.origin));
  }

  baseLog.debug(
    { event: "allow_request" },
    "Request allowed to proceed",
  );
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon\\.ico|assets|public).*)"],
};
