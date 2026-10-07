import { redirect } from "next/navigation";

/** Legacy URL; access management now has one canonical platform route. */
export default function LegacyAccessRedirect() {
  redirect("/platform/access");
}
