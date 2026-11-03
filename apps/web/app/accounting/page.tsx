"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../src/lib/api";
import { useUsers } from "../../src/hooks/queries";
import {
  BookOpen, FileText, Receipt, DollarSign, Users, Plus, Loader2, Search,
  TrendingUp, Building2, Banknote, ArrowUpCircle, ArrowDownCircle,
  BarChart3
} from "lucide-react";
import { PageShell, PageHeader, Tabs as UiTabs } from "../../src/components/ui/page";
import { KpiCard, ChartCard, BarList } from "../../src/components/ui/charts";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const CURRENT_YEAR = new Date().getFullYear();

const fmt = (n: any) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const fmtDate = (d: any) => d ? new Date(d).toLocaleDateString("en-IN") : "—";

type Tab = "overview" | "purchases" | "expenses" | "bank" | "cash" | "salaries";

// ─── Generic Modal ────────────────────────────────────────────────────────────
function Modal({ open, onClose, title, children }: any) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-slate-100 flex justify-between items-center">
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function FormRow({ label, children, required }: any) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white";

// ─── Overview Card ────────────────────────────────────────────────────────────
function OverviewTab() {
  const { data: summary, isLoading } = useQuery({
    queryKey: ["accounting-summary"],
    queryFn: async () => {
      const { data } = await api.get("/accounting/summary");
      return data;
    },
  });

  if (isLoading) return <div className="py-16 text-center text-slate-400"><Loader2 className="w-8 h-8 animate-spin mx-auto" /></div>;

  if (!summary) return <p className="py-10 text-center text-sm text-slate-400">Summary could not be loaded.</p>;
  const money = (v: any) => (v === null || v === undefined ? "—" : fmt(v));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCard label="Bank balance" value={money(summary.bankBalance)} icon={Building2} tone={Number(summary.bankBalance) < 0 ? "critical" : "info"} />
        <KpiCard label="Revenue collected (all time)" value={money(summary.totalRevenueAllTime)} icon={TrendingUp} tone="ok" />
        <KpiCard label="Expenses (all time)" value={money(summary.totalExpensesAllTime)} icon={Receipt} tone="warning" />
      </div>
      <ChartCard title="This month">
        <BarList
          items={[
            { label: "Purchases", value: Number(summary.totalPurchasesThisMonth) || 0, color: "#3b82f6" },
            { label: "Expenses", value: Number(summary.totalExpensesThisMonth) || 0, color: "#f43f5e" },
            { label: "Salaries", value: Number(summary.totalSalaryThisMonth) || 0, color: "#8b5cf6" },
          ].filter(i => i.value > 0)}
          empty="Nothing spent this month yet."
          format={(v) => fmt(v)}
        />
      </ChartCard>
    </div>
  );
}

// ─── Purchase Register ────────────────────────────────────────────────────────
function PurchaseTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ vendor: "", description: "", invoiceNo: "", amount: "", gstAmount: "0", category: "General", date: "", paidVia: "Bank Transfer", notes: "" });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const { data, isLoading } = useQuery({
    queryKey: ["purchases", search],
    queryFn: async () => {
      const { data } = await api.get(`/accounting/purchases?search=${search}&limit=50`);
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: (d: any) => api.post("/accounting/purchases", d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["purchases"] }); qc.invalidateQueries({ queryKey: ["accounting-summary"] }); setOpen(false); setForm({ vendor: "", description: "", invoiceNo: "", amount: "", gstAmount: "0", category: "General", date: "", paidVia: "Bank Transfer", notes: "" }); },
  });

  const entries = data?.entries || [];
  const total = entries.reduce((s: number, e: any) => s + Number(e.totalAmount || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input className="pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64" placeholder="Search vendor..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-slate-600">Total: <strong className="text-slate-900">{fmt(total)}</strong></span>
          <button onClick={() => setOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg">
            <Plus className="w-4 h-4" /> Add Entry
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="min-w-full divide-y divide-slate-100">
          <thead className="bg-slate-50">
            <tr>{["Date","Vendor","Invoice No","Category","Amount","GST","Total","Paid Via"].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {isLoading ? <tr><td colSpan={8} className="py-10 text-center text-slate-400">Loading...</td></tr>
              : entries.length === 0 ? <tr><td colSpan={8} className="py-10 text-center text-slate-400">No purchase entries yet</td></tr>
              : entries.map((e: any) => (
                <tr key={e.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-xs text-slate-500">{fmtDate(e.date)}</td>
                  <td className="px-4 py-3 text-sm font-medium text-slate-900">{e.vendor}</td>
                  <td className="px-4 py-3 text-xs font-mono text-slate-600">{e.invoiceNo || "—"}</td>
                  <td className="px-4 py-3"><span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{e.category}</span></td>
                  <td className="px-4 py-3 text-sm text-slate-900">{fmt(e.amount)}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{fmt(e.gstAmount)}</td>
                  <td className="px-4 py-3 text-sm font-bold text-slate-900">{fmt(e.totalAmount)}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{e.paidVia || "—"}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Add Purchase Entry">
        <form onSubmit={e => { e.preventDefault(); createMutation.mutate(form); }} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <FormRow label="Vendor" required><input className={inputCls} value={form.vendor} onChange={e => set("vendor", e.target.value)} required /></FormRow>
            <FormRow label="Invoice No"><input className={inputCls} value={form.invoiceNo} onChange={e => set("invoiceNo", e.target.value)} /></FormRow>
          </div>
          <FormRow label="Description"><input className={inputCls} value={form.description} onChange={e => set("description", e.target.value)} /></FormRow>
          <div className="grid grid-cols-3 gap-3">
            <FormRow label="Amount ₹" required><input type="number" className={inputCls} value={form.amount} onChange={e => set("amount", e.target.value)} required /></FormRow>
            <FormRow label="GST ₹"><input type="number" className={inputCls} value={form.gstAmount} onChange={e => set("gstAmount", e.target.value)} /></FormRow>
            <FormRow label="Date" required><input type="date" className={inputCls} value={form.date} onChange={e => set("date", e.target.value)} required /></FormRow>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormRow label="Category"><select className={inputCls} value={form.category} onChange={e => set("category", e.target.value)}>{["General","Software","Hardware","Services","Office Supplies","Subscription","Travel"].map(c => <option key={c}>{c}</option>)}</select></FormRow>
            <FormRow label="Paid Via"><select className={inputCls} value={form.paidVia} onChange={e => set("paidVia", e.target.value)}>{["Bank Transfer","Cash","UPI","Cheque","Credit Card"].map(c => <option key={c}>{c}</option>)}</select></FormRow>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setOpen(false)} className="flex-1 py-2.5 text-sm border border-slate-200 rounded-lg">Cancel</button>
            <button type="submit" disabled={createMutation.isPending} className="flex-1 py-2.5 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium disabled:opacity-60">
              {createMutation.isPending ? "Saving..." : "Add Entry"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// ─── Expense Register ─────────────────────────────────────────────────────────
function ExpenseTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ description: "", category: "Office", amount: "", date: "", paidBy: "", paymentMode: "Cash", notes: "" });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const { data, isLoading } = useQuery({
    queryKey: ["expenses"],
    queryFn: async () => { const { data } = await api.get("/accounting/expenses?limit=50"); return data; },
  });

  const createMutation = useMutation({
    mutationFn: (d: any) => api.post("/accounting/expenses", d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["expenses"] }); qc.invalidateQueries({ queryKey: ["accounting-summary"] }); setOpen(false); },
  });

  const entries = data?.entries || [];
  const total = entries.reduce((s: number, e: any) => s + Number(e.amount || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-600">Total Expenses: <strong>{fmt(total)}</strong></span>
        <button onClick={() => setOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium rounded-lg">
          <Plus className="w-4 h-4" /> Add Expense
        </button>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="min-w-full divide-y divide-slate-100">
          <thead className="bg-slate-50">
            <tr>{["Date","Description","Category","Amount","Paid By","Mode"].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {isLoading ? <tr><td colSpan={6} className="py-10 text-center text-slate-400">Loading...</td></tr>
              : entries.length === 0 ? <tr><td colSpan={6} className="py-10 text-center text-slate-400">No expense entries yet</td></tr>
              : entries.map((e: any) => (
                <tr key={e.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-xs text-slate-500">{fmtDate(e.date)}</td>
                  <td className="px-4 py-3 text-sm text-slate-900">{e.description}</td>
                  <td className="px-4 py-3"><span className="text-xs bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full">{e.category}</span></td>
                  <td className="px-4 py-3 text-sm font-bold text-orange-700">{fmt(e.amount)}</td>
                  <td className="px-4 py-3 text-xs text-slate-600">{e.paidBy || "—"}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{e.paymentMode || "—"}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="Add Expense">
        <form onSubmit={e => { e.preventDefault(); createMutation.mutate(form); }} className="p-5 space-y-4">
          <FormRow label="Description" required><input className={inputCls} value={form.description} onChange={e => set("description", e.target.value)} required /></FormRow>
          <div className="grid grid-cols-2 gap-3">
            <FormRow label="Amount ₹" required><input type="number" className={inputCls} value={form.amount} onChange={e => set("amount", e.target.value)} required /></FormRow>
            <FormRow label="Date" required><input type="date" className={inputCls} value={form.date} onChange={e => set("date", e.target.value)} required /></FormRow>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormRow label="Category"><select className={inputCls} value={form.category} onChange={e => set("category", e.target.value)}>{["Office","Travel","Utilities","Meals","Marketing","Equipment","Miscellaneous"].map(c => <option key={c}>{c}</option>)}</select></FormRow>
            <FormRow label="Payment Mode"><select className={inputCls} value={form.paymentMode} onChange={e => set("paymentMode", e.target.value)}>{["Cash","UPI","Bank Transfer","Credit Card"].map(c => <option key={c}>{c}</option>)}</select></FormRow>
          </div>
          <FormRow label="Paid By"><input className={inputCls} placeholder="Person/Department" value={form.paidBy} onChange={e => set("paidBy", e.target.value)} /></FormRow>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setOpen(false)} className="flex-1 py-2.5 text-sm border border-slate-200 rounded-lg">Cancel</button>
            <button type="submit" disabled={createMutation.isPending} className="flex-1 py-2.5 text-sm bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium disabled:opacity-60">
              {createMutation.isPending ? "Saving..." : "Add Expense"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// ─── Bank Book ────────────────────────────────────────────────────────────────
function BankTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ bankName: "", accountNo: "", txType: "CREDIT", amount: "", description: "", referenceNo: "", date: "", balance: "", notes: "" });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const { data, isLoading } = useQuery({
    queryKey: ["bank-transactions"],
    queryFn: async () => { const { data } = await api.get("/accounting/bank?limit=100"); return data; },
  });

  const createMutation = useMutation({
    mutationFn: (d: any) => api.post("/accounting/bank", d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bank-transactions"] }); qc.invalidateQueries({ queryKey: ["accounting-summary"] }); setOpen(false); },
  });

  const entries = data?.entries || [];
  const totalCredit = entries.filter((e: any) => e.txType === "CREDIT").reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
  const totalDebit = entries.filter((e: any) => e.txType === "DEBIT").reduce((s: number, e: any) => s + Number(e.amount || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-4 text-sm">
          <span className="text-green-700 font-medium">Total Credit: <strong>{fmt(totalCredit)}</strong></span>
          <span className="text-red-700 font-medium">Total Debit: <strong>{fmt(totalDebit)}</strong></span>
          <span className="text-indigo-700 font-semibold">Balance: <strong>{fmt(totalCredit - totalDebit)}</strong></span>
        </div>
        <button onClick={() => setOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg">
          <Plus className="w-4 h-4" /> Add Transaction
        </button>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="min-w-full divide-y divide-slate-100">
          <thead className="bg-slate-50">
            <tr>{["Date","Bank","Account","Ref No","Description","Type","Amount","Balance"].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {isLoading ? <tr><td colSpan={8} className="py-10 text-center text-slate-400">Loading...</td></tr>
              : entries.length === 0 ? <tr><td colSpan={8} className="py-10 text-center text-slate-400">No bank transactions yet</td></tr>
              : entries.map((e: any) => (
                <tr key={e.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-xs text-slate-500">{fmtDate(e.date)}</td>
                  <td className="px-4 py-3 text-sm text-slate-900">{e.bankName}</td>
                  <td className="px-4 py-3 text-xs font-mono text-slate-600">{e.accountNo || "—"}</td>
                  <td className="px-4 py-3 text-xs font-mono text-slate-600">{e.referenceNo || "—"}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{e.description}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${e.txType === "CREDIT" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                      {e.txType === "CREDIT" ? <ArrowUpCircle className="w-3 h-3" /> : <ArrowDownCircle className="w-3 h-3" />} {e.txType}
                    </span>
                  </td>
                  <td className={`px-4 py-3 text-sm font-bold ${e.txType === "CREDIT" ? "text-green-700" : "text-red-700"}`}>{fmt(e.amount)}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{e.balance != null ? fmt(e.balance) : "—"}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="Add Bank Transaction">
        <form onSubmit={e => { e.preventDefault(); createMutation.mutate(form); }} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <FormRow label="Bank Name" required><input className={inputCls} value={form.bankName} onChange={e => set("bankName", e.target.value)} required /></FormRow>
            <FormRow label="Account No"><input className={inputCls} value={form.accountNo} onChange={e => set("accountNo", e.target.value)} /></FormRow>
          </div>
          <FormRow label="Description" required><input className={inputCls} value={form.description} onChange={e => set("description", e.target.value)} required /></FormRow>
          <div className="grid grid-cols-3 gap-3">
            <FormRow label="Type" required>
              <select className={inputCls} value={form.txType} onChange={e => set("txType", e.target.value)}>
                <option value="CREDIT">Credit (IN)</option>
                <option value="DEBIT">Debit (OUT)</option>
              </select>
            </FormRow>
            <FormRow label="Amount ₹" required><input type="number" className={inputCls} value={form.amount} onChange={e => set("amount", e.target.value)} required /></FormRow>
            <FormRow label="Date" required><input type="date" className={inputCls} value={form.date} onChange={e => set("date", e.target.value)} required /></FormRow>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormRow label="Reference No"><input className={inputCls} value={form.referenceNo} onChange={e => set("referenceNo", e.target.value)} /></FormRow>
            <FormRow label="Closing Balance ₹"><input type="number" className={inputCls} value={form.balance} onChange={e => set("balance", e.target.value)} /></FormRow>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setOpen(false)} className="flex-1 py-2.5 text-sm border border-slate-200 rounded-lg">Cancel</button>
            <button type="submit" disabled={createMutation.isPending} className="flex-1 py-2.5 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium disabled:opacity-60">
              {createMutation.isPending ? "Saving..." : "Add Transaction"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// ─── Cash Book ────────────────────────────────────────────────────────────────
function CashTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ txType: "PAYMENT", amount: "", description: "", category: "General", date: "", notes: "" });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const { data, isLoading } = useQuery({
    queryKey: ["cash-transactions"],
    queryFn: async () => { const { data } = await api.get("/accounting/cash?limit=100"); return data; },
  });

  const createMutation = useMutation({
    mutationFn: (d: any) => api.post("/accounting/cash", d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cash-transactions"] }); qc.invalidateQueries({ queryKey: ["accounting-summary"] }); setOpen(false); },
  });

  const entries = data?.entries || [];
  const totalReceipt = entries.filter((e: any) => e.txType === "RECEIPT").reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
  const totalPayment = entries.filter((e: any) => e.txType === "PAYMENT").reduce((s: number, e: any) => s + Number(e.amount || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-4 text-sm">
          <span className="text-green-700 font-medium">Receipts: <strong>{fmt(totalReceipt)}</strong></span>
          <span className="text-red-700 font-medium">Payments: <strong>{fmt(totalPayment)}</strong></span>
          <span className="text-indigo-700 font-semibold">Cash Balance: <strong>{fmt(totalReceipt - totalPayment)}</strong></span>
        </div>
        <button onClick={() => setOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg">
          <Plus className="w-4 h-4" /> Add Cash Entry
        </button>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="min-w-full divide-y divide-slate-100">
          <thead className="bg-slate-50">
            <tr>{["Date","Description","Category","Type","Amount"].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {isLoading ? <tr><td colSpan={5} className="py-10 text-center text-slate-400">Loading...</td></tr>
              : entries.length === 0 ? <tr><td colSpan={5} className="py-10 text-center text-slate-400">No cash transactions yet</td></tr>
              : entries.map((e: any) => (
                <tr key={e.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-xs text-slate-500">{fmtDate(e.date)}</td>
                  <td className="px-4 py-3 text-sm text-slate-900">{e.description}</td>
                  <td className="px-4 py-3"><span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{e.category}</span></td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${e.txType === "RECEIPT" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{e.txType}</span>
                  </td>
                  <td className={`px-4 py-3 text-sm font-bold ${e.txType === "RECEIPT" ? "text-green-700" : "text-red-700"}`}>{fmt(e.amount)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="Add Cash Entry">
        <form onSubmit={e => { e.preventDefault(); createMutation.mutate(form); }} className="p-5 space-y-4">
          <FormRow label="Description" required><input className={inputCls} value={form.description} onChange={e => set("description", e.target.value)} required /></FormRow>
          <div className="grid grid-cols-3 gap-3">
            <FormRow label="Type">
              <select className={inputCls} value={form.txType} onChange={e => set("txType", e.target.value)}>
                <option value="RECEIPT">Receipt (IN)</option>
                <option value="PAYMENT">Payment (OUT)</option>
              </select>
            </FormRow>
            <FormRow label="Amount ₹" required><input type="number" className={inputCls} value={form.amount} onChange={e => set("amount", e.target.value)} required /></FormRow>
            <FormRow label="Date" required><input type="date" className={inputCls} value={form.date} onChange={e => set("date", e.target.value)} required /></FormRow>
          </div>
          <FormRow label="Category"><select className={inputCls} value={form.category} onChange={e => set("category", e.target.value)}>{["General","Office","Travel","Meals","Petty Cash"].map(c => <option key={c}>{c}</option>)}</select></FormRow>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setOpen(false)} className="flex-1 py-2.5 text-sm border border-slate-200 rounded-lg">Cancel</button>
            <button type="submit" disabled={createMutation.isPending} className="flex-1 py-2.5 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium disabled:opacity-60">
              {createMutation.isPending ? "Saving..." : "Add Entry"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// ─── Salary Register ──────────────────────────────────────────────────────────
function SalaryTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1);
  const [filterYear, setFilterYear] = useState(CURRENT_YEAR);
  const [form, setForm] = useState({ employeeId: "", employeeName: "", month: new Date().getMonth() + 1, year: CURRENT_YEAR, basicSalary: "", allowances: "0", deductions: "0", paidAt: "", paymentMode: "Bank Transfer", notes: "" });
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const { data: usersData } = useUsers({ limit: 100 });
  const allUsers = usersData?.users || [];

  const { data, isLoading } = useQuery({
    queryKey: ["salaries", filterMonth, filterYear],
    queryFn: async () => { const { data } = await api.get(`/accounting/salaries?month=${filterMonth}&year=${filterYear}&limit=100`); return data; },
  });

  const createMutation = useMutation({
    mutationFn: (d: any) => api.post("/accounting/salaries", d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["salaries"] }); qc.invalidateQueries({ queryKey: ["accounting-summary"] }); setOpen(false); },
  });

  const entries = data?.entries || [];
  const totalNet = entries.reduce((s: number, e: any) => s + Number(e.netPay || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <select className="py-2 px-3 border border-slate-200 rounded-lg text-sm" value={filterMonth} onChange={e => setFilterMonth(Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
          <select className="py-2 px-3 border border-slate-200 rounded-lg text-sm" value={filterYear} onChange={e => setFilterYear(Number(e.target.value))}>
            {[CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2].map(y => <option key={y}>{y}</option>)}
          </select>
          <span className="text-sm font-medium text-slate-600">Total Payroll: <strong className="text-slate-900">{fmt(totalNet)}</strong></span>
        </div>
        <button onClick={() => setOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-lg">
          <Plus className="w-4 h-4" /> Add Salary Entry
        </button>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="min-w-full divide-y divide-slate-100">
          <thead className="bg-slate-50">
            <tr>{["Employee","Month/Year","Basic","Allowances","Deductions","Net Pay","Status","Paid On"].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {isLoading ? <tr><td colSpan={8} className="py-10 text-center text-slate-400">Loading...</td></tr>
              : entries.length === 0 ? <tr><td colSpan={8} className="py-10 text-center text-slate-400">No salary entries for this period</td></tr>
              : entries.map((e: any) => (
                <tr key={e.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-slate-900">{e.employee?.firstName} {e.employee?.lastName}</div>
                    <div className="text-xs text-slate-400">{e.employee?.email}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">{MONTHS[e.month - 1]} {e.year}</td>
                  <td className="px-4 py-3 text-sm text-slate-900">{fmt(e.basicSalary)}</td>
                  <td className="px-4 py-3 text-sm text-green-700">+{fmt(e.allowances)}</td>
                  <td className="px-4 py-3 text-sm text-red-700">-{fmt(e.deductions)}</td>
                  <td className="px-4 py-3 text-sm font-bold text-slate-900">{fmt(e.netPay)}</td>
                  <td className="px-4 py-3"><span className={`text-xs font-bold px-2 py-0.5 rounded-full ${e.paidAt ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>{e.paidAt ? "Paid" : "Pending"}</span></td>
                  <td className="px-4 py-3 text-xs text-slate-500">{fmtDate(e.paidAt)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="Add Salary Entry">
        <form onSubmit={e => { e.preventDefault(); createMutation.mutate(form); }} className="p-5 space-y-4">
          <FormRow label="Employee" required>
            <select className={inputCls} value={form.employeeId} onChange={e => {
              const u = allUsers.find((u: any) => u.id === e.target.value);
              set("employeeId", e.target.value);
              if (u) set("employeeName", `${u.firstName} ${u.lastName}`);
            }} required>
              <option value="">Select employee...</option>
              {allUsers.map((u: any) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
            </select>
          </FormRow>
          <div className="grid grid-cols-2 gap-3">
            <FormRow label="Month">
              <select className={inputCls} value={form.month} onChange={e => set("month", Number(e.target.value))}>
                {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
            </FormRow>
            <FormRow label="Year"><input type="number" className={inputCls} value={form.year} onChange={e => set("year", Number(e.target.value))} /></FormRow>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <FormRow label="Basic ₹" required><input type="number" className={inputCls} value={form.basicSalary} onChange={e => set("basicSalary", e.target.value)} required /></FormRow>
            <FormRow label="Allowances ₹"><input type="number" className={inputCls} value={form.allowances} onChange={e => set("allowances", e.target.value)} /></FormRow>
            <FormRow label="Deductions ₹"><input type="number" className={inputCls} value={form.deductions} onChange={e => set("deductions", e.target.value)} /></FormRow>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormRow label="Payment Mode"><select className={inputCls} value={form.paymentMode} onChange={e => set("paymentMode", e.target.value)}>{["Bank Transfer","Cash","Cheque","UPI"].map(c => <option key={c}>{c}</option>)}</select></FormRow>
            <FormRow label="Paid On"><input type="date" className={inputCls} value={form.paidAt} onChange={e => set("paidAt", e.target.value)} /></FormRow>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setOpen(false)} className="flex-1 py-2.5 text-sm border border-slate-200 rounded-lg">Cancel</button>
            <button type="submit" disabled={createMutation.isPending} className="flex-1 py-2.5 text-sm bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium disabled:opacity-60">
              {createMutation.isPending ? "Saving..." : "Add Entry"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
const TABS: Array<{ id: Tab; label: string; icon: any; color: string }> = [
  { id: "overview",  label: "Overview",          icon: BarChart3, color: "bg-indigo-600"  },
  { id: "purchases", label: "Purchase Register",  icon: FileText,  color: "bg-blue-600"   },
  { id: "expenses",  label: "Expense Register",   icon: Receipt,   color: "bg-orange-600" },
  { id: "bank",      label: "Bank Book",          icon: Building2, color: "bg-indigo-600" },
  { id: "cash",      label: "Cash Book",          icon: Banknote,  color: "bg-emerald-600"},
  { id: "salaries",  label: "Salary Register",    icon: Users,     color: "bg-violet-600" },
];

export default function AccountingPage() {
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  // Support URL param tab switching (from dashboard quick actions)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab") as Tab | null;
    if (tab && TABS.find(t => t.id === tab)) setActiveTab(tab);
  }, []);

  return (
    <PageShell>
      <PageHeader icon={BookOpen} title="Accounting" subtitle="Purchases, expenses, bank, cash and salaries in one ledger." />
      <UiTabs tabs={TABS.map(t => ({ key: t.id, label: t.label, icon: t.icon }))} value={activeTab} onChange={setActiveTab} />
      <div>
        {activeTab === "overview"  && <OverviewTab />}
        {activeTab === "purchases" && <PurchaseTab />}
        {activeTab === "expenses"  && <ExpenseTab />}
        {activeTab === "bank"      && <BankTab />}
        {activeTab === "cash"      && <CashTab />}
        {activeTab === "salaries"  && <SalaryTab />}
      </div>
    </PageShell>
  );
}
