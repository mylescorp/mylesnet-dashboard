import { createHash } from "node:crypto";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

const noStore = { "Cache-Control": "no-store", "Content-Type": "application/json" };
const unauthorized = () => Response.json(
  { success: false, message: "Authentication is required." },
  { status: 401, headers: { ...noStore, "WWW-Authenticate": "Bearer" } },
);

export async function GET(request: Request) {
  const authorization = request.headers.get("authorization");
  const match = authorization?.match(/^Bearer (mn_platform_[A-Za-z0-9_-]{40,})$/);
  if (!match) return unauthorized();
  const tokenHash = createHash("sha256").update(match[1], "utf8").digest("hex");
  const url = new URL(request.url);
  const rawLimit = Number(url.searchParams.get("limit") ?? 20);
  const numItems = Number.isFinite(rawLimit) ? Math.min(50, Math.max(1, Math.floor(rawLimit))) : 20;
  const cursor = url.searchParams.get("cursor") || null;
  try {
    const result = await fetchQuery(api.platformApiKeys.listOrganizationsByApiKey, { tokenHash, paginationOpts: { numItems, cursor } });
    if (!result) return unauthorized();
    const { page, continueCursor, isDone } = result;
    return Response.json({ data: page, pagination: { nextCursor: isDone ? null : continueCursor, isDone } }, { headers: noStore });
  } catch {
    return Response.json(
      { success: false, message: "The service is temporarily unavailable." },
      { status: 503, headers: noStore },
    );
  }
}
