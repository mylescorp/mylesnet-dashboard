import { authkitMiddleware } from "@workos-inc/authkit-nextjs";
import { NextResponse, type NextRequest, type NextFetchEvent } from "next/server";

const authMiddleware = authkitMiddleware({
  middlewareAuth: {
    enabled: true,
    unauthenticatedPaths: ["/signin"],
  },
});

export default async function middleware(request: NextRequest, event: NextFetchEvent) {
  try {
    const password = process.env.WORKOS_COOKIE_PASSWORD;
    if (!password || password.length < 32) {
      return NextResponse.next();
    }
    return await authMiddleware(request, event);
  } catch (error) {
    console.error("WorkOS middleware error:", error);
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};


