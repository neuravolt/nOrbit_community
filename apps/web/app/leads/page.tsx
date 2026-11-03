"use client";

import { useState, useEffect } from "react";
import { 
  useLeads, 
  useLeadMetrics, 
  useCreate, 
  useUpdate, 
  useDelete, 
  useConvertLead, 
  useLeadApiKey, 
  useRegenerateLeadApiKey 
} from "../../src/hooks/queries";
import { 
  Search, Plus, Loader2, Webhook, Copy, Check, 
  RefreshCw, Globe, Eye, EyeOff, Phone, Mail, MessageSquare, UserCheck, 
  Trash2, Building2, ExternalLink, ArrowRight, Clock,
  FileText, Receipt, CheckCircle, ChevronDown
} from "lucide-react";
import { Modal, FormField, inputCls, selectCls, textareaCls } from "../components/Modal";
import Link from "next/link";
import { PageShell, PageHeader, Button, SearchInput, selectClass, th, dayBuckets } from "../../src/components/ui/page";
import { KpiCard, ChartCard, StackedBars, BarList, compact } from "../../src/components/ui/charts";
import { TrendingUp, Users as UsersIcon, Percent, IndianRupee } from "lucide-react";

const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", 
  "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", 
  "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", 
  "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", 
  "Uttar Pradesh", "Uttarakhand", "West Bengal", "Delhi", "Chandigarh", 
  "Jammu and Kashmir", "Ladakh", "Puducherry"
];

const INDUSTRIES = [
  "Real Estate & Construction", "Technology & IT", "Manufacturing", 
  "Retail & E-Commerce", "Healthcare & Pharma", "Finance & Banking", 
  "Education & EdTech", "Logistics & Supply Chain", "Media & Entertainment", "Other"
];

function parseLeadNotes(notes?: string) {
  if (!notes) return { service: null, domain: null, cleanNotes: "" };
  let service: string | null = null;
  let domain: string | null = null;
  
  const serviceMatch = notes.match(/\[Service:\s*([^\]]+)\]/i);
  if (serviceMatch) service = serviceMatch[1].trim();

  const domainMatch = notes.match(/\[Source Domain:\s*([^\]]+)\]/i);
  if (domainMatch) domain = domainMatch[1].trim();

  let cleanNotes = notes
    .replace(/\[Service:\s*[^\]]+\]\s*/gi, "")
    .replace(/\[Source Domain:\s*[^\]]+\]\s*/gi, "")
    .trim();

  return { service, domain, cleanNotes };
}

export default function LeadsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [source, setSource] = useState("");
  
  // Add Lead Modal state
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", company: "", source: "", service: "", estimatedValue: "", notes: "" });
  const [err, setErr] = useState("");

  // Lead Details Modal state
  const [selectedLead, setSelectedLead] = useState<any | null>(null);

  // Convert Lead Modal state
  const [convertModalLead, setConvertModalLead] = useState<any | null>(null);
  const [convertForm, setConvertForm] = useState({
    clientName: "",
    contactName: "",
    address: "",
    gstNumber: "",
    state: "",
    industry: "Real Estate & Construction",
    email: "",
    phone: "",
    website: "",
    contactRole: "Owner",
    notes: "",
  });
  const [convertedSuccessClient, setConvertedSuccessClient] = useState<any | null>(null);

  // Webhook / API Key Modal state
  const [apiModalOpen, setApiModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"elementor" | "cf7" | "js" | "curl">("elementor");
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [originUrl, setOriginUrl] = useState("https://api.neuravolt.in");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const hostname = window.location.hostname;
      if (hostname === "localhost" || hostname === "127.0.0.1") {
        setOriginUrl(`http://${hostname}:3001`);
      } else {
        setOriginUrl("https://api.neuravolt.in");
      }
    }
  }, []);

  const { data, isLoading, isError } = useLeads({ search: search || undefined, status: status || undefined, source: source || undefined });
  const { data: metrics } = useLeadMetrics();
  const { data: apiKeyData } = useLeadApiKey();
  const regenerateKeyMutation = useRegenerateLeadApiKey();
  const createMutation = useCreate("leads", "leads");
  const updateMutation = useUpdate("leads", "leads");
  const deleteMutation = useDelete("leads", "leads");
  const convertMutation = useConvertLead();

  const leads = data?.leads || [];

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  const setConvert = (k: string, v: string) => setConvertForm(f => ({ ...f, [k]: v }));

  const currentKey = apiKeyData?.apiKey || "nv_lead_live_f8b7e8994670d1513feeb751a09fe2fc";
  const captureEndpoint = `${originUrl}/leads/capture`;

  const copyToClipboard = (text: string, type: "key" | "url") => {
    navigator.clipboard.writeText(text);
    if (type === "key") {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    } else {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    }
  };

  const handleRegenerate = async () => {
    if (window.confirm("Are you sure you want to regenerate your API Key? Any existing websites using the old key will need to be updated.")) {
      await regenerateKeyMutation.mutateAsync();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setErr("Name is required."); return; }
    setErr("");
    try {
      await createMutation.mutateAsync({
        name: form.name.trim(),
        email: form.email || undefined,
        phone: form.phone || undefined,
        company: form.company || undefined,
        source: form.source || undefined,
        service: form.service || undefined,
        estimatedValue: form.estimatedValue ? Number(form.estimatedValue) : undefined,
        notes: form.notes || undefined,
      });
      setOpen(false);
      setForm({ name: "", email: "", phone: "", company: "", source: "", service: "", estimatedValue: "", notes: "" });
    } catch (e: any) {
      setErr(e.response?.data?.message || "Failed to create lead.");
    }
  };

  const handleStatusChange = async (leadId: string, newStatus: string, e?: React.MouseEvent | React.ChangeEvent<any>) => {
    if (e && 'stopPropagation' in e) e.stopPropagation();
    try {
      await updateMutation.mutateAsync({ id: leadId, status: newStatus });
      if (selectedLead && selectedLead.id === leadId) {
        setSelectedLead((prev: any) => ({ ...prev, status: newStatus }));
      }
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to update lead status.");
    }
  };

  const handleDeleteLead = async (leadId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this lead?")) {
      try {
        await deleteMutation.mutateAsync(leadId);
        if (selectedLead && selectedLead.id === leadId) {
          setSelectedLead(null);
        }
      } catch (err: any) {
        alert(err.response?.data?.message || "Failed to delete lead.");
      }
    }
  };

  const openConvertModal = (lead: any) => {
    const { domain, service, cleanNotes } = parseLeadNotes(lead.notes);
    setConvertModalLead(lead);
    setConvertForm({
      clientName: lead.company || lead.name || "",
      contactName: lead.name || "",
      address: "",
      gstNumber: "",
      state: "",
      industry: "Real Estate & Construction",
      email: lead.email || "",
      phone: lead.phone || "",
      website: domain ? (domain.startsWith("http") ? domain : `https://${domain}`) : "",
      contactRole: "Owner",
      notes: service ? `Requirement: ${service}\n${cleanNotes}` : (cleanNotes || ""),
    });
  };

  const handleConvertLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!convertModalLead) return;
    if (!convertForm.clientName.trim()) {
      alert("Client / Business Name is required.");
      return;
    }
    try {
      const createdClient = await convertMutation.mutateAsync({
        id: convertModalLead.id,
        data: convertForm,
      });
      setConvertedSuccessClient(createdClient);
      setConvertModalLead(null);
      if (selectedLead && selectedLead.id === convertModalLead.id) {
        setSelectedLead((prev: any) => ({ ...prev, status: "converted", convertedToClientId: createdClient?.id || "converted" }));
      }
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to convert lead to client.");
    }
  };

  const STATUS_DOT: Record<string, string> = { 
    new: "bg-blue-500", 
    contacted: "bg-purple-500", 
    qualified: "bg-amber-500", 
    converted: "bg-emerald-500", 
    lost: "bg-slate-400" 
  };

  const STAGES = ["new", "contacted", "qualified", "converted", "lost"];
  const STAGE_COLOR: Record<string, string> = { new: "#3b82f6", contacted: "#8b5cf6", qualified: "#f59e0b", converted: "#10b981", lost: "#94a3b8" };
  const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);
  const openLeads = leads.filter((l: any) => !["converted", "lost"].includes(l.status));
  const pipelineValue = openLeads.reduce((sum: number, l: any) => sum + Number(l.estimatedValue || 0), 0);
  const leadTrend = dayBuckets(leads, (l: any) => new Date(l.createdAt).getTime()).map((b) => ({
    label: b.label,
    values: { open: b.items.filter((l: any) => l.status !== "converted").length, won: b.items.filter((l: any) => l.status === "converted").length },
  }));
  const bySource = Object.entries(leads.reduce((acc: Record<string, number>, l: any) => { const k = l.source || "Not set"; acc[k] = (acc[k] ?? 0) + 1; return acc; }, {}))
    .sort((x: any, y: any) => y[1] - x[1]).slice(0, 6).map(([k, v]) => ({ label: k, value: v as number }));

  return (
    <PageShell>
    <div className="max-w-7xl mx-auto space-y-5 text-slate-900">
      <PageHeader
        icon={TrendingUp}
        title="Leads"
        subtitle="Track and convert inbound opportunities into clients."
        actions={<>
          <Button onClick={() => setApiModalOpen(true)}><Webhook className="w-4 h-4 text-slate-500" /> Website form webhook</Button>
          <Button variant="primary" onClick={() => { setOpen(true); setErr(""); }}><Plus className="w-4 h-4" /> Add lead</Button>
        </>}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <KpiCard tone="info" icon={UsersIcon} value={metrics?.totalLeads ?? "—"} label="Total leads" series={leadTrend.map((b) => b.values.open + b.values.won)} />
        <KpiCard tone="ok" icon={UserCheck} value={metrics?.convertedLeads ?? "—"} label="Converted to clients" active={status === "converted"} onClick={() => setStatus(status === "converted" ? "" : "converted")} />
        <KpiCard tone="violet" icon={Percent} value={metrics ? `${Number(metrics.conversionRate ?? 0).toFixed(1)}%` : "—"} label="Conversion rate" />
        <KpiCard tone="warning" icon={IndianRupee} value={pipelineValue > 0 ? `₹${compact(pipelineValue)}` : "—"} label="Open pipeline value" delta={{ text: `${openLeads.length} open lead${openLeads.length === 1 ? "" : "s"}` }} />
      </div>

      {leads.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <ChartCard title="New leads (14 days)">
            <StackedBars buckets={leadTrend} labelEvery={3} format={(n) => String(Math.round(n))} series={[{ key: "open", label: "Leads", color: "#3b82f6" }, { key: "won", label: "Converted", color: "#10b981" }]} />
          </ChartCard>
          <ChartCard title="Pipeline by stage">
            <BarList items={STAGES.map((st) => ({ label: cap(st), value: leads.filter((l: any) => l.status === st).length, color: STAGE_COLOR[st] }))} />
          </ChartCard>
          <ChartCard title="Where leads come from">
            <BarList items={bySource} />
          </ChartCard>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 bg-white p-3 rounded-2xl border border-slate-200">
        <SearchInput className="flex-1 min-w-48" placeholder="Search leads..." value={search} onChange={setSearch} />
        <select className={selectClass} value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">All stages</option>
          {STAGES.map(st => <option key={st} value={st}>{cap(st)}</option>)}
        </select>
        <select className={selectClass} value={source} onChange={e => setSource(e.target.value)}>
          <option value="">All sources</option>
          {["Website","Referral","LinkedIn","Cold Outreach","Other"].map(x => <option key={x} value={x}>{x}</option>)}
        </select>
      </div>

      {/* Clean Linear-Style Leads Table */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 text-slate-400 animate-spin" /></div>
      ) : isError ? (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-xs">Failed to load leads.</div>
      ) : leads.length === 0 ? (
        <div className="text-center py-16 text-slate-500 bg-white border border-slate-200 rounded-xl space-y-2">
          <p className="font-semibold text-slate-700 text-sm">No leads in pipeline</p>
          <p className="text-xs text-slate-400">Incoming inquiries will automatically populate here.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-left">
              <thead>
                <tr>
                  <th className={th}>Prospect</th>
                  <th className={th}>Inquiry / Service</th>
                  <th className={th}>Stage</th>
                  <th className={th}>Est. Value</th>
                  <th className={th}>Date</th>
                  <th className={`${th} text-right`}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {leads.map((lead: any) => {
                  const { service, domain } = parseLeadNotes(lead.notes);
                  const cleanPhone = lead.phone ? lead.phone.replace(/[^0-9+]/g, '') : null;
                  const dotColor = STATUS_DOT[lead.status] || STATUS_DOT.new;

                  return (
                    <tr 
                      key={lead.id} 
                      onClick={() => setSelectedLead(lead)}
                      className="hover:bg-slate-50/70 cursor-pointer transition-colors group"
                    >
                      {/* Prospect Info */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-semibold text-xs flex items-center justify-center shrink-0 uppercase">
                            {lead.name ? lead.name.charAt(0) : "L"}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors flex items-center gap-1.5">
                              {lead.name}
                              {lead.convertedToClientId && (
                                <span className="text-[10px] font-medium text-emerald-600">✓</span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5">
                              <span>{lead.email || lead.phone || "No contact"}</span>
                              {lead.company && <span className="text-slate-400">• {lead.company}</span>}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Inquiry / Service */}
                      <td className="px-5 py-3.5">
                        <div className="font-medium text-slate-800 text-xs truncate max-w-xs">
                          {service || "General Inquiry"}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {domain || lead.source || "Website"}
                        </div>
                      </td>

                      {/* Minimalist Status Dropdown */}
                      <td className="px-5 py-3.5" onClick={e => e.stopPropagation()}>
                        <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-slate-100 transition-colors">
                          <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                          <select
                            value={lead.status}
                            onChange={(e) => handleStatusChange(lead.id, e.target.value, e)}
                            className="bg-transparent border-0 text-xs font-medium text-slate-700 cursor-pointer focus:outline-none p-0 pr-1 capitalize"
                          >
                            <option value="new">New</option>
                            <option value="contacted">Contacted</option>
                            <option value="qualified">Qualified</option>
                            <option value="converted">Converted</option>
                            <option value="lost">Lost</option>
                          </select>
                        </div>
                      </td>

                      {/* Estimated Value */}
                      <td className="px-5 py-3.5 text-xs text-slate-700 font-medium">
                        {lead.estimatedValue ? `₹${lead.estimatedValue.toLocaleString()}` : <span className="text-slate-400">—</span>}
                      </td>

                      {/* Received Date */}
                      <td className="px-5 py-3.5 text-xs text-slate-400 whitespace-nowrap">
                        {new Date(lead.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Quick Reachout on hover / focus */}
                          {lead.phone && (
                            <a 
                              href={`https://wa.me/${cleanPhone?.replace('+', '')}`} 
                              target="_blank" 
                              rel="noreferrer"
                              title={`WhatsApp ${lead.phone}`}
                              className="p-1.5 text-slate-400 hover:text-emerald-600 rounded transition-colors"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                            </a>
                          )}
                          {lead.email && (
                            <a 
                              href={`mailto:${lead.email}`} 
                              title={`Email ${lead.email}`}
                              className="p-1.5 text-slate-400 hover:text-slate-700 rounded transition-colors"
                            >
                              <Mail className="w-3.5 h-3.5" />
                            </a>
                          )}

                          {/* Convert to Client Button */}
                          {!lead.convertedToClientId ? (
                            <button
                              onClick={() => openConvertModal(lead)}
                              className="px-2.5 py-1 text-xs font-medium text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 rounded-md transition-colors"
                            >
                              Convert
                            </button>
                          ) : (
                            <Link
                              href="/clients"
                              className="text-xs text-emerald-600 hover:text-emerald-700 font-medium inline-flex items-center gap-1 px-2 py-1"
                            >
                              Client <ExternalLink className="w-3 h-3" />
                            </Link>
                          )}

                          {/* Delete Lead */}
                          <button
                            onClick={(e) => handleDeleteLead(lead.id, e)}
                            className="p-1.5 text-slate-300 hover:text-rose-600 rounded transition-colors opacity-0 group-hover:opacity-100"
                            title="Delete Lead"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. LEAD DETAILS DRAWER / MODAL */}
      {/* ========================================================================= */}
      {selectedLead && (
        <Modal 
          isOpen={!!selectedLead} 
          onClose={() => setSelectedLead(null)} 
          title="Lead Overview" 
          subtitle="Prospect inquiry and contact information."
        >
          {(() => {
            const { service, domain, cleanNotes } = parseLeadNotes(selectedLead.notes);
            const cleanPhone = selectedLead.phone ? selectedLead.phone.replace(/[^0-9+]/g, '') : null;

            return (
              <div className="p-6 space-y-5 text-xs text-slate-700">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">{selectedLead.name}</h3>
                    <p className="text-slate-400 mt-0.5">Received {new Date(selectedLead.createdAt).toLocaleString("en-IN")}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">Stage:</span>
                    <select
                      value={selectedLead.status}
                      onChange={(e) => handleStatusChange(selectedLead.id, e.target.value)}
                      className="border border-slate-200 rounded-md px-2 py-1 text-xs capitalize bg-white font-medium"
                    >
                      <option value="new">New</option>
                      <option value="contacted">Contacted</option>
                      <option value="qualified">Qualified</option>
                      <option value="converted">Converted</option>
                      <option value="lost">Lost</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-slate-400 block font-medium">Email</span>
                    <span className="font-semibold text-slate-900">{selectedLead.email || "—"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Phone</span>
                    <span className="font-semibold text-slate-900">{selectedLead.phone || "—"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Company</span>
                    <span className="font-semibold text-slate-900">{selectedLead.company || "—"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Source / Website</span>
                    <span className="font-semibold text-slate-900">{domain || selectedLead.source || "Website"}</span>
                  </div>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-100 space-y-1">
                  <span className="text-slate-400 block font-medium uppercase text-[10px]">Service Requested</span>
                  <span className="font-bold text-slate-900 text-sm">{service || "General Inquiry"}</span>
                </div>

                {cleanNotes && (
                  <div>
                    <span className="text-slate-400 block font-medium mb-1 uppercase text-[10px]">Inquiry Notes</span>
                    <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg text-slate-800 whitespace-pre-wrap leading-relaxed">
                      {cleanNotes}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                  <button
                    onClick={() => handleDeleteLead(selectedLead.id)}
                    className="text-xs text-rose-600 hover:text-rose-700 font-medium"
                  >
                    Delete Lead
                  </button>
                  <div className="flex items-center gap-2">
                    {!selectedLead.convertedToClientId && (
                      <button
                        onClick={() => {
                          const l = selectedLead;
                          setSelectedLead(null);
                          openConvertModal(l);
                        }}
                        className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold"
                      >
                        Convert to Client
                      </button>
                    )}
                    <button
                      onClick={() => setSelectedLead(null)}
                      className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* 2. CONVERT TO CLIENT MODAL (EXACT SAME FIELDS AS /clients WITH OVERRIDE) */}
      {/* ========================================================================= */}
      {convertModalLead && (
        <Modal
          isOpen={!!convertModalLead}
          onClose={() => setConvertModalLead(null)}
          title="Convert Lead to Client"
          subtitle="Auto-filled from lead inquiry. Edit or fill missing billing details."
          maxWidth="max-w-xl"
        >
          <form onSubmit={handleConvertLead} className="p-6 space-y-4 text-xs">
            {/* Company Info */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Company Information</h3>
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Company / Client Name *</label>
                <input
                  className={inputCls}
                  value={convertForm.clientName}
                  onChange={(e) => setConvert("clientName", e.target.value)}
                  placeholder="e.g. Acme Corporation"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Email</label>
                  <input
                    type="email"
                    className={inputCls}
                    value={convertForm.email}
                    onChange={(e) => setConvert("email", e.target.value)}
                    placeholder="billing@company.com"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Phone</label>
                  <input
                    className={inputCls}
                    value={convertForm.phone}
                    onChange={(e) => setConvert("phone", e.target.value)}
                    placeholder="+91 98765 43210"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-600 mb-1">Billing Address</label>
                <input
                  className={inputCls}
                  value={convertForm.address}
                  onChange={(e) => setConvert("address", e.target.value)}
                  placeholder="123 Business Ave, City, Pincode"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">State (GST)</label>
                  <select
                    className={selectCls}
                    value={convertForm.state}
                    onChange={(e) => setConvert("state", e.target.value)}
                  >
                    <option value="">Select State</option>
                    {INDIAN_STATES.map((st) => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">GST Number</label>
                  <input
                    className={`${inputCls} uppercase font-mono`}
                    value={convertForm.gstNumber}
                    onChange={(e) => setConvert("gstNumber", e.target.value.toUpperCase())}
                    placeholder="22AAAAA0000A1Z5"
                    maxLength={15}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Website</label>
                  <input
                    type="url"
                    className={inputCls}
                    value={convertForm.website}
                    onChange={(e) => setConvert("website", e.target.value)}
                    placeholder="https://company.com"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Industry</label>
                  <select
                    className={selectCls}
                    value={convertForm.industry}
                    onChange={(e) => setConvert("industry", e.target.value)}
                  >
                    {INDUSTRIES.map((ind) => (
                      <option key={ind} value={ind}>{ind}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Primary Contact */}
            <div className="space-y-3 pt-3 border-t border-slate-100">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Primary Contact Person</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Contact Name *</label>
                  <input
                    className={inputCls}
                    value={convertForm.contactName}
                    onChange={(e) => setConvert("contactName", e.target.value)}
                    placeholder="Contact person name"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Role / Designation</label>
                  <select
                    className={selectCls}
                    value={convertForm.contactRole}
                    onChange={(e) => setConvert("contactRole", e.target.value)}
                  >
                    <option value="Owner">Owner / Proprietor</option>
                    <option value="Director">Director / Partner</option>
                    <option value="Purchase Head">Purchase Head / Manager</option>
                    <option value="Billing Contact">Billing Contact</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="pt-2">
              <label className="block font-semibold text-slate-600 mb-1">Notes</label>
              <textarea
                rows={2}
                className={`${textareaCls} resize-none`}
                value={convertForm.notes}
                onChange={(e) => setConvert("notes", e.target.value)}
                placeholder="Any client notes or requirements..."
              />
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConvertModalLead(null)}
                className="px-3.5 py-1.5 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={convertMutation.isPending}
                className="inline-flex items-center px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
              >
                {convertMutation.isPending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                Save as Client
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* 3. POST-CONVERSION PROMPT */}
      {/* ========================================================================= */}
      {convertedSuccessClient && (
        <Modal
          isOpen={!!convertedSuccessClient}
          onClose={() => setConvertedSuccessClient(null)}
          title="Client Created"
          subtitle="Lead has been promoted to an active Client."
        >
          <div className="p-6 space-y-4 text-center text-xs">
            <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">{convertedSuccessClient.name}</h4>
              <p className="text-slate-400 mt-0.5">{convertedSuccessClient.email || convertedSuccessClient.phone}</p>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <Link
                href="/sales/builder"
                className="flex items-center justify-center gap-1.5 p-2.5 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-lg transition-colors"
              >
                <FileText className="w-3.5 h-3.5" />
                Create Quote
              </Link>
              <Link
                href="/billing"
                className="flex items-center justify-center gap-1.5 p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium rounded-lg transition-colors"
              >
                <Receipt className="w-3.5 h-3.5" />
                Invoices
              </Link>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setConvertedSuccessClient(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                Done
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* 4. MANUAL ADD LEAD MODAL */}
      {/* ========================================================================= */}
      <Modal isOpen={open} onClose={() => setOpen(false)} title="Add New Lead" subtitle="Capture a new prospect manually into your pipeline.">
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {err && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-xs">{err}</div>}
          <FormField label="Full Name" required><input className={inputCls} placeholder="e.g. Rahul Sharma" value={form.name} onChange={e => set("name", e.target.value)} /></FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Email"><input type="email" className={inputCls} placeholder="rahul@company.com" value={form.email} onChange={e => set("email", e.target.value)} /></FormField>
            <FormField label="Phone"><input className={inputCls} placeholder="+91 98765 43210" value={form.phone} onChange={e => set("phone", e.target.value)} /></FormField>
          </div>
          <FormField label="Company"><input className={inputCls} placeholder="EcoPro Constructions" value={form.company} onChange={e => set("company", e.target.value)} /></FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Source">
              <select className={selectCls} value={form.source} onChange={e => set("source", e.target.value)}>
                <option value="">Select source</option>
                {["Website","Referral","LinkedIn","Cold Outreach","Other"].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </FormField>
            <FormField label="Service Required">
              <input className={inputCls} placeholder="e.g. Commercial Construction" value={form.service} onChange={e => set("service", e.target.value)} />
            </FormField>
          </div>
          <FormField label="Estimated Deal Value (₹)"><input type="number" className={inputCls} placeholder="500000" value={form.estimatedValue} onChange={e => set("estimatedValue", e.target.value)} /></FormField>
          <FormField label="Notes & Requirements"><textarea className={textareaCls} rows={2} placeholder="Customer requirements, project location..." value={form.notes} onChange={e => set("notes", e.target.value)} /></FormField>
          <div className="flex justify-end gap-2.5 pt-2">
            <button type="button" onClick={() => setOpen(false)} className="px-3.5 py-1.5 border border-slate-200 rounded-lg text-xs hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={createMutation.isPending} className="inline-flex items-center px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold disabled:opacity-50">
              {createMutation.isPending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              Save Lead
            </button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* 5. WEBHOOK & API INTEGRATION MODAL */}
      {/* ========================================================================= */}
      <Modal
        isOpen={apiModalOpen}
        onClose={() => setApiModalOpen(false)}
        title="Website Form Webhook & API Key"
        subtitle="Connect external website forms (WordPress, Elementor, CF7, custom HTML/JS) directly into your CRM."
        maxWidth="max-w-3xl"
      >
        <div className="p-6 space-y-6 text-xs">
          {/* Endpoint URL Card */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Ingestion Webhook Endpoint (POST)
            </label>
            <div className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg font-mono text-xs">
              <span className="flex-1 truncate select-all text-indigo-600 font-semibold">{captureEndpoint}</span>
              <button
                onClick={() => copyToClipboard(captureEndpoint, "url")}
                className="px-3 py-1 text-xs bg-white border border-slate-200 hover:bg-slate-100 rounded-md font-sans text-slate-700 font-medium flex items-center gap-1 shrink-0"
              >
                {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedUrl ? "Copied" : "Copy URL"}
              </button>
            </div>
          </div>

          {/* API Key Card */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                API Secret Key (`x-api-key`)
              </label>
              <button
                onClick={handleRegenerate}
                disabled={regenerateKeyMutation.isPending}
                className="text-xs text-rose-600 hover:text-rose-700 font-medium flex items-center gap-1"
              >
                <RefreshCw className={`w-3 h-3 ${regenerateKeyMutation.isPending ? "animate-spin" : ""}`} />
                Regenerate Key
              </button>
            </div>
            <div className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg font-mono text-xs">
              <span className="flex-1 truncate select-all text-slate-800">
                {showKey ? currentKey : "•".repeat(32) + currentKey.slice(-6)}
              </span>
              <button
                onClick={() => setShowKey(!showKey)}
                className="p-1 text-slate-500 hover:text-slate-700 rounded"
                title={showKey ? "Hide key" : "Show key"}
              >
                {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => copyToClipboard(currentKey, "key")}
                className="px-3 py-1 text-xs bg-white border border-slate-200 hover:bg-slate-100 rounded-md font-sans text-slate-700 font-medium flex items-center gap-1 shrink-0"
              >
                {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedKey ? "Copied" : "Copy Key"}
              </button>
            </div>
            <p className="text-slate-400 mt-1.5">
              Pass this key in the <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700 font-mono">x-api-key</code> HTTP header or as <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700 font-mono">?api_key=</code> parameter.
            </p>
          </div>

          {/* Integration Tabs */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Ready-to-use Website Code Snippets
            </label>
            <div className="flex border-b border-slate-200 text-xs font-medium">
              {[
                { id: "elementor", label: "Elementor Form Webhook" },
                { id: "cf7", label: "Contact Form 7 (PHP)" },
                { id: "js", label: "JavaScript / React" },
                { id: "curl", label: "cURL CLI" },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`py-2 px-3 border-b-2 font-medium transition-colors ${
                    activeTab === tab.id
                      ? "border-slate-900 text-slate-900 font-semibold"
                      : "border-transparent text-slate-400 hover:text-slate-700"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="mt-3 p-4 bg-slate-900 rounded-lg text-slate-100 font-mono overflow-x-auto leading-relaxed text-[11px]">
              {activeTab === "elementor" && (
                <div>
                  <p className="text-slate-400 mb-2">// 1. In Elementor: Form Settings -&gt; "Actions After Submit" -&gt; Add "Webhook"</p>
                  <p className="text-slate-400 mb-2">// 2. Paste this URL into "Webhook URL":</p>
                  <p className="text-emerald-400 font-bold select-all mb-3">{`${captureEndpoint}?api_key=${currentKey}`}</p>
                  <p className="text-slate-400">// 3. In Form Fields, set field IDs to: <span className="text-indigo-300 font-bold">name</span>, <span className="text-indigo-300 font-bold">email</span>, <span className="text-indigo-300 font-bold">phone</span>, <span className="text-indigo-300 font-bold">service</span> (Dropdown), <span className="text-indigo-300 font-bold">notes</span></p>
                  <p className="text-slate-400 mt-1">// 4. Under Advanced, add a Hidden field: ID = <span className="text-indigo-300 font-bold">website</span>, Default Value = your domain.</p>
                </div>
              )}

              {activeTab === "cf7" && (
                <pre>{`// Add to your WordPress theme functions.php:
add_action('wpcf7_mail_sent', function ($contact_form) {
    $submission = WPCF7_Submission::get_instance();
    if (!$submission) return;
    $data = $submission->get_posted_data();

    wp_remote_post('${captureEndpoint}', [
        'headers' => [
            'Content-Type' => 'application/json',
            'x-api-key' => '${currentKey}',
        ],
        'body' => json_encode([
            'name'    => $data['your-name'] ?? '',
            'email'   => $data['your-email'] ?? '',
            'phone'   => $data['your-phone'] ?? '',
            'service' => $data['your-service'] ?? '',
            'website' => home_url(),
            'notes'   => $data['your-message'] ?? '',
        ]),
    ]);
});`}</pre>
              )}

              {activeTab === "js" && (
                <pre>{`// JavaScript Fetch Example
await fetch('${captureEndpoint}', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': '${currentKey}',
  },
  body: JSON.stringify({
    name: 'Customer Name',
    email: 'customer@gmail.com',
    phone: '+91 9876543210',
    service: 'Commercial Construction',
    website: window.location.hostname,
    notes: 'Inquiry details from contact form...',
  }),
});`}</pre>
              )}

              {activeTab === "curl" && (
                <pre>{`curl -X POST '${captureEndpoint}' \\
  -H 'Content-Type: application/json' \\
  -H 'x-api-key: ${currentKey}' \\
  -d '{
    "name": "Arun Kumar",
    "email": "arun@ecoprobuilders.in",
    "phone": "+91 9876543210",
    "service": "Commercial Construction",
    "website": "ecoprobuilders.in",
    "notes": "Looking for turnkey warehouse construction"
  }'`}</pre>
              )}
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={() => setApiModalOpen(false)}
              className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </Modal>
    </div>
    </PageShell>
  );
}
