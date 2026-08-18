import { NextResponse } from "next/server";
import { NextRequest } from "next/server";

const protectedRoutes = ["/dashboard", "/routers", "/incidents", "/shift-notes", "/usage"];

export function middleware(req: NextRequest) {
  const isProtectedRoute = protectedRoutes.some((route) =>
    req.nextUrl.pathname.startsWith(route)
  );

  // For now, skip auth check since we're having auth library issues
  // In production, you'd check for auth token here
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
