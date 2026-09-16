"use client";

import { useMemo, useState } from "react";
import { FileCode, Save } from "lucide-react";
import { useMutation, useQuery } from "@/app/lib/convex";
import { useUserProfile } from "./UserProfileContext";
import {
  policyTemplates,
  type PolicyTemplateRow,
  type PolicyTemplateStatus,
} from "@/lib/convex/policyTemplates";

const STATUS_FILTERS = [
  { key: "all", label: "All" },
  { key: "draft", label: "Drafts" },
  { key: "published", label: "Published" },
  { key: "retired", label: "Retired" },
] as const;

type StatusTone = "neutral" | "warning" | "success" | "muted";
const STATUS_TONE: Record<string, StatusTone> = {
  draft: "neutral",
  published: "success",
  retired: "muted",
};

const canEdit = (roles: { slug: string }[] | undefined) =>
  roles?.some((role) =>
    ["platform_owner", "platform_admin", "ops_manager"].includes(role.slug),
  );

const canRetire = (roles: { slug: string }[] | undefined) =>
  roles?.some((role) => role.slug === "platform_owner");

export function PlatformPolicyTemplates() {
  const { user } = useUserProfile();
  const rows = useQuery(policyTemplates.list, {});
  const publishTemplate = useMutation(policyTemplates.publish);
  const retireTemplate = useMutation(policyTemplates.retire);
  const [filter, setFilter] = useState<string>("all");
  const [editRow, setEditRow] = useState<PolicyTemplateRow | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const editable = canEdit(user?.roles);
  const retireAllowed = canRetire(user?.roles);

  const visible = useMemo(() => {
    if (!rows) return undefined;
    if (filter === "all") return rows;
    return rows.filter((row) => row.status === filter);
  }, [rows, filter]);

  const metrics = useMemo(
    () => ({
      total: rows?.length ?? 0,
      drafts: rows?.filter((r) => r.status === "draft").length ?? 0,
      published: rows?.filter((r) => r.status === "published").length ?? 0,
      retired: rows?.filter((r) => r.status === "retired").length ?? 0,
    }),
    [rows],
  );

  return (
    <div className="workspace-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Platform control plane</p>
          <h1 className="page-title">Policy templates</h1>
          <p className="page-subtitle">
            Versioned PPPoE and rate-limit profiles. Published versions are
            immutable: tenants provisioned against older versions keep their
            behaviour when a new version ships.
          </p>
        </div>
      </header>

      {error ? (
        <p className="platform-claim-message" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="platform-notice" role="status">
          {notice}
        </p>
      ) : null}

      <section className="metric-grid" aria-label="Policy template summary">
        <Metric
          label="Templates"
          value={metrics.total}
          detail="across all families"
        />
        <Metric label="Drafts" value={metrics.drafts} detail="editable" />
        <Metric
          label="Published"
          value={metrics.published}
          detail="immutable"
        />
        <Metric
          label="Retired"
          value={metrics.retired}
          detail="terminal state"
        />
      </section>

      <section className="section-heading">
        <div>
          <p className="eyebrow">Families</p>
          <h2>All template versions</h2>
        </div>
        <div className="tab-row" role="tablist" aria-label="Filter templates">
          {STATUS_FILTERS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={filter === key}
              className={`tab-button ${filter === key ? "tab-button-active" : ""}`}
              onClick={() => setFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {rows === undefined ? (
        <p className="pf-muted">Loading policy templates…</p>
      ) : visible?.length === 0 ? (
        <div className="tenant-empty-state">
          <FileCode size={26} aria-hidden="true" />
          <h3>
            No {filter === "all" ? "" : `${filter} `}
            templates
          </h3>
          <p>Create the first policy template for a PPPoE or rate-limit family.</p>
        </div>
      ) : (
        <div className="table-scroll">
          <table className="pf-table">
            <thead>
              <tr>
                <th>Family</th>
                <th>Name</th>
                <th>Ver.</th>
                <th>Kind</th>
                <th>↓ Mbps</th>
                <th>↑ Mbps</th>
                <th>Status</th>
                {editable ? <th className="pf-action-col">Action</th> : null}
              </tr>
            </thead>
            <tbody>
              {visible?.map((row) => (
                <tr key={row._id}>
                  <td className="pf-cell-main">{row.code}</td>
                  <td>{row.name}</td>
                  <td>v{row.version}</td>
                  <td>
                    <span className="pf-badge pf-badge-neutral">
                      {row.kind}
                    </span>
                  </td>
                  <td>{row.downloadMbps}</td>
                  <td>{row.uploadMbps}</td>
                  <td>
                    <span
                      className={`pf-badge pf-badge-${STATUS_TONE[row.status]}`}
                    >
                      {row.status}
                    </span>
                  </td>
                  {editable ? (
                    <td className="pf-action-col">
                      {row.status === "draft" ? (
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={async () => {
                            setError(null);
                            setNotice(null);
                            try {
                              await publishTemplate({
                                templateId: row._id,
                              });
                              setNotice(`"${row.name}" published — version is now immutable.`);
                            } catch (caught) {
                              setError(
                                caught instanceof Error
                                  ? caught.message
                                  : "Publish failed.",
                              );
                            }
                          }}
                        >
                          Publish
                        </button>
                      ) : row.status === "published" && retireAllowed ? (
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={async () => {
                            setError(null);
                            setNotice(null);
                            try {
                              await retireTemplate({
                                templateId: row._id,
                              });
                              setNotice(`"${row.name}" retired.`);
                            } catch (caught) {
                              setError(
                                caught instanceof Error
                                  ? caught.message
                                  : "Retire failed.",
                              );
                            }
                          }}
                        >
                          Retire
                        </button>
                      ) : (
                        <span className="pf-muted">—</span>
                      )}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <div className="metric-card">
      <p className="metric-label">{label}</p>
      <p className="metric-value">{value}</p>
      <p className="metric-detail">{detail}</p>
    </div>
  );
}
