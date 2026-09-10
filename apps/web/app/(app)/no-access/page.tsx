import Link from "next/link";

export default function NoAccessPage() {
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
          <Link href="/dashboard" className="primary-button">
            Return to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}