import { NextResponse, type NextRequest } from "next/server";
import { loginRedirect, mocksEnabledFromEnv } from "@/lib/authGate";
import { SESSION_COOKIE } from "@/lib/sessionToken";

// DEMO-ONLY: Mock mode keeps the session in localStorage, so this cookie check is skipped.
// PROD: Always redirect to /login when the session cookie is missing.
export function proxy(request: NextRequest) {
  const target = loginRedirect({
    mocksEnabled: mocksEnabledFromEnv({
      NODE_ENV: process.env.NODE_ENV,
      NEXT_PUBLIC_API_MOCKS: process.env.NEXT_PUBLIC_API_MOCKS,
      NEXT_PUBLIC_AIRWALLEX_ENV: process.env.NEXT_PUBLIC_AIRWALLEX_ENV,
      NEXT_PUBLIC_ENABLE_UI_KIT: process.env.NEXT_PUBLIC_ENABLE_UI_KIT,
    }),
    pathname: request.nextUrl.pathname,
    hasSessionCookie: Boolean(request.cookies.get(SESSION_COOKIE)?.value),
  });
  if (!target) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = target;
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
