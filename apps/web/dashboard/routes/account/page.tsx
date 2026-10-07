"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { UserProfileModal } from "@/shared/components/UserProfileModal";
import { panelForPathname, panelHome } from "@/shared/navigation/product-nav";

export default function AccountPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const panel = panelForPathname(`/${searchParams.get("panel") ?? "dashboard"}`);
  const returnTo = panelHome(panel);

  return (
    <UserProfileModal
      isOpen
      onClose={() => router.push(returnTo)}
    />
  );
}
