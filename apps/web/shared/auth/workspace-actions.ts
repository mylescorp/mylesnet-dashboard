"use server";

import { switchToOrganization } from "@workos-inc/authkit-nextjs";
import { redirect } from "next/navigation";

/**
 * Moves a signed-in platform member to the MylesNet control centre.
 *
 * The organization identifier stays server-side. AuthKit validates the current
 * user's membership before it refreshes the session, so this action cannot be
 * used to select or impersonate a tenant from the browser.
 */
export async function openControlCentre(): Promise<void> {
  const platformOrganizationId = process.env.MYLESNET_PLATFORM_ORG_ID;

  if (!platformOrganizationId) {
    redirect("/");
  }

  await switchToOrganization(platformOrganizationId, {
    returnTo: "/platform",
  });
}
