"use client";

import { useState } from "react";
import { useTickets, useAllClients, useCreate, useUploadAttachment, useProjects, useAmcContracts } from "../../src/hooks/queries";
import { Plus, Loader2, MessageSquare, Paperclip, LifeBuoy, CircleDot, Timer, ShieldAlert, Flame } from "lucide-react";
import { PageShell, PageHeader, Badge, statusTone, Button, SearchInput, selectClass, TableCard, th, td, EmptyBlock, dayBuckets } from "../../src/components/ui/page";
import { KpiCard, ChartCard, StackedBars, Donut, BarList } from "../../src/components/ui/charts";
import { Modal, FormField, inputCls, selectCls, textareaCls } from "../components/Modal";
import Link from "next/link";

export default function TicketsPage() {
  const [search, setSearch] = useState("");
  const [statusF, setStatusF] = useState("");
  const [priorityF, setPriorityF] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", priority: "MEDIUM", category: "", clientId: "", linkType: "NONE", projectId: "", amcContractId: "" });
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [err, setErr] = useState("");

  const { data, isLoading, isError } = useTickets({ search: search || undefined, status: statusF || undefined, priority: priorityF || undefined });
  const { data: clients } = useAllClients();
  const create = useCreate("tickets", "tickets");
  const uploadAttachment = useUploadAttachment();

  const { data: clientProjectsResponse } = useProjects(form.clientId ? { clientId: form.clientId, limit: 100 } : undefined);
  const clientProjects = clientProjectsResponse?.projects || [];

  const { data: clientAmcsResponse } = useAmcContracts(form.clientId ? { clientId: form.clientId, limit: 100 } : undefined);
  const clientAmcs = clientAmcsResponse?.contracts || [];

  const tickets = data?.tickets || [];
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { setErr("Title is required."); return; }
    if (!form.description.trim()) { setErr("Description is required."); return; }
    if (!form.clientId) { setErr("Please select a client."); return; }
    if (!form.category.trim()) { setErr("Category is required."); return; }
    setErr("");
    try {
      const ticket = await create.mutateAsync({
        title: form.title.trim(),
        description: form.description.trim(),
        priority: form.priority,
        category: form.category.trim(),
        clientId: form.clientId,
        projectId: form.linkType === 'PROJECT' ? form.projectId : undefined,
        amcContractId: form.linkType === 'AMC' ? form.amcContractId : undefined,
      });
      
      if (selectedFiles.length > 0) {
        for (const file of selectedFiles) {
          await uploadAttachment.mutateAsync({ file, ticketId: ticket.id });
        }
      }
      
      setOpen(false);
      setForm({ title: "", description: "", priority: "MEDIUM", category: "", clientId: "", linkType: "NONE", projectId: "", amcContractId: "" });
      setSelectedFiles([]);
    } catch (e: any) { setErr(e.response?.data?.message || "Failed to create ticket."); }
  };

  const SLA_TONE: Record<string, "green" | "amber" | "red"> = { HEALTHY: "green", WARNING: "amber", BREACHED: "red" };
  const PRIORITY_TONE: Record<string, "red" | "amber" | "blue" | "slate"> = { CRITICAL: "red", HIGH: "amber", MEDIUM: "blue", LOW: "slate" };
  const PRIORITY_COLOR: Record<string, string> = { CRITICAL: "#ef4444", HIGH: "#f59e0b", MEDIUM: "#3b82f6", LOW: "#94a3b8" };
  const STATUS_COLOR: Record<string, string> = { OPEN: "#3b82f6", IN_PROGRESS: "#8b5cf6", RESOLVED: "#10b981", CLOSED: "#94a3b8" };

  const isActive = (t: any) => !["RESOLVED", "CLOSED"].includes(t.status);
  const openCount = tickets.filter((t: any) => t.status === "OPEN").length;
  const inProgress = tickets.filter((t: any) => t.status === "IN_PROGRESS").length;
  const breached = tickets.filter((t: any) => isActive(t) && t.slaStatus === "BREACHED").length;
  const critical = tickets.filter((t: any) => isActive(t) && t.priority === "CRITICAL").length;
  const trend = dayBuckets(tickets, (t: any) => new Date(t.createdAt).getTime()).map((b) => ({
    label: b.label,
    values: { open: b.items.filter(isActive).length, done: b.items.filter((t: any) => !isActive(t)).length },
  }));
  const countBy = (k: string) => tickets.reduce((acc: Record<string, number>, t: any) => { const v = t[k] || "—"; acc[v] = (acc[v] ?? 0) + 1; return acc; }, {});
  const label = (s: string) => s.replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase());

  return (
    <PageShell>
      <div className="max-w-7xl mx-auto space-y-5">
        <PageHeader
          icon={LifeBuoy}
          title="Support Tickets"
          subtitle="Manage customer requests and issues."
          actions={<Button variant="primary" onClick={() => { setOpen(true); setErr(""); }}><Plus className="w-4 h-4" /> New ticket</Button>}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <KpiCard tone="info" icon={CircleDot} value={openCount} label="Open" active={statusF === "OPEN"} onClick={() => setStatusF(statusF === "OPEN" ? "" : "OPEN")} series={trend.map((b) => b.values.open)} />
          <KpiCard tone="violet" icon={Timer} value={inProgress} label="In progress" active={statusF === "IN_PROGRESS"} onClick={() => setStatusF(statusF === "IN_PROGRESS" ? "" : "IN_PROGRESS")} />
          <KpiCard tone="critical" icon={ShieldAlert} value={breached} label="SLA breached" delta={{ text: "open tickets past SLA" }} />
          <KpiCard tone="warning" icon={Flame} value={critical} label="Critical" active={priorityF === "CRITICAL"} onClick={() => setPriorityF(priorityF === "CRITICAL" ? "" : "CRITICAL")} delta={{ text: "still open" }} />
        </div>

        {tickets.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <ChartCard title="Tickets raised (14 days)">
              <StackedBars buckets={trend} labelEvery={3} format={(n) => String(Math.round(n))} series={[{ key: "open", label: "Still open", color: "#3b82f6" }, { key: "done", label: "Resolved / closed", color: "#10b981" }]} />
            </ChartCard>
            <ChartCard title="By status">
              <Donut centerLabel="Tickets" segments={Object.entries(countBy("status")).map(([k, v]) => ({ label: label(k), value: v as number, color: STATUS_COLOR[k] || "#94a3b8" }))} />
            </ChartCard>
            <ChartCard title="By priority">
              <BarList items={["CRITICAL", "HIGH", "MEDIUM", "LOW"].map((k) => ({ label: label(k), value: countBy("priority")[k] ?? 0, color: PRIORITY_COLOR[k] }))} />
            </ChartCard>
          </div>
        )}

        <TableCard title="Tickets" icon={MessageSquare} count={tickets.length} toolbar={<>
          <SearchInput className="flex-1 md:w-72" placeholder="Search tickets..." value={search} onChange={setSearch} />
          <select className={selectClass} value={statusF} onChange={e => setStatusF(e.target.value)}>
            <option value="">All statuses</option>
            {["OPEN","IN_PROGRESS","RESOLVED","CLOSED"].map(s => <option key={s} value={s}>{label(s)}</option>)}
          </select>
          <select className={selectClass} value={priorityF} onChange={e => setPriorityF(e.target.value)}>
            <option value="">All priorities</option>
            {["CRITICAL","HIGH","MEDIUM","LOW"].map(s => <option key={s} value={s}>{label(s)}</option>)}
          </select>
        </>}>
          {isLoading ? <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 text-indigo-600 animate-spin" /></div>
          : isError ? <div className="m-4 bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-lg text-sm">Failed to load tickets.</div>
          : tickets.length === 0 ? <EmptyBlock icon={MessageSquare} title="No tickets found." />
          : (
            <table className="min-w-full">
              <thead>
                <tr>{["ID","Subject","Client","Scope","Status & SLA","Priority","Assignee","Created"].map(h => <th key={h} className={th}>{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tickets.map((ticket: any) => (
                  <tr key={ticket.id} className="hover:bg-slate-50 transition-colors">
                    <td className={`${td} font-mono text-xs`}>
                      <Link href={`/tickets/${ticket.id}`} className="hover:underline text-indigo-600">
                        {String(ticket.id).slice(0, 8)}
                      </Link>
                    </td>
                    <td className={td}>
                      <Link href={`/tickets/${ticket.id}`} className="font-semibold text-slate-900 hover:text-indigo-600">
                        {ticket.title}
                      </Link>
                    </td>
                    <td className={td}>{ticket.client?.name || '—'}</td>
                    <td className={td}>
                      {ticket.project ? (
                        <Link href={`/projects/${ticket.project.id}`}><Badge tone="blue">{ticket.project.name || 'Project'}</Badge></Link>
                      ) : ticket.amcContract ? (
                        <Link href={`/amc/${ticket.amcContract.id}`}><Badge tone="violet">{ticket.amcContract.contractNumber || 'AMC'}</Badge></Link>
                      ) : (
                        <span className="text-xs text-slate-400">General</span>
                      )}
                    </td>
                    <td className={td}>
                      <div className="flex flex-col gap-1 items-start">
                        <Badge tone={statusTone(ticket.status)} dot>{label(ticket.status || '—')}</Badge>
                        {ticket.slaStatus && <Badge tone={SLA_TONE[ticket.slaStatus] || "slate"}>SLA {label(ticket.slaStatus)}</Badge>}
                      </div>
                    </td>
                    <td className={td}><Badge tone={PRIORITY_TONE[ticket.priority] || "slate"}>{label(ticket.priority || '—')}</Badge></td>
                    <td className={td}>
                      {ticket.assignedTo || ticket.assignee ? (
                        `${(ticket.assignedTo || ticket.assignee).firstName} ${(ticket.assignedTo || ticket.assignee).lastName}`
                      ) : (
                        <span className="text-slate-400">Unassigned</span>
                      )}
                    </td>
                    <td className={`${td} text-slate-500 whitespace-nowrap`}>{new Date(ticket.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </TableCard>
      </div>

      <Modal isOpen={open} onClose={() => setOpen(false)} title="Create Support Ticket" subtitle="Submit a new support request on behalf of a client.">
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {err && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{err}</div>}
          <FormField label="Title" required><input className={inputCls} placeholder="Cannot access dashboard" value={form.title} onChange={e => set("title", e.target.value)} /></FormField>
          <FormField label="Client" required>
            <select className={selectCls} value={form.clientId} onChange={e => {
              set("clientId", e.target.value);
              set("linkType", "NONE");
              set("projectId", "");
              set("amcContractId", "");
            }}>
              <option value="">Select a client</option>
              {(clients || []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </FormField>

          {form.clientId && (
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Link Ticket To">
                <select className={selectCls} value={form.linkType} onChange={e => {
                  set("linkType", e.target.value);
                  set("projectId", "");
                  set("amcContractId", "");
                }}>
                  <option value="NONE">General Support (Unlinked)</option>
                  <option value="PROJECT">Active Project</option>
                  <option value="AMC">AMC Contract</option>
                </select>
              </FormField>

              {form.linkType === 'PROJECT' && (
                <FormField label="Select Project" required>
                  <select className={selectCls} value={form.projectId} onChange={e => set("projectId", e.target.value)} required>
                    <option value="">-- Choose Project --</option>
                    {clientProjects.map((p: any) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </FormField>
              )}

              {form.linkType === 'AMC' && (
                <FormField label="Select AMC Contract" required>
                  <select className={selectCls} value={form.amcContractId} onChange={e => set("amcContractId", e.target.value)} required>
                    <option value="">-- Choose AMC Contract --</option>
                    {clientAmcs.map((a: any) => (
                      <option key={a.id} value={a.id}>{a.contractNumber} ({a.status})</option>
                    ))}
                  </select>
                </FormField>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Priority" required>
              <select className={selectCls} value={form.priority} onChange={e => set("priority", e.target.value)}>
                {["CRITICAL","HIGH","MEDIUM","LOW"].map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </FormField>
            <FormField label="Category" required><input className={inputCls} placeholder="Bug, Feature, Support..." value={form.category} onChange={e => set("category", e.target.value)} /></FormField>
          </div>
          <FormField label="Description" required><textarea className={textareaCls} rows={3} placeholder="Describe the issue in detail..." value={form.description} onChange={e => set("description", e.target.value)} /></FormField>
          <FormField label="Attachments (Optional)">
            <input 
              type="file" 
              multiple 
              onChange={e => {
                if (e.target.files) {
                  setSelectedFiles(Array.from(e.target.files));
                }
              }} 
              className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
            />
            {selectedFiles.length > 0 && (
              <div className="mt-2 text-xs text-slate-500 space-y-1">
                {selectedFiles.map((f, i) => (
                  <div key={i} className="truncate text-slate-600 flex items-center gap-1">
                    <Paperclip className="w-3.5 h-3.5" />
                    <span>{f.name} ({(f.size / 1024).toFixed(1)} KB)</span>
                  </div>
                ))}
              </div>
            )}
          </FormField>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setOpen(false)} className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">Cancel</button>
            <button type="submit" disabled={create.isPending} className="flex-1 flex items-center justify-center px-4 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg transition-colors">
              {create.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating...</> : "Create Ticket"}
            </button>
          </div>
        </form>
      </Modal>
    </PageShell>
  );
}
