"use client";

import { useState } from "react";
import Link from "next/link";
import { useAssets, useUpcomingRenewals, useAllClients, useUsers, useCreate, useUpdate, useDelete } from "../../src/hooks/queries";
import { Search, Plus, Loader2, AlertTriangle, Globe, Server, Shield, Smartphone, Code, Lock, Pencil, Trash2, Eye, UserCheck, Zap } from "lucide-react";
import { useAuthStore } from "@/src/store/auth";
import { Modal, FormField, inputCls, selectCls, textareaCls } from "../components/Modal";
import { PageShell, PageHeader, Button, SearchInput, selectClass, EmptyBlock } from "../../src/components/ui/page";
import { KpiCard, ChartCard, BarList } from "../../src/components/ui/charts";
import { Boxes, CalendarClock, ServerCog } from "lucide-react";

const ASSET_TYPES = ["DOMAIN","HOSTING","VPS","WEBSITE","ADMIN_PANEL","MOBILE_APP","API_SERVICE","SSL_CERTIFICATE"];
const TYPE_ICONS: Record<string, any> = { DOMAIN: Globe, HOSTING: Server, VPS: Server, WEBSITE: Globe, ADMIN_PANEL: Lock, MOBILE_APP: Smartphone, API_SERVICE: Code, SSL_CERTIFICATE: Shield };
const TYPE_COLORS: Record<string, string> = { DOMAIN: "bg-blue-100 text-blue-700", HOSTING: "bg-violet-100 text-violet-700", VPS: "bg-indigo-100 text-indigo-700", WEBSITE: "bg-cyan-100 text-cyan-700", ADMIN_PANEL: "bg-amber-100 text-amber-700", MOBILE_APP: "bg-green-100 text-green-700", API_SERVICE: "bg-rose-100 text-rose-700", SSL_CERTIFICATE: "bg-emerald-100 text-emerald-700" };

export default function AssetsPage() {
  const user = useAuthStore(s => s.user);
  const isManagement = ["SUPER_ADMIN", "ADMIN", "CO_FOUNDER", "MANAGER", "ACCOUNTANT"].includes(user?.role || "");

  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(100);
  const [open, setOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<any>(null);
  const [form, setForm] = useState({
    name: "", type: "DOMAIN", clientId: "", description: "", renewalDate: "", cost: "", billingCycle: "ANNUALLY", notes: "", assignedUserId: "",
    vpsMode: "MANAGED", serverIp: "", os: "", cpu: "", ram: "", disk: "", bandwidthTB: "", registrar: "", nameservers: "", controlPanelUrl: "", issuer: "", domainsCovered: "", provider: ""
  });
  const [err, setErr] = useState("");

  const { data, isLoading, isError } = useAssets({
    search: search || undefined,
    type: type || undefined,
    page,
    limit,
  });
  const { data: renewals } = useUpcomingRenewals();
  const { data: clients } = useAllClients();
  const { data: usersData } = useUsers();
  
  const create = useCreate("assets", "assets");
  const update = useUpdate("assets", "assets");
  const remove = useDelete("assets", "assets");

  const assets = data?.assets || [];
  const userList = Array.isArray(usersData?.users) ? usersData.users : Array.isArray(usersData) ? usersData : [];
  const renewalCount = Array.isArray(renewals) ? renewals.length : 0;
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleEditClick = (asset: any) => {
    setEditingAsset(asset);
    const meta = asset.metadata || {};
    setForm({
      name: asset.name || "",
      type: asset.type || "DOMAIN",
      clientId: asset.clientId || "",
      description: asset.description || "",
      renewalDate: asset.renewalDate ? new Date(asset.renewalDate).toISOString().split('T')[0] : "",
      cost: asset.cost !== null && asset.cost !== undefined ? String(asset.cost) : "",
      billingCycle: asset.billingCycle || "ANNUALLY",
      notes: asset.notes || "",
      assignedUserId: meta.assignedUserId || "",
      vpsMode: asset.guardianMode === 'BYOVPS' || asset.guardianOwnership === 'CLIENT' ? 'BYOVPS' : (asset.guardianMode || 'MANAGED'),
      serverIp: meta.serverIp || meta.ipAddress || "",
      os: meta.os || "",
      cpu: meta.cpu || "",
      ram: meta.ram || "",
      disk: meta.disk || "",
      registrar: meta.registrar || "",
      nameservers: meta.nameservers ? (Array.isArray(meta.nameservers) ? meta.nameservers.join(', ') : String(meta.nameservers)) : "",
      controlPanelUrl: meta.controlPanelUrl || "",
      issuer: meta.issuer || "",
      domainsCovered: meta.domainsCovered ? (Array.isArray(meta.domainsCovered) ? meta.domainsCovered.join(', ') : String(meta.domainsCovered)) : "",
      provider: meta.provider || "",
      bandwidthTB: meta.bandwidthTB || "",
    });
    setErr("");
    setOpen(true);
  };

  const handleDeleteClick = async (asset: any) => {
    if (!confirm(`Are you sure you want to delete asset "${asset.name}"?`)) return;
    try {
      await remove.mutateAsync(asset.id);
    } catch (e: any) {
      alert(e.response?.data?.message || "Failed to delete asset.");
    }
  };

  const handleAddClick = () => {
    setEditingAsset(null);
    setForm({
      name: "", type: "DOMAIN", clientId: "", description: "", renewalDate: "", cost: "", billingCycle: "ANNUALLY", notes: "", assignedUserId: "",
      vpsMode: "MANAGED", serverIp: "", os: "", cpu: "", ram: "", disk: "", bandwidthTB: "", registrar: "", nameservers: "", controlPanelUrl: "", issuer: "", domainsCovered: "", provider: ""
    });
    setErr("");
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isManagement) return;
    if (!form.name.trim()) { setErr("Asset name is required."); return; }
    if (!form.clientId) { setErr("Please select a client."); return; }
    setErr("");
    try {
      const metadata: Record<string, any> = {};
      if (form.assignedUserId) metadata.assignedUserId = form.assignedUserId;
      
      if (form.type === 'VPS') {
        metadata.serverIp = form.serverIp || undefined;
        metadata.ipAddress = form.serverIp || undefined;
        metadata.os = form.os || undefined;
        metadata.cpu = form.cpu || undefined;
        metadata.ram = form.ram || undefined;
        metadata.disk = form.disk || undefined;
        metadata.bandwidthTB = form.bandwidthTB || undefined;
        metadata.provider = form.provider || undefined;
      } else if (form.type === 'HOSTING') {
        metadata.serverIp = form.serverIp || undefined;
        metadata.disk = form.disk || undefined;
        metadata.ram = form.ram || undefined;
        metadata.bandwidthTB = form.bandwidthTB || undefined;
        metadata.controlPanelUrl = form.controlPanelUrl || undefined;
        metadata.provider = form.provider || undefined;
      } else if (form.type === 'DOMAIN') {
        metadata.registrar = form.registrar || undefined;
        metadata.nameservers = form.nameservers ? form.nameservers.split(',').map(s => s.trim()).filter(Boolean) : undefined;
      } else if (form.type === 'SSL_CERTIFICATE') {
        metadata.issuer = form.issuer || undefined;
        metadata.domainsCovered = form.domainsCovered ? form.domainsCovered.split(',').map(s => s.trim()).filter(Boolean) : undefined;
      }

      const payload = {
        name: form.name.trim(), type: form.type, clientId: form.clientId,
        description: form.description || undefined,
        renewalDate: form.renewalDate || undefined,
        cost: form.cost ? Number(form.cost) : undefined,
        billingCycle: form.billingCycle || undefined,
        notes: form.notes || undefined,
        guardianMode: form.type === 'VPS' && form.vpsMode === 'BYOVPS' ? 'BYOVPS' : 'MANAGED',
        guardianOwnership: form.type === 'VPS' && form.vpsMode === 'BYOVPS' ? 'CLIENT' : 'NEURAVOLT',
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      };

      if (editingAsset) {
        await update.mutateAsync({ id: editingAsset.id, ...payload });
      } else {
        await create.mutateAsync(payload);
      }
      setOpen(false);
      setEditingAsset(null);
    } catch (e: any) {
      const msg = e.response?.data?.message;
      setErr(Array.isArray(msg) ? msg.join(', ') : msg || "Failed to save asset.");
    }
  };

  const TYPE_BAR: Record<string, string> = { DOMAIN: "#3b82f6", HOSTING: "#8b5cf6", VPS: "#6366f1", WEBSITE: "#06b6d4", ADMIN_PANEL: "#f59e0b", MOBILE_APP: "#10b981", API_SERVICE: "#f43f5e", SSL_CERTIFICATE: "#059669" };
  const byType = ASSET_TYPES.map((t) => ({ label: t.replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase()), value: assets.filter((a: any) => a.type === t).length, color: TYPE_BAR[t] })).filter((x) => x.value > 0);
  const servers = assets.filter((a: any) => a.type === "VPS" || a.type === "HOSTING").length;

  return (
    <PageShell>
    <div className="max-w-7xl mx-auto space-y-5">
      <PageHeader
        icon={Boxes}
        title="Digital Assets"
        subtitle={<>Client domains, hosting, VPS, SSL certificates and AMC IT assets. Office equipment lives in <Link href="/hr" className="text-indigo-600 hover:underline font-medium">HR physical assets</Link>.</>}
        actions={isManagement ? <Button variant="primary" onClick={handleAddClick}><Plus className="w-4 h-4" /> Add asset</Button> : undefined}
      />

      {renewalCount > 0 && isManagement && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span className="text-sm font-medium">{renewalCount} asset{renewalCount !== 1 ? 's need' : ' needs'} renewal within 30 days.</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-3 content-start">
          <KpiCard tone="info" icon={Boxes} value={data?.total ?? assets.length} label="Assets" />
          <KpiCard tone="violet" icon={ServerCog} value={servers} label="Servers (VPS and hosting)" active={type === "VPS"} onClick={() => setType(type === "VPS" ? "" : "VPS")} />
          {isManagement && <KpiCard tone={renewalCount > 0 ? "warning" : "ok"} icon={CalendarClock} value={renewalCount} label="Renewals in 30 days" />}
        </div>
        <ChartCard title="Assets by type" className="lg:col-span-2">
          <BarList items={byType} empty="No assets yet." />
        </ChartCard>
      </div>

      <div className="flex flex-wrap items-center gap-2 bg-white p-3 rounded-2xl border border-slate-200">
        <SearchInput
          className="flex-1 min-w-48"
          placeholder="Search assets..."
          value={search}
          onChange={(v: string) => {
            setSearch(v);
            setPage(1);
          }}
        />
        <select
          className={selectClass}
          value={type}
          onChange={e => {
            setType(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All types</option>
          {ASSET_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      {isLoading ? <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 text-blue-600 animate-spin" /></div>
      : isError ? <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">Failed to load assets.</div>
      : assets.length === 0 ? <div className="bg-white border border-slate-200 rounded-2xl"><EmptyBlock icon={Boxes} title="No assets found." /></div>
      : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {assets.map((asset: any) => {
            const Icon = TYPE_ICONS[asset.type] || Globe;
            const colorClass = TYPE_COLORS[asset.type] || "bg-gray-100 text-gray-700";
            const daysLeft = asset.renewalDate ? Math.ceil((new Date(asset.renewalDate).getTime() - Date.now()) / 86400000) : null;
            const isExpiring = daysLeft !== null && daysLeft <= 30;
            return (
              <div key={asset.id} className={`bg-white rounded-2xl border p-5 flex flex-col gap-3 hover:shadow-sm transition-shadow ${isExpiring ? 'border-amber-300' : 'border-slate-200'}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${colorClass}`}><Icon className="w-4 h-4" /></div>
                    <div><p className="font-semibold text-gray-900 text-sm">{asset.name}</p><p className="text-xs text-gray-500">{asset.client?.name || '—'}</p></div>
                  </div>
                  <div className="flex items-center gap-1">
                    {isExpiring && isManagement && <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full mr-1">{daysLeft}d left</span>}
                    {isManagement ? (
                      <>
                        <button onClick={() => handleEditClick(asset)} className="p-1 hover:bg-gray-100 text-gray-500 hover:text-blue-600 rounded transition-colors" title="Edit Asset">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDeleteClick(asset)} className="p-1 hover:bg-gray-100 text-gray-500 hover:text-red-600 rounded transition-colors" title="Delete Asset">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : (
                      <button onClick={() => handleEditClick(asset)} className="p-1 hover:bg-gray-100 text-gray-500 hover:text-blue-600 rounded transition-colors" title="View Asset Details">
                        <Eye className="w-4 h-4 text-slate-500 hover:text-blue-600" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded font-medium ${colorClass}`}>{asset.type.replace(/_/g, ' ')}</span>
                    {asset.type === 'VPS' && (
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${asset.guardianMode === 'BYOVPS' || asset.guardianOwnership === 'CLIENT' ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-indigo-100 text-indigo-800 border border-indigo-200'}`}>
                        {asset.guardianMode === 'BYOVPS' || asset.guardianOwnership === 'CLIENT' ? 'BYOVPS' : 'Managed VPS'}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col items-end text-[10px]">
                    {isManagement && asset.cost && <span>₹{asset.cost} ({asset.billingCycle?.toLowerCase()})</span>}
                    {asset.renewalDate && <span>Renews {new Date(asset.renewalDate).toLocaleDateString()}</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {data && data.total > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 text-xs text-slate-600">
          <div>
            Showing <span className="font-semibold text-slate-900">{((page - 1) * limit) + 1}</span> to{' '}
            <span className="font-semibold text-slate-900">{Math.min(page * limit, data.total)}</span> of{' '}
            <span className="font-semibold text-slate-900">{data.total}</span> assets
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span>Per page:</span>
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none"
              >
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
            {data.totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent font-medium"
                >
                  Previous
                </button>
                <span className="px-2 py-1 font-semibold text-slate-800">
                  Page {page} of {data.totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= data.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent font-medium"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <Modal isOpen={open} onClose={() => { setOpen(false); setEditingAsset(null); }} title={isManagement ? (editingAsset ? "Edit Asset" : "Add Asset") : "Asset Infrastructure Specifications"} subtitle={isManagement ? (editingAsset ? "Update client asset details." : "Register a new client asset.") : "Technical specifications and configuration details."}>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {err && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{err}</div>}
          <FormField label="Asset Name" required><input className={inputCls} disabled={!isManagement} placeholder="example.com" value={form.name} onChange={e => set("name", e.target.value)} /></FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Type" required>
              <select className={selectCls} disabled={!isManagement} value={form.type} onChange={e => set("type", e.target.value)}>
                {ASSET_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
              </select>
            </FormField>
            <FormField label="Client" required>
              <select className={selectCls} disabled={!isManagement} value={form.clientId} onChange={e => set("clientId", e.target.value)}>
                <option value="">Select client</option>
                {(clients || []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </FormField>
          </div>
          <FormField label="Assigned Developer / Employee">
            <select className={selectCls} disabled={!isManagement} value={form.assignedUserId} onChange={e => set("assignedUserId", e.target.value)}>
              <option value="">Auto-assigned via Project / AMC Task</option>
              {(userList || []).map((u: any) => (
                <option key={u.id} value={u.id}>
                  {u.firstName || ''} {u.lastName || ''} ({u.role?.replace(/_/g,' ')}) — {u.email}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Description"><textarea className={textareaCls} disabled={!isManagement} rows={2} placeholder="Describe the asset..." value={form.description} onChange={e => set("description", e.target.value)} /></FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Renewal Date"><input type="date" className={inputCls} disabled={!isManagement} value={form.renewalDate} onChange={e => set("renewalDate", e.target.value)} /></FormField>
            {isManagement && (
              <FormField label="Billing Cycle">
                <select className={selectCls} value={form.billingCycle} onChange={e => set("billingCycle", e.target.value)}>
                  {["MONTHLY","QUARTERLY","ANNUALLY"].map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </FormField>
            )}
          </div>
          {isManagement && <FormField label="Cost (₹)"><input type="number" className={inputCls} placeholder="500" value={form.cost} onChange={e => set("cost", e.target.value)} /></FormField>}
          <FormField label="Notes"><textarea className={textareaCls} disabled={!isManagement} rows={2} placeholder="Login credentials, notes, etc." value={form.notes} onChange={e => set("notes", e.target.value)} /></FormField>
          
          {/* Metadata Section based on Type */}
          {(form.type === 'VPS' || form.type === 'HOSTING') && (
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Server Specifications</h4>
              
              <datalist id="providers-list">
                <option value="AWS" />
                <option value="Hetzner" />
                <option value="DigitalOcean" />
                <option value="Linode" />
                <option value="OVHcloud" />
                <option value="Hostinger" />
                <option value="Vultr" />
                <option value="Google Cloud" />
                <option value="Microsoft Azure" />
              </datalist>

              <datalist id="os-list">
                <option value="Ubuntu 24.04 LTS" />
                <option value="Ubuntu 22.04 LTS" />
                <option value="Debian 12" />
                <option value="CentOS Stream 9" />
                <option value="AlmaLinux 9" />
                <option value="Rocky Linux 9" />
              </datalist>

              {form.type === 'VPS' && (
                <FormField label="VPS Category / Infrastructure Type" required>
                  <select className={selectCls} disabled={!isManagement} value={form.vpsMode || 'MANAGED'} onChange={e => set("vpsMode", e.target.value)}>
                    <option value="MANAGED">⚡ Managed VPS (Neuravolt Guardian / Live Monitored)</option>
                    <option value="BYOVPS">🏢 BYOVPS (Client Owned Server / Bring Your Own VPS)</option>
                  </select>
                </FormField>
              )}

              {form.type === 'VPS' && form.vpsMode === 'BYOVPS' && (
                <div className="text-[11px] bg-indigo-50/80 border border-indigo-200/60 text-indigo-800 p-2.5 rounded-lg flex items-start gap-2 font-medium">
                  <span className="text-indigo-600 font-bold">ℹ️ Auto-Discovery:</span>
                  <span>When the Guardian agent is installed on this BYOVPS node, its CPU cores, RAM, Disk, and OS specs will automatically populate from live hardware.</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <FormField label="IP Address">
                  <input className={inputCls} disabled={!isManagement} placeholder="1.2.3.4" value={form.serverIp} onChange={e => set("serverIp", e.target.value)} />
                </FormField>
                <FormField label="Provider">
                  <input list="providers-list" className={inputCls} disabled={!isManagement} placeholder="e.g. AWS, Hetzner" value={form.provider} onChange={e => set("provider", e.target.value)} />
                </FormField>
              </div>

              {form.type === 'VPS' && (
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Operating System">
                    <input list="os-list" className={inputCls} disabled={!isManagement} placeholder="e.g. Ubuntu 24.04 LTS" value={form.os} onChange={e => set("os", e.target.value)} />
                  </FormField>
                  <FormField label="CPU Allocation (Cores)">
                    <input type="number" step="any" min="0.1" className={inputCls} disabled={!isManagement} placeholder="e.g. 4" value={form.cpu} onChange={e => set("cpu", e.target.value)} />
                  </FormField>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <FormField label="RAM / Memory (GB)">
                  <input type="number" step="any" min="0.1" className={inputCls} disabled={!isManagement} placeholder="e.g. 16" value={form.ram} onChange={e => set("ram", e.target.value)} />
                </FormField>
                <FormField label="Storage / Disk (GB)">
                  <input type="number" step="any" min="1" className={inputCls} disabled={!isManagement} placeholder="e.g. 200" value={form.disk} onChange={e => set("disk", e.target.value)} />
                </FormField>
                <FormField label="Bandwidth (TB)">
                  <input type="number" step="any" min="0.1" className={inputCls} disabled={!isManagement} placeholder="e.g. 16" value={form.bandwidthTB} onChange={e => set("bandwidthTB", e.target.value)} />
                </FormField>
              </div>

              {form.type === 'HOSTING' && (
                <FormField label="Control Panel URL">
                  <input className={inputCls} disabled={!isManagement} placeholder="https://..." value={form.controlPanelUrl} onChange={e => set("controlPanelUrl", e.target.value)} />
                </FormField>
              )}
            </div>
          )}

          {form.type === 'DOMAIN' && (
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Domain Specifications</h4>
              <FormField label="Registrar">
                <input className={inputCls} disabled={!isManagement} placeholder="GoDaddy, Namecheap..." value={form.registrar} onChange={e => set("registrar", e.target.value)} />
              </FormField>
              <FormField label="Name Servers (comma separated)">
                <input className={inputCls} disabled={!isManagement} placeholder="ns1.provider.com, ns2.provider.com" value={form.nameservers} onChange={e => set("nameservers", e.target.value)} />
              </FormField>
            </div>
          )}

          {form.type === 'SSL_CERTIFICATE' && (
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">SSL Certificate Specifications</h4>
              <FormField label="Issuer">
                <input className={inputCls} disabled={!isManagement} placeholder="Let's Encrypt, DigiCert..." value={form.issuer} onChange={e => set("issuer", e.target.value)} />
              </FormField>
              <FormField label="Covered Domains (comma separated)">
                <input className={inputCls} disabled={!isManagement} placeholder="domain.com, *.domain.com" value={form.domainsCovered} onChange={e => set("domainsCovered", e.target.value)} />
              </FormField>
            </div>
          )}

          <div className="pt-2">
            {!isManagement ? (
              <button type="button" onClick={() => { setOpen(false); setEditingAsset(null); }} className="w-full px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg">Close Specifications</button>
            ) : (
              <div className="flex gap-3">
                <button type="button" onClick={() => { setOpen(false); setEditingAsset(null); }} className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg">Cancel</button>
                <button type="submit" disabled={create.isPending || update.isPending} className="flex-1 flex items-center justify-center px-4 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg">
                  {(create.isPending || update.isPending) ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</> : editingAsset ? "Save Changes" : "Add Asset"}
                </button>
              </div>
            )}
          </div>
        </form>
      </Modal>
    </div>
    </PageShell>
  );
}
