"use client";

import { useState } from "react";
import Link from "next/link";
import { 
  MapPin, 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  RefreshCw,
  Globe,
  DollarSign,
  ArrowRight,
  Calendar,
  ExternalLink,
  Settings
} from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { platformMarkets } from "@/shared/convex/platformMarkets";
import { Id } from "@/convex/_generated/dataModel";

interface PlatformMarketsProps {
  tenantId: Id<"tenants">;
}

const lifecycleConfig = {
  planned: { label: "Planned", color: "bg-slate-100 text-slate-700 border-slate-200" },
  active: { label: "Active", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  paused: { label: "Paused", color: "bg-amber-100 text-late-700 border-amber-200" },
  decommissioned: { label: "Decommissioned", color: "bg-red-100 text-red-700 border-red-200" },
} as const;

export function PlatformMarkets({ tenantId }: PlatformMarketsProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"planned" | "active" | "paused" | "decommissioned" | "">("");
  
  const markets = useQuery(platformMarkets.listMarkets, {
    tenantId,
    lifecycleStatus: filterStatus || undefined,
  });

  const createMarket = useMutation(platformMarkets.createMarket);
  const updateMarket = useMutation(platformMarkets.updateMarket);
  const softDeleteMarket = useMutation(platformMarkets.softDeleteMarket);
  const restoreMarket = useMutation(platformMarkets.restoreMarket);

  const handleCreateMarket = async () => {
    console.log("Create market for tenant:", tenantId);
  };

  const handleUpdateMarket = async (marketId: Id<"markets">) => {
    console.log("Update market:", marketId);
  };

  const handleDeleteMarket = async (marketId: Id<"markets">) => {
    if (confirm("Are you sure you want to delete this market?")) {
      await softDeleteMarket({ 
        marketId, 
        deleteReason: "Deleted by platform admin",
        forceCascade: false 
      });
    }
  };

  const handleRestoreMarket = async (marketId: Id<"markets">) => {
    await restoreMarket({ marketId });
  };

  const filteredMarkets = markets?.filter((market: any) => 
    market.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    market.country.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
            <Link href="/platform/organizations" className="hover:text-slate-700 transition-colors">
              <span className="font-medium">Organizations</span>
            </Link>
            <span className="text-slate-300">/</span>
            <span>Markets</span>
          </div>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-semibold text-slate-900 tracking-tight mb-2">
                Organization Markets
              </h1>
              <p className="text-slate-600 max-w-2xl">
                Manage markets for this organization. Configure location, currency, and operational status.
              </p>
            </div>
            <button 
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 transition-all duration-200 shadow-lg shadow-slate-900/20 hover:shadow-xl hover:shadow-slate-900/30 hover:-translate-y-0.5"
              onClick={handleCreateMarket}
            >
              <Plus size={18} aria-hidden="true" />
              New Market
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        {markets && markets.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-slate-600">Total</span>
                <MapPin size={18} className="text-slate-400" />
              </div>
              <div className="text-2xl font-semibold text-slate-900">{markets.length}</div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-slate-600">Active</span>
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
              </div>
              <div className="text-2xl font-semibold text-slate-900">
                {markets.filter((m: any) => m.lifecycleStatus === "active").length}
              </div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-slate-600">Countries</span>
                <Globe size={18} className="text-slate-400" />
              </div>
              <div className="text-2xl font-semibold text-slate-900">
                {new Set(markets.map((m: any) => m.country)).size}
              </div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-slate-600">Currencies</span>
                <DollarSign size={18} className="text-slate-400" />
              </div>
              <div className="text-2xl font-semibold text-slate-900">
                {new Set(markets.map((m: any) => m.currency)).size}
              </div>
            </div>
          </div>
        )}

        {/* Search and Filter Bar */}
        <div className="mb-6 flex gap-4">
          <div className="relative flex-1">
            <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="search" 
              placeholder="Search markets by name or country..." 
              className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-900 transition-all duration-200"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <select 
            className="px-4 py-3 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-900 transition-all duration-200"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as "planned" | "active" | "paused" | "decommissioned" | "")}
          >
            <option value="">All Status</option>
            <option value="planned">Planned</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="decommissioned">Decommissioned</option>
          </select>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {filteredMarkets.length > 0 ? (
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50">
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Market
                  </th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Country
                  </th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Currency
                  </th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Lifecycle
                  </th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="text-right px-6 py-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMarkets.map((market: any) => {
                  const statusConfig = {
                    active: { label: "Active", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
                    deleted: { label: "Deleted", color: "bg-red-100 text-red-700 border-red-200" },
                  };
                  const status = statusConfig[market.status as keyof typeof statusConfig] || statusConfig.active;
                  const lifecycle = lifecycleConfig[market.lifecycleStatus as keyof typeof lifecycleConfig] || lifecycleConfig.planned;
                  
                  return (
                    <tr 
                      key={market._id}
                      className="hover:bg-slate-50/50 transition-colors duration-150 group"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                            <MapPin size={20} className="text-slate-600" />
                          </div>
                          <span className="font-medium text-slate-900">{market.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-slate-700">
                          <Globe size={16} className="text-slate-400" />
                          <span className="font-medium">{market.country}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-slate-700">
                          <DollarSign size={16} className="text-slate-400" />
                          <span className="font-medium">{market.currency}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border ${status.color}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border ${lifecycle.color}`}>
                          {lifecycle.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-slate-600">
                          <Calendar size={16} className="text-slate-400" />
                          <span className="text-sm">
                            {new Date(market.createdAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric"
                            })}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {market.status === "deleted" ? (
                            <button
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50 rounded-lg transition-all duration-150"
                              onClick={() => handleRestoreMarket(market._id)}
                              title="Restore market"
                            >
                              <RefreshCw size={14} />
                              Restore
                            </button>
                          ) : (
                            <>
                              <button
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all duration-150"
                                onClick={() => handleUpdateMarket(market._id)}
                                title="Edit market"
                              >
                                <Edit size={14} />
                                Edit
                              </button>
                              <button
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 hover:text-red-900 hover:bg-red-50 rounded-lg transition-all duration-150"
                                onClick={() => handleDeleteMarket(market._id)}
                                title="Delete market"
                              >
                                <Trash2 size={14} />
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 px-6">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center mb-4">
                <MapPin size={32} className="text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                {markets?.length === 0 ? "No markets yet" : "No markets match your search"}
              </h3>
              <p className="text-slate-600 text-center max-w-sm mb-6">
                {markets?.length === 0 
                  ? "Create your first market to begin managing locations for this organization."
                  : "Try adjusting your search or filter criteria."}
              </p>
              {markets?.length === 0 && (
                <button 
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 transition-all duration-200 shadow-lg shadow-slate-900/20"
                  onClick={handleCreateMarket}
                >
                  <Plus size={18} aria-hidden="true" />
                  Create Market
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}