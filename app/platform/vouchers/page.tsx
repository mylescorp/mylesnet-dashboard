"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Plus, ChevronRight, ChevronDown } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";
import { Field, Select, TextInput, StatusPill, EmptyState, Loading, ErrorNote, formatMoney, formatDate } from "../components/ui";

const PLANS = ["half_day", "day", "week", "month", "specialty"] as const;
const PLAN_LABEL: Record<string, string> = { half_day: "Half-day", day: "Day", week: "Week", month: "Month", specialty: "Specialty" };

const voucherTone = (s: string) =>
  s === "redeemed" ? "success" : s === "sold" ? "warning" : s === "expired" ? "danger" : "neutral";

export default function VouchersPage() {
  const [marketId, setMarketId] = useState("");
  const batches = useQuery(api.vouchers.listBatches, marketId ? { marketId: marketId as Id<"markets"> } : {});
  const markets = useQuery(api.markets.listMarkets);
  const agents = useQuery(api.agents.listAgents);
  const generateBatch = useMutation(api.vouchers.generateVoucherBatch);

  const [genMarketId, setGenMarketId] = useState("");
  const [planType, setPlanType] = useState<(typeof PLANS)[number]>("day");
  const [quantity, setQuantity] = useState("10");
  const [currency, setCurrency] = useState<"UGX" | "KSH">("UGX");
  const [priceEach, setPriceEach] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!genMarketId) {
      setError("Choose a market.");
      return;
    }
    try {
      const batchId = await generateBatch({
        marketId: genMarketId as Id<"markets">,
        planType,
        quantity: Number(quantity),
        currency,
        priceEach: Number(priceEach),
      });
      setMessage(`Batch #${String(batchId).slice(-6)} generated with ${quantity} voucher(s).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate batch");
    }
  };

  if (batches === undefined || markets === undefined || agents === undefined) return <Loading />;

  return (
    <div className="workspace-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Platform</p>
          <h1 className="page-title">Vouchers</h1>
          <p className="page-subtitle">Batch generation, allocation to agents, sale and manual redemption.</p>
        </div>
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}
      {message && <p className="platform-claim-message ok" role="status">{message}</p>}

      <form className="pf-panel" style={{ marginBottom: 22 }} onSubmit={handleGenerate}>
        <h2>Generate a batch</h2>
        <p className="pf-muted">Voucher codes carry a checksum so guessed codes never validate.</p>
        <div className="pf-form-grid">
          <Field label="Market">
            <Select value={genMarketId || marketId} onChange={(e) => setGenMarketId(e.target.value)} required>
              <option value="" disabled>Select market…</option>
              {markets.map((m) => (
                <option key={m._id} value={m._id as string}>{m.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Plan">
            <Select value={planType} onChange={(e) => setPlanType(e.target.value as (typeof PLANS)[number])}>
              {PLANS.map((p) => (<option key={p} value={p}>{PLAN_LABEL[p]}</option>))}
            </Select>
          </Field>
          <Field label="Quantity">
            <TextInput type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
          </Field>
          <Field label="Currency">
            <Select value={currency} onChange={(e) => setCurrency(e.target.value as "UGX" | "KSH")}>
              <option value="UGX">UGX</option>
              <option value="KSH">KSH</option>
            </Select>
          </Field>
          <Field label="Price each">
            <TextInput type="number" step="0.01" min="0" value={priceEach} onChange={(e) => setPriceEach(e.target.value)} required />
          </Field>
        </div>
        <div className="pf-form-actions">
          <button type="submit" className="primary-button"><Plus aria-hidden="true" size={16} /> Generate batch</button>
        </div>
      </form>

      <div className="pf-panel">
        <h2>Batches</h2>
        <div className="pf-page-toolbar" style={{ marginTop: 8 }}>
          <div className="pf-tools">
            <Field label="Filter by market">
              <Select value={marketId} onChange={(e) => setMarketId(e.target.value)}>
                <option value="">All markets</option>
                {markets.map((m) => (
                  <option key={m._id} value={m._id as string}>{m.name}</option>
                ))}
              </Select>
            </Field>
          </div>
        </div>

        {batches.length === 0 ? (
          <EmptyState title="No batches yet" body="Generate your first batch above." />
        ) : (
          <div className="pf-table-wrap">
            <table className="pf-table">
              <thead>
                <tr>
                  <th></th>
                  <th>Market</th>
                  <th>Plan</th>
                  <th>Qty</th>
                  <th>Price each</th>
                  <th className="pf-hide-sm">Generated</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => (
                  <BatchRow
                    key={b._id}
                    batchId={b._id}
                    batch={b as any}
                    markets={markets as any[]}
                    agents={agents as any[]}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function BatchRow({ batchId, batch, markets, agents }: any) {
  const [open, setOpen] = useState(false);
  const market = markets.find((m: any) => m._id === batch.marketId);
  const rowOpen = open;

  return (
    <>
      <tr style={{ cursor: "pointer" }} onClick={() => setOpen(!open)}>
        <td>{rowOpen ? <ChevronDown aria-hidden="true" size={15} /> : <ChevronRight aria-hidden="true" size={15} />}</td>
        <td><strong>{market ? market.name : `#${String(batch.marketId).slice(-6)}`}</strong></td>
        <td>{PLAN_LABEL[batch.planType] ?? batch.planType}</td>
        <td>{batch.quantity}</td>
        <td>{formatMoney(batch.priceEach, batch.currency)}</td>
        <td className="pf-hide-sm">{formatDate(batch.createdAt)}</td>
      </tr>
      {rowOpen && (
        <tr>
          <td colSpan={6} style={{ background: "color-mix(in srgb, var(--surface-strong) 30%, transparent)", padding: "8px" }}>
            <BatchVouchers batchId={batchId} agents={agents} />
          </td>
        </tr>
      )}
    </>
  );
}

function BatchVouchers({ batchId, agents }: { batchId: string; agents: any[] }) {
  const vouchers = useQuery(api.vouchers.listVouchersForBatch, { batchId: batchId as Id<"voucherBatches"> });
  const allocateVoucher = useMutation(api.vouchers.allocateVoucherToAgent);
  const markSold = useMutation(api.vouchers.markVoucherSold);
  const redeemVoucher = useMutation(api.vouchers.redeemVoucher);
  const [allocAgent, setAllocAgent] = useState<Record<string, string>>({});
  const [customerPhone, setCustomerPhone] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  if (vouchers === undefined) return <Loading />;

  if (vouchers.length === 0) {
    return <EmptyState title="No vouchers in this batch" />;
  }

  return (
    <div>
      {error && <ErrorNote>{error}</ErrorNote>}
      <div className="pf-table-wrap">
        <table className="pf-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Status</th>
              <th className="pf-hide-sm">Expires</th>
              <th>Owner</th>
              <th>Customer phone</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {vouchers.map((v) => {
              const owner = agents.find((a: any) => a._id === v.ownerAgentId);
              return (
                <tr key={v._id}>
                  <td><strong>{v.code}</strong></td>
                  <td><StatusPill tone={voucherTone(v.voucherStatus)}>{v.voucherStatus}</StatusPill></td>
                  <td className="pf-hide-sm">{formatDate(v.expiresAt)}</td>
                  <td>{owner ? owner.name : v.ownerAgentId ? `#${String(v.ownerAgentId).slice(-6)}` : "—"}</td>
                  <td>
                    {v.voucherStatus === "redeemed" ? (
                      v.customerPhoneAtRedemption ?? "—"
                    ) : (
                      <TextInput
                        placeholder="Customer phone"
                        value={customerPhone[v._id] ?? ""}
                        onChange={(e) => setCustomerPhone((r) => ({ ...r, [v._id]: e.target.value }))}
                        style={{ width: 150 }}
                      />
                    )}
                  </td>
                  <td className="pf-actions">
                    {v.voucherStatus === "unallocated" && (
                      <>
                        <Select value={allocAgent[v._id] ?? ""} onChange={(e) => setAllocAgent((r) => ({ ...r, [v._id]: e.target.value }))}>
                          <option value="">Allocate to…</option>
                          {agents.map((a) => (<option key={a._id} value={a._id}>{a.name}</option>))}
                        </Select>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={async () => {
                            if (!allocAgent[v._id]) { setError("Pick an agent to allocate to."); return; }
                            try {
                              await allocateVoucher({ voucherId: v._id, agentId: allocAgent[v._id] as Id<"agents"> });
                            } catch (err) { setError(err instanceof Error ? err.message : "Allocation failed"); }
                          }}
                        >
                          Allocate
                        </button>
                      </>
                    )}
                    {v.voucherStatus === "owned" && (
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={async () => {
                          try { await markSold({ voucherId: v._id }); }
                          catch (err) { setError(err instanceof Error ? err.message : "Failed"); }
                        }}
                      >
                        Mark sold
                      </button>
                    )}
                    {(v.voucherStatus === "sold" || v.voucherStatus === "owned") && (
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={async () => {
                          try {
                            await redeemVoucher({ voucherId: v._id, customerPhoneAtRedemption: customerPhone[v._id] || undefined });
                          } catch (err) { setError(err instanceof Error ? err.message : "Redemption failed"); }
                        }}
                      >
                        Redeem
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
