"use client";

import { useState } from "react";
import { useProjects, useAllClients, useCreate, useUpdate, useDelete } from "../../src/hooks/queries";
import { Plus, Loader2, FolderOpen, Calendar, Edit, Trash2, FolderKanban, PlayCircle, CheckCircle2, PauseCircle, IndianRupee } from "lucide-react";
import { PageShell, PageHeader, Badge, statusTone, Button, SearchInput, selectClass, TableCard, th, td, EmptyBlock } from "../../src/components/ui/page";
import { KpiCard, ChartCard, Donut, BarList, compact } from "../../src/components/ui/charts";
import { Modal, FormField, inputCls, selectCls, textareaCls } from "../components/Modal";
import Link from "next/link";

export default function ProjectsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [open, setOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<any | null>(null);
  const [form, setForm] = useState({ name: "", clientId: "", description: "", startDate: "", endDate: "", budget: "", status: "ACTIVE" });
  const [err, setErr] = useState("");

  const { data, isLoading, isError } = useProjects({ search: search || undefined, status: statusFilter || undefined });
  const { data: clients } = useAllClients();
  const create = useCreate("projects", "projects");
  const update = useUpdate("projects", "projects");
  const del = useDelete("projects", "projects");

  const projects = data?.projects || [];

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setErr("Project name is required."); return; }
    if (!form.clientId) { setErr("Please select a client."); return; }
    setErr("");
    try {
      const payload = {
        name: form.name.trim(),
        clientId: form.clientId,
        description: form.description || undefined,
        startDate: form.startDate ? new Date(form.startDate).toISOString() : undefined,
        endDate: form.endDate ? new Date(form.endDate).toISOString() : undefined,
        budget: form.budget !== "" && !isNaN(Number(String(form.budget).replace(/,/g, ''))) ? Number(String(form.budget).replace(/,/g, '')) : undefined,
        status: editingProject ? form.status : undefined,
      };

      if (editingProject) {
        await update.mutateAsync({ id: editingProject.id, ...payload });
      } else {
        await create.mutateAsync(payload);
      }
      setOpen(false);
      setEditingProject(null);
      setForm({ name: "", clientId: "", description: "", startDate: "", endDate: "", budget: "", status: "ACTIVE" });
    } catch (e: any) {
      setErr(e.response?.data?.message || "Failed to save project.");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete project "${name}"?`)) {
      try {
        await del.mutateAsync(id);
      } catch (err: any) {
        alert(
          Array.isArray(err.response?.data?.message)
            ? err.response.data.message.join(", ")
            : err.response?.data?.message || err.message || "Failed to delete project."
        );
      }
    }
  };

  const STATUS_COLOR: Record<string, string> = { ACTIVE: "#3b82f6", COMPLETED: "#10b981", ON_HOLD: "#f59e0b", CANCELLED: "#ef4444", PLANNING: "#94a3b8" };
  const label = (s: string) => String(s || "—").replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase());
  const byStatus = projects.reduce((acc: Record<string, number>, p: any) => { acc[p.status] = (acc[p.status] ?? 0) + 1; return acc; }, {});
  const activeBudget = projects.filter((p: any) => p.status === "ACTIVE").reduce((s: number, p: any) => s + Number(p.budget || 0), 0);
  const byClient = Object.entries(projects.reduce((acc: Record<string, number>, p: any) => { const n = p.client?.name || "—"; acc[n] = (acc[n] ?? 0) + 1; return acc; }, {}))
    .sort((x: any, y: any) => y[1] - x[1]).slice(0, 6).map(([k, v]) => ({ label: k, value: v as number }));
  const toggle = (st: string) => setStatusFilter(statusFilter === st ? "" : st);

  return (
    <PageShell>
      <div className="max-w-7xl mx-auto space-y-5">
      <PageHeader
        icon={FolderKanban}
        title="Projects"
        subtitle="Manage and track client projects."
        actions={<Button variant="primary" onClick={() => { setOpen(true); setErr(""); }}><Plus className="w-4 h-4" /> New project</Button>}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <KpiCard tone="info" icon={PlayCircle} value={byStatus.ACTIVE ?? 0} label="Active" active={statusFilter === "ACTIVE"} onClick={() => toggle("ACTIVE")} delta={activeBudget > 0 ? { text: `₹${compact(activeBudget)} budget` } : null} />
        <KpiCard tone="ok" icon={CheckCircle2} value={byStatus.COMPLETED ?? 0} label="Completed" active={statusFilter === "COMPLETED"} onClick={() => toggle("COMPLETED")} />
        <KpiCard tone="warning" icon={PauseCircle} value={byStatus.ON_HOLD ?? 0} label="On hold" active={statusFilter === "ON_HOLD"} onClick={() => toggle("ON_HOLD")} />
        <KpiCard tone="neutral" icon={FolderKanban} value={data?.total ?? projects.length} label="Total projects" />
      </div>

      {projects.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard title="Projects by status">
            <Donut centerLabel="Projects" segments={Object.entries(byStatus).map(([k, v]) => ({ label: label(k), value: v as number, color: STATUS_COLOR[k] || "#94a3b8" }))} />
          </ChartCard>
          <ChartCard title="Projects per client">
            <BarList items={byClient} />
          </ChartCard>
        </div>
      )}

      <TableCard title="Projects" icon={FolderOpen} count={data?.total ?? projects.length} toolbar={<>
        <SearchInput className="flex-1 md:w-72" placeholder="Search projects..." value={search} onChange={setSearch} />
        <select className={selectClass} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          {["ACTIVE","PLANNING","ON_HOLD","COMPLETED","CANCELLED"].map(s => <option key={s} value={s}>{label(s)}</option>)}
        </select>
      </>}>
      {isLoading ? <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 text-indigo-600 animate-spin" /></div>
      : isError ? <div className="m-4 bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-lg text-sm">Failed to load projects.</div>
      : projects.length === 0 ? (
        <EmptyBlock icon={FolderOpen} title="No projects found" hint='Click "New project" to get started.' />
      ) : (
          <table className="min-w-full">
            <thead>
              <tr>
                {["Project Name","Client","Status","Progress","Budget","Dates","Actions"].map(h => (
                  <th key={h} className={`${th} ${h === "Actions" ? "text-right" : ""}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {projects.map((project: any) => {
                const progress: number | null = project.milestones?.length
                  ? Math.round((project.milestones.filter((m: any) => m.status === 'COMPLETED').length / project.milestones.length) * 100)
                  : null;
                return (
                  <tr key={project.id} className="hover:bg-slate-50 transition-colors">
                    <td className={td}>
                      <Link href={`/projects/${project.id}`} className="font-semibold text-slate-900 hover:text-indigo-600">{project.name}</Link>
                      {project.description && <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{project.description}</p>}
                    </td>
                    <td className={td}>{project.client?.name || '—'}</td>
                    <td className={td}><Badge tone={project.status === "ACTIVE" ? "blue" : statusTone(project.status)} dot>{label(project.status)}</Badge></td>
                    <td className={td}>
                      {progress === null ? <span className="text-xs text-slate-400" title="No milestones yet">—</span> : (
                      <div className="flex items-center gap-2 min-w-[120px]">
                        <div className="flex-1 bg-slate-100 rounded-full h-1.5"><div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${progress}%` }} /></div>
                        <span className="text-xs text-slate-500 w-8 text-right">{progress}%</span>
                      </div>)}
                    </td>
                    <td className={`${td} font-medium text-slate-900`}>{project.budget ? `₹${project.budget.toLocaleString()}` : '—'}</td>
                    <td className={`${td} text-xs text-slate-500`}>
                      {project.startDate && <div className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(project.startDate).toLocaleDateString()}</div>}
                      {project.endDate && <div>{new Date(project.endDate).toLocaleDateString()}</div>}
                    </td>
                    <td className={`${td} text-right`}>
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => {
                            setEditingProject(project);
                            setForm({
                              name: project.name,
                              clientId: project.clientId,
                              description: project.description || "",
                              startDate: project.startDate ? new Date(project.startDate).toISOString().split('T')[0] : "",
                              endDate: project.endDate ? new Date(project.endDate).toISOString().split('T')[0] : "",
                              budget: project.budget ? String(project.budget) : "",
                              status: project.status || "ACTIVE",
                            });
                            setOpen(true);
                            setErr("");
                          }}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(project.id, project.name)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
      )}
      </TableCard>
      </div>

      {/* Modal */}
      <Modal isOpen={open} onClose={() => { setOpen(false); setEditingProject(null); }} title={editingProject ? "Edit Project" : "New Project"} subtitle={editingProject ? "Update project details." : "Create a new client project."}>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {err && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{err}</div>}
          <FormField label="Project Name" required>
            <input className={inputCls} placeholder="Website Redesign" value={form.name} onChange={e => set("name", e.target.value)} />
          </FormField>
          <FormField label="Client" required>
            <select className={selectCls} value={form.clientId} onChange={e => set("clientId", e.target.value)}>
              <option value="">Select a client</option>
              {(clients || []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </FormField>
          {editingProject && (
            <FormField label="Status">
              <select className={selectCls} value={form.status} onChange={e => set("status", e.target.value)}>
                {["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"].map(s => (
                  <option key={s} value={s}>{s.replace('_',' ')}</option>
                ))}
              </select>
            </FormField>
          )}
          <FormField label="Description">
            <textarea className={textareaCls} rows={2} placeholder="Describe the project..." value={form.description} onChange={e => set("description", e.target.value)} />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Start Date"><input type="date" className={inputCls} value={form.startDate} onChange={e => set("startDate", e.target.value)} /></FormField>
            <FormField label="End Date"><input type="date" className={inputCls} value={form.endDate} onChange={e => set("endDate", e.target.value)} /></FormField>
          </div>
          <FormField label="Budget (₹)"><input type="number" className={inputCls} placeholder="10000" value={form.budget} onChange={e => set("budget", e.target.value)} /></FormField>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => { setOpen(false); setEditingProject(null); }} className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">Cancel</button>
            <button type="submit" disabled={create.isPending || update.isPending} className="flex-1 flex items-center justify-center px-4 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg transition-colors">
              {(create.isPending || update.isPending) ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</> : (editingProject ? "Save Changes" : "Create Project")}
            </button>
          </div>
        </form>
      </Modal>
    </PageShell>
  );
}
