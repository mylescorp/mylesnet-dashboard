import {
  Activity,
  ArrowRight,
  BarChart3,
  ChartColumn,
  ChevronRight,
  CircleDollarSign,
  CreditCard,
  FileDown,
  Gift,
  LayoutDashboard,
  LifeBuoy,
  MessageSquare,
  ReceiptText,
  Router,
  Ticket,
  TriangleAlert,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
  Wifi,
} from "lucide-react";

const MONTHS = ["Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep"];
const CHART_BAR_COUNT = 12;

const SIDE_SECTIONS: {
  label: string;
  items: { label: string; icon: React.ElementType; active?: boolean; expandable?: boolean }[];
}[] = [
  {
    label: "Customers",
    items: [
      { label: "Subscribers", icon: Users },
      { label: "Leads", icon: UserPlus },
      { label: "Tickets", icon: LifeBuoy, expandable: true },
    ],
  },
  {
    label: "Network",
    items: [
      { label: "Live sessions", icon: Activity },
      { label: "Packages", icon: Gift },
      { label: "Routers", icon: Router, expandable: true },
      { label: "Hotspot", icon: Wifi },
    ],
  },
  {
    label: "Finance",
    items: [
      { label: "Payments", icon: CreditCard, expandable: true },
      { label: "Vouchers", icon: Ticket, expandable: true },
    ],
  },
  {
    label: "Outreach",
    items: [{ label: "Communications", icon: MessageSquare, expandable: true }],
  },
  {
    label: "Insights",
    items: [{ label: "Analytics", icon: ChartColumn, active: true }],
  },
];

const KPIS: {
  icon: React.ElementType;
  label: string;
  value: string;
  trend: string;
  up: boolean;
}[] = [
  { icon: Wallet, label: "Collected this cycle", value: "KSh 486k", trend: "+18% on last", up: true },
  { icon: ReceiptText, label: "Receivables", value: "KSh 63k", trend: "188 invoices", up: false },
  { icon: UserPlus, label: "Net subscriber growth", value: "+34", trend: "this week", up: true },
  { icon: CircleDollarSign, label: "Revenue per subscriber", value: "KSh 2,314", trend: "per month", up: false },
];

const CHANNELS: { name: string; pct: number }[] = [
  { name: "M-Pesa", pct: 58 },
  { name: "Airtel Money", pct: 24 },
  { name: "Card", pct: 11 },
  { name: "Bank", pct: 7 },
];

const ACTIVITY: { icon: React.ElementType; title: string; meta: string }[] = [
  { icon: FileDown, title: "Collections report exported", meta: "Example activity" },
  { icon: BarChart3, title: "Package performance compared", meta: "Example activity" },
  { icon: Router, title: "Router usage report opened", meta: "Example activity" },
];

export default function ProductPreview() {
  return (
    <div className="landing-preview-wrap">
      <div className="landing-preview-glow" aria-hidden="true" />
      <figure className="landing-preview" aria-labelledby="product-preview-caption">
        <div className="landing-preview-bar">
          <span className="landing-preview-dot" />
          <span className="landing-preview-dot" />
          <span className="landing-preview-dot" />
          <span className="landing-preview-url">app.my… / analytics</span>
          <span className="landing-preview-sample-label">Illustrative sample data</span>
        </div>

        <div className="landing-preview-body">
          <aside className="landing-preview-side" aria-label="MylesNet dashboard navigation">
            <div className="landing-preview-side-tenant">
              <span className="landing-preview-side-tenant-mark" aria-hidden="true">
                M
              </span>
              <strong>Demo ISP</strong>
            </div>

            <nav className="landing-preview-side-items" aria-label="Demo workspace sections">
              <span className="landing-preview-side-item">
                <LayoutDashboard size={15} aria-hidden="true" />
                Overview
              </span>
              {SIDE_SECTIONS.map((section) => (
                <div key={section.label}>
                  <span className="landing-preview-side-section">{section.label}</span>
                  {section.items.map(({ label, icon: ItemIcon, active, expandable }) => (
                    <span
                      className={`landing-preview-side-item${active ? " landing-preview-side-item-active" : ""}`}
                      key={label}
                    >
                      <ItemIcon size={15} aria-hidden="true" />
                      {label}
                      {expandable ? (
                        <ChevronRight size={13} className="landing-preview-side-item-chevron" aria-hidden="true" />
                      ) : null}
                    </span>
                  ))}
                </div>
              ))}
            </nav>

            <div className="landing-preview-side-foot">
              <LifeBuoy size={14} aria-hidden="true" />
              Help center
            </div>
          </aside>

          <div className="landing-preview-main">
            <div className="landing-preview-analytics-head">
              <div>
                <p className="landing-preview-eyebrow">Insights</p>
                <h4>Analytics</h4>
                <p className="landing-preview-period">Sample reporting period</p>
              </div>
              <div className="landing-preview-head-actions">
                <span className="landing-preview-search">Search subscribers, routers, payments…</span>
                <span className="landing-preview-avatar" aria-hidden="true">
                  DI
                </span>
              </div>
            </div>

            <div className="landing-preview-kpis">
              {KPIS.map(({ icon: KpiIcon, label, value, trend, up }) => (
                <div className="landing-preview-kpi" key={label}>
                  <span>
                    <KpiIcon size={13} aria-hidden="true" />
                    {label}
                  </span>
                  <strong>{value}</strong>
                  <small className={up ? "landing-preview-kpi-trend-up" : ""}>
                    {up ? <TrendingUp size={12} aria-hidden="true" /> : null}
                    {trend}
                  </small>
                </div>
              ))}
            </div>

            <div className="landing-preview-mid">
              <div className="landing-preview-panel">
                <div className="landing-preview-panel-head">
                  <div>
                    <h5>Revenue collected</h5>
                    <p>Against invoiced · KSh thousands</p>
                  </div>
                  <span className="landing-status-chip">12 months</span>
                </div>
                <div className="landing-preview-chart" aria-hidden="true">
                  {Array.from({ length: CHART_BAR_COUNT }, (_, index) => (
                    <span
                      className={`landing-preview-chart-bar landing-preview-chart-bar-${index}`}
                      key={index}
                    />
                  ))}
                </div>
                <div className="landing-preview-chart-labels" aria-hidden="true">
                  {MONTHS.map((month) => (
                    <span key={month}>{month}</span>
                  ))}
                </div>
              </div>

              <div className="landing-preview-panel">
                <div className="landing-preview-panel-head">
                  <div>
                    <h5>Payment channels</h5>
                    <p>Share of this cycle</p>
                  </div>
                </div>
                <div className="landing-preview-channel-list">
                  {CHANNELS.map((channel) => (
                    <div className="landing-preview-channel" key={channel.name}>
                      <div className="landing-preview-channel-head">
                        <span>{channel.name}</span>
                        <strong>{channel.pct}%</strong>
                      </div>
                      <div className="landing-preview-channel-track">
                        <span
                          className="landing-preview-channel-fill"
                          style={{ width: `${channel.pct}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="landing-preview-low">
              <div className="landing-preview-panel">
                <div className="landing-preview-panel-head">
                  <div>
                    <h5>Recent activity</h5>
                    <p>Billing and network events</p>
                  </div>
                </div>
                <div className="landing-preview-rows">
                  {ACTIVITY.map(({ icon: RowIcon, title, meta }) => (
                    <div className="landing-preview-row" key={title}>
                      <span className="landing-preview-row-icon">
                        <RowIcon size={16} aria-hidden="true" />
                      </span>
                      <p>{title}</p>
                      <small>{meta}</small>
                      <span className="landing-status-chip">Example</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="landing-preview-panel">
                <div className="landing-preview-panel-head">
                  <div>
                    <h5>What&apos;s next?</h5>
                    <p>Items that need a decision</p>
                  </div>
                </div>
                <div className="landing-preview-alert">
                  <span className="landing-preview-alert-icon">
                    <TriangleAlert size={16} aria-hidden="true" />
                  </span>
                  <div className="landing-preview-alert-body">
                    <strong>Receivables are up 6% on last cycle</strong>
                    <p>Open the 188 invoices behind the figure.</p>
                  </div>
                  <span className="landing-preview-alert-action">
                    Review <ArrowRight size={14} aria-hidden="true" />
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </figure>
      <p id="product-preview-caption" className="landing-preview-caption">
        Every figure and activity shown is illustrative sample content, not live customer or network data.
      </p>
    </div>
  );
}
