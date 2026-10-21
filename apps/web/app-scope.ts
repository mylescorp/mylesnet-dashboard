import type { AppScope } from "@/lib/app-scope-contract";
import { PUBLIC_PATHS } from "@/lib/public-routes";

/** `@app-scope` binding for the website deployment. */
export const appScope: AppScope = {
  publicPaths: PUBLIC_PATHS,
  postLoginPath: "/dashboard",
};
