import { PageHeader } from "@mylesnet/ui";
import { BarChart3, TrendingUp, Users, DollarSign } from "lucide-react";
import MetricCard from "@/shared/components/MetricCard";

export default function AnalyticsPage() {
  return (
    <div className="workspace-page">
      <PageHeader
        eyebrow="Insights"
        title="Analytics"
        description="View business performance and metrics"
      />

      <div className="metric-grid">
        <MetricCard
          icon={DollarSign}
          label="Revenue MTD"
          value="KES 0"
          detail="Month to date"
          tone="primary"
        />
        <MetricCard
          icon={Users}
          label="Active subscribers"
          value="0"
          detail="Current active"
          tone="success"
        />
        <MetricCard
          icon={TrendingUp}
          label="Growth rate"
          value="0%"
          detail="Month over month"
          tone="accent"
        />
        <MetricCard
          icon={BarChart3}
          label="ARPU"
          value="KES 0"
          detail="Average revenue per user"
          tone="neutral"
        />
      </div>

      <div className="section-block">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Performance</p>
            <h2>Revenue trend</h2>
          </div>
        </div>
        <div className="pf-panel">
          <div className="empty-state">
            <BarChart3 size={48} aria-hidden="true" />
            <p>No revenue data available</p>
            <p className="empty-detail">
              Revenue analytics will appear once payments are recorded
            </p>
          </div>
        </div>
      </div>

      <div className="section-block">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Growth</p>
            <h2>Subscriber growth</h2>
          </div>
        </div>
        <div className="pf-panel">
          <div className="empty-state">
            <Users size={48} aria-hidden="true" />
            <p>No subscriber data available</p>
            <p className="empty-detail">
              Subscriber analytics will appear once data is collected
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
