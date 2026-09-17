"use client";

import { ReactNode } from "react";
import { ConvexProvider, ConvexReactClient } from "convex/react";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

if (!convexUrl) {
  throw new Error("The application configuration is incomplete.");
}

const convex = new ConvexReactClient(convexUrl);

/**
 * Anonymous Convex provider for the public wizard. Unlike the panel provider
 * this needs no AuthKit session — the wizard authorizes itself per-call via
 * its session token.
 */
export function PublicConvexProvider({ children }: { children: ReactNode }) {
  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}