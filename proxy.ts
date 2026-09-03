import { authkitMiddleware } from "@workos-inc/authkit-nextjs";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";

const authProxy = authkitMiddleware({
  middlewareAuth: { enabled: true, unauthenticatedPaths: ["/signin", "/auth/callback"] },
});

export default async function proxy(request: NextRequest, event: NextFetchEvent) {
  const password = process.env.WORKOS_COOKIE_PASSWORD;
  if (!password || password.length < 32) {
    return new NextResponse("Service configuration is incomplete.", { status: 503 });
  }
  try {
    return await authProxy(request, event);
  } catch {
    return new NextResponse("Authentication is temporarily unavailable.", { status: 503 });
  }
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
