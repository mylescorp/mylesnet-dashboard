import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <div className="platform-standalone">
      <div className="platform-card">
        <p className="eyebrow">Access restricted</p>
        <h1 className="page-title">This area is for platform administrators only.</h1>
        <p className="page-subtitle">
          Your account does not have permission to view the Master Admin panel.
          If you believe this is a mistake, contact your administrator.
        </p>
        <p className="page-subtitle">
          You can return to the network operations workspace instead.
        </p>
        <div className="platform-actions">
          <Link href="/dashboard" className="primary-button">
            Go to network operations
          </Link>
        </div>
      </div>
    </div>
  );
}
