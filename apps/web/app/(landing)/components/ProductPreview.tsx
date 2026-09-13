import { LayoutDashboard, Users, Gift, CreditCard, Activity, LifeBuoy, Wifi, Bell } from "lucide-react";

const SIDE_ITEMS: { icon: React.ElementType; label: string; active?: boolean }[] = [
  { icon: LayoutDashboard, label: "Dashboard", active: true },
  { icon: Users, label: "Customers" },
  { icon: Gift, label: "Packages" },
  { icon: CreditCard, label: "Payments" },
  { icon: Activity, label: "Network" },
  { icon: LifeBuoy, label: "Support" },
];

const KPIS: { label: string; trend: string }[] = [
  { label: "Revenue today", trend: "posted" },
  { label: "Customers online", trend: "sessions" },
  { label: "Expiring soon", trend: "renewals due" },
];

const CHART_BARS = [42, 58, 40, 66, 52, 78, 62, 88, 70, 56, 74, 64];

const ROWS: { icon: React.ElementType; title: string; meta: string; chip: string }[] = [
  { icon: Wifi, title: "Network health", meta: "Routers monitored", chip: "Nominal" },
  { icon: CreditCard, title: "Payments", meta: "Verified and posted", chip: "Ledger" },
  { icon: LifeBuoy, title: "Support", meta: "Tickets in queue", chip: "Responding" },
];

export default function ProductPreview() {
  return (
    <div className="landing-preview-wrap">
      <div className="landing-preview-glow" aria-hidden="true" />
      <div className="landing-preview" role="img" aria-label="Sample interface of the MylesNet operations console">
        <div className="landing-preview-bar">
          <span className="landing-preview-dot" />
          <span className="landing-preview-dot" />
          <span className="landing-preview-dot" />
          <span className="landing-preview-url">app.my… / operations</span>
        </div>
        <div className="landing-preview-body">
          <div className="landing-preview-side">
            <div className="landing-preview-side-brand">
              <Bell size={15} aria-hidden="true" />
              MylesNet
            </div>
            {SIDE_ITEMS.map(({ icon: ItemIcon, label, active }) => (
              <div
                key={label}
                className={`landing-preview-side-item${active ? " landing-preview-side-item-active" : ""}`}
              >
                <ItemIcon size={15} aria-hidden="true" />
                {label}
              </div>
            ))}
          </div>
          <div className="landing-preview-main">
            <div className="landing-preview-head">
              <div>
                <h4>Operations overview</h4>
                <p>Everything running your network, in one place</p>
              </div>
              <span className="landing-status-chip">Live</span>
            </div>
            <div className="landing-preview-kpis">
              {KPIS.map((kpi) => (
                <div className="landing-preview-kpi" key={kpi.label}>
                  <span>
                    <Activity size={13} aria-hidden="true" />
                    {kpi.label}
                  </span>
                  <strong>—</strong>
                  <small>Updated {kpi.trend}</small>
                </div>
              ))}
            </div>
            <div className="landing-preview-chart" aria-hidden="true">
              {CHART_BARS.map((height, index) => (
                <span
                  className="landing-preview-bar"
                  key={index}
                  style={{ height: `${height}%`, animationDelay: `${index * 70}ms` }}
                />
              ))}
            </div>
            <div className="landing-preview-rows">
              {ROWS.map(({ icon: RowIcon, title, meta, chip }) => (
                <div className="landing-preview-row" key={title}>
                  <span className="landing-preview-row-icon">
                    <RowIcon size={16} aria-hidden="true" />
                  </span>
                  <p>{title}</p>
                  <small>{meta}</small>
                  <span className="landing-status-chip">{chip}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}