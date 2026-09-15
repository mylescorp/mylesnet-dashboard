import { redirect } from "next/navigation";

/**
 * Account management is a drawer opened from the topbar avatar, not a page.
 * Direct visits are sent back to the tenant dashboard so the workspace
 * sidebar is never rendered in the account context.
 */
export default function AccountPage() {
  redirect("/dashboard");
}
