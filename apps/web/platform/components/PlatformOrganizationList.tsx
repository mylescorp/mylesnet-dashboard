"use client";

import Link from "next/link";
import { Building2, Plus, Search, Users, Calendar, ExternalLink, ArrowRight } from "lucide-react";
import { useQuery } from "@/app/lib/convex";
import { tenantControl, type PlatformTenant } from "@/lib/convex/tenantControl";

const statusConfig = {
  active: { label: "Active", color: "bg-muted text-foreground border-border" },
  trial: { label: "Trial", color: "bg-muted text-foreground border-border" },
  suspended: { label: "Suspended", color: "bg-muted text-foreground border-border" },
  cancelled: { label: "Cancelled", color: "bg-muted text-foreground border-border" },
  provisioning: { label: "Provisioning", color: "bg-muted text-muted-foreground border-border" },
} as const;

export function PlatformOrganizationList() {
  const tenants = useQuery(tenantControl.listForPlatform, {});

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--canvas)" }}>
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm mb-2" style={{ color: "var(--muted-text)" }}>
            <span className="font-medium">Platform</span>
            <span style={{ color: "var(--border)" }}>/</span>
            <span>Organizations</span>
          </div>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight mb-2" style={{ color: "var(--text-strong)" }}>
                Organizations
              </h1>
              <p style={{ color: "var(--text)" }}>
                Manage all tenant organizations across the platform. Monitor status, membership, and access organization settings.
              </p>
            </div>
            <Link 
              href="/platform/organizations/new"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-all duration-200 shadow-lg hover:-translate-y-0.5"
              style={{
                backgroundColor: "var(--primary-action)",
                color: "var(--primary-action-foreground)",
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "var(--primary-action-hover)"}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "var(--primary-action)"}
            >
              <Plus size={18} aria-hidden="true" />
              New Organization
            </Link>
          </div>
        </div>

        {/* Stats Cards */}
        {tenants && tenants.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="rounded-lg border p-5 shadow-sm" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium" style={{ color: "var(--muted-text)" }}>Total</span>
                <Building2 size={18} style={{ color: "var(--muted-text)" }} />
              </div>
              <div className="text-2xl font-semibold" style={{ color: "var(--text-strong)" }}>{tenants.length}</div>
            </div>
            <div className="rounded-lg border p-5 shadow-sm" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium" style={{ color: "var(--muted-text)" }}>Active</span>
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: "var(--success)" }} />
              </div>
              <div className="text-2xl font-semibold" style={{ color: "var(--text-strong)" }}>
                {tenants.filter(t => t.status === "active").length}
              </div>
            </div>
            <div className="rounded-lg border p-5 shadow-sm" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium" style={{ color: "var(--muted-text)" }}>Trial</span>
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: "var(--info)" }} />
              </div>
              <div className="text-2xl font-semibold" style={{ color: "var(--text-strong)" }}>
                {tenants.filter(t => t.status === "trial").length}
              </div>
            </div>
            <div className="rounded-lg border p-5 shadow-sm" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium" style={{ color: "var(--muted-text)" }}>Total Members</span>
                <Users size={18} style={{ color: "var(--muted-text)" }} />
              </div>
              <div className="text-2xl font-semibold" style={{ color: "var(--text-strong)" }}>
                {tenants.reduce((sum, t) => sum + (t.membershipCount || 0), 0)}
              </div>
            </div>
          </div>
        )}

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: "var(--muted-text)" }} />
            <input 
              type="search" 
              placeholder="Search organizations by name or slug..." 
              className="w-full pl-12 pr-4 py-3 rounded-lg focus:outline-none focus:ring-2 transition-all duration-200"
              style={{
                backgroundColor: "var(--surface)",
                borderColor: "var(--border)",
                color: "var(--text)",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "var(--primary)";
                e.currentTarget.style.boxShadow = "0 0 0 2px var(--primary-action-foreground)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "var(--border)";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
          </div>
        </div>

        {/* Table */}
        <div className="rounded-lg border shadow-sm overflow-hidden" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
          {tenants && tenants.length > 0 ? (
            <table className="w-full">
              <thead>
                <tr className="border-b" style={{ backgroundColor: "var(--muted-surface)", borderColor: "var(--border)" }}>
                  <th className="text-left px-6 py-4 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted-text)" }}>
                    Organization
                  </th>
                  <th className="text-left px-6 py-4 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted-text)" }}>
                    Status
                  </th>
                  <th className="text-left px-6 py-4 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted-text)" }}>
                    Members
                  </th>
                  <th className="text-left px-6 py-4 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted-text)" }}>
                    Created
                  </th>
                  <th className="text-right px-6 py-4 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted-text)" }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
                {tenants.map((tenant) => {
                  const status = statusConfig[tenant.status as keyof typeof statusConfig] || statusConfig.provisioning;
                  return (
                    <tr 
                      key={tenant._id}
                      className="hover:bg-muted/50 transition-colors duration-150 group"
                      style={{ backgroundColor: "var(--surface)" }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "var(--muted-surface)"}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "var(--surface)"}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: "var(--muted-surface)" }}>
                            <Building2 size={20} style={{ color: "var(--muted-text)" }} />
                          </div>
                          <div>
                            <div className="font-medium" style={{ color: "var(--text-strong)" }}>{tenant.name}</div>
                            <div className="text-sm font-mono" style={{ color: "var(--muted-text)" }}>{tenant.slug}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border ${status.color}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2" style={{ color: "var(--text)" }}>
                          <Users size={16} style={{ color: "var(--muted-text)" }} />
                          <span className="font-medium">{tenant.membershipCount || 0}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2" style={{ color: "var(--muted-text)" }}>
                          <Calendar size={16} style={{ color: "var(--muted-text)" }} />
                          <span className="text-sm">
                            {new Date(tenant.createdAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric"
                            })}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <Link 
                            href={`/platform/organizations/${tenant._id}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-150"
                            style={{ color: "var(--text)" }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = "var(--muted-surface)";
                              e.currentTarget.style.color = "var(--text-strong)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = "transparent";
                              e.currentTarget.style.color = "var(--text)";
                            }}
                          >
                            View
                            <ExternalLink size={14} />
                          </Link>
                          <Link 
                            href={`/platform/organizations/${tenant._id}/markets`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-150"
                            style={{ color: "var(--text)" }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = "var(--muted-surface)";
                              e.currentTarget.style.color = "var(--text-strong)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = "transparent";
                              e.currentTarget.style.color = "var(--text)";
                            }}
                          >
                            Markets
                            <ArrowRight size={14} />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 px-6">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: "var(--muted-surface)" }}>
                <Building2 size={32} style={{ color: "var(--muted-text)" }} />
              </div>
              <h3 className="text-lg font-semibold mb-2" style={{ color: "var(--text-strong)" }}>No organizations yet</h3>
              <p className="text-center max-w-sm mb-6" style={{ color: "var(--text)" }}>
                Get started by creating your first organization to begin managing tenants across the platform.
              </p>
              <Link 
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-all duration-200 shadow-lg"
                href="/platform/organizations/new"
                style={{
                  backgroundColor: "var(--primary-action)",
                  color: "var(--primary-action-foreground)",
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "var(--primary-action-hover)"}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "var(--primary-action)"}
              >
                <Plus size={18} aria-hidden="true" />
                Create Organization
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}