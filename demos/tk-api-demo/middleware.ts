import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const username = process.env.BASIC_AUTH_USERNAME;
  const password = process.env.BASIC_AUTH_PASSWORD;

  // Fail open if credentials are not configured.
  if (!username || !password) {
    return NextResponse.next();
  }

  const authHeader = req.headers.get("authorization");

  if (authHeader?.startsWith("Basic ")) {
    const base64 = authHeader.split(" ")[1];
    const [providedUser, providedPass] = atob(base64).split(":");

    if (providedUser === username && providedPass === password) {
      return NextResponse.next();
    }
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="TK Setup Wizard"',
      "Cache-Control": "no-store",
    },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
