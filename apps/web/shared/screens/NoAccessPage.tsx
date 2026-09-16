import Link from "next/link";
import { hasPanelAccess } from "@/shared/auth/panelAccess";
import { getSession } from "@/shared/auth/session";

export default async function NoAccessPage() {
  const session = await getSession();
  const returnToPlatform = Boolean(session && hasPanelAccess(session.roleSlugs, "platform"));

  return (
    <div className="platform-standalone">
      <div className="platform-card">
        <p className="eyebrow">Access restricted</p>
        <h1 className="page-title">You don&apos;t have access to this area.</h1>
        <p className="page-subtitle">
          Your account does not have permission to view this page. If you believe
          this is a mistake, contact your administrator.
        </p>
        <div className="platform-actions">
          <Link href={returnToPlatform ? "/platform" : "/"} className="primary-button">
            {returnToPlatform ? "Return to platform" : "Return to home"}
          </Link>
        </div>
      </div>
    </div>
  );
}
