"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@/app/lib/convex";
import { api } from "@/convex/_generated/api";
import { Receipt, PiggyBank, Wrench, Trash2 } from "lucide-react";
import MetricCard from "@/app/components/MetricCard";
import { EmptyState, ErrorNote, Field, Loading, Select, StatusPill, TextInput, formatDateTime } from "@/app/components/ui";
import type { Id } from "@/convex/_generated/dataModel";

const CATEGORIES = ["airtel_data", "electricity", "rent", "salaries", "fuel", "maintenance", "equipment", "other"] as const;
const today = new Date();
const monthNow = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

const n = (v: number) => v.toLocaleString("en", { maximumFractionDigits: 2 });

export default function ExpensesPage() {
  const markets = useQuery(api.markets.listMarkets, {});
  const [month, setMonth] = useState(monthNow);
  const rows = useQuery(api.expenses.listExpenses, { month });
  const recordExpense = useMutation(api.expenses.recordExpense);
  const deleteExpense = useMutation(api.expenses.deleteExpense);

  const [marketId, setMarketId] = useState<Id<"markets"> | "">("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("airtel_data");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("UGX");
  const [type, setType] = useState<"variable" | "fixed">("variable");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (markets === undefined || rows === undefined) return <Loading />;

  const totalVar = rows.filter((r) => r.type === "variable").reduce((s, r) => s + r.amountLocal, 0);
  const totalFixed = rows.filter((r) => r.type === "fixed").reduce((s, r) => s + r.amountLocal, 0);
  const categoryCount = new Set(rows.map((r) => r.category)).size;

  async function onSubmit() {
    const amountLocal = Number(amount);
    if (!amountLocal || amountLocal <= 0) {
      setError("Enter a positive amount.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await recordExpense({
        marketId: marketId || undefined,
        category,
        amountLocal,
        currency,
        type,
        month,
        notes: notes || undefined,
      });
      setAmount("");
      setNotes("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record expense.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="workspace-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Finance</p>
          <h1 className="page-title">Expenses</h1>
          <p className="page-subtitle">Operating costs per market — recorded against the month for financials.</p>
        </div>
        <div style={{ minWidth: 220 }}>
          <TextInput type="month" value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Report month" />
        </div>
      </div>

      <div className="metric-grid">
        <MetricCard icon={Wrench} label="Variable costs" value={n(totalVar)} tone="warning" detail={month} />
        <MetricCard icon={PiggyBank} label="Fixed costs" value={n(totalFixed)} tone="primary" detail={month} />
        <MetricCard icon={Receipt} label="Entries" value={rows.length} tone="accent" detail={`${categoryCount} categories`} />
      </div>

      {error ? <ErrorNote>{error}</ErrorNote> : null}

      <div className="section-block">
        <div className="section-heading">
          <div><p className="eyebrow">Record</p><h2>Add expense</h2></div>
        </div>
        <div className="pf-panel">
          <div className="pf-form-grid">
            <Field label="Market" required>
              <Select value={marketId} onChange={(e) => setMarketId(e.target.value as Id<"markets"> | "")}>
                <option value="">National</option>
                {markets.map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}
              </Select>
            </Field>
            <Field label="Category" required>
              <Select value={category} onChange={(e) => setCategory(e.target.value as (typeof CATEGORIES)[number])}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c.replaceAll("_", " ")}</option>)}
              </Select>
            </Field>
            <Field label="Amount" required>
              <TextInput type="number" inputMode="decimal" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
            </Field>
            <Field label="Currency" required>
              <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                <option value="UGX">UGX</option>
                <option value="KSH">KSH</option>
                <option value="USD">USD</option>
              </Select>
            </Field>
            <Field label="Type" required>
              <Select value={type} onChange={(e) => setType(e.target.value as "variable" | "fixed")}>
                <option value="variable">Variable</option>
                <option value="fixed">Fixed</option>
              </Select>
            </Field>
            <Field label="Notes">
              <TextInput value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
            </Field>
          </div>
          <button className="primary-button" onClick={onSubmit} disabled={saving} style={{ marginTop: 14 }}>
            {saving ? "Recording…" : "Record expense"}
          </button>
        </div>
      </div>

      <div className="section-block">
        <div className="section-heading">
          <div><p className="eyebrow">Ledger</p><h2>Expenses — {month}</h2></div>
        </div>
        <div className="pf-panel">
          {rows.length === 0 ? (
            <EmptyState title="No expenses recorded" body="Record an expense above, or pick another month." />
          ) : (
            <div className="pf-table-wrap">
              <table className="pf-table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th className="pf-hide-sm">Market</th>
                    <th>Amount</th>
                    <th>Type</th>
                    <th className="pf-hide-sm">Entered</th>
                    <th className="pf-hide-sm">Notes</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r._id}>
                      <td><strong>{r.category.replaceAll("_", " ")}</strong></td>
                      <td className="pf-hide-sm">{r.marketId ? markets.find((m) => m._id === r.marketId)?.name ?? "—" : "National"}</td>
                      <td>{n(r.amountLocal)} {r.currency}</td>
                      <td><StatusPill tone={r.type === "fixed" ? "neutral" : "warning"}>{r.type}</StatusPill></td>
                      <td className="pf-hide-sm">{formatDateTime(r.enteredAt)}</td>
                      <td className="pf-hide-sm" style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.notes ?? "—"}</td>
                      <td className="pf-actions">
                        <button className="secondary-button" onClick={() => deleteExpense({ expenseId: r._id })} title="Delete"><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
