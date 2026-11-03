"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Circle, Clock, LogOut, UserPlus, Users } from "lucide-react";
import { api } from "../../../src/lib/api";

type Item = { key: string; title: string; hint: string | null; manual: boolean; done: boolean; source: "system" | "hr" | null; doneAt: string | null; doneBy: string | null };
type List = { kind: "ONBOARDING" | "OFFBOARDING"; items: Item[]; done: number; total: number };
type Person = {
  employee: { id: string; name: string; email: string };
  joiningDate: string | null; exitDate: string | null; exitReason: string | null; status: string | null;
  onboarding: List; offboarding: List | null;
};
type RosterRow = { id: string; name: string; department: string | null; shiftName: string | null; start: string; end: string; graceMins: number; weeklyOff: string[] };

const input = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white";
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const errText = (e: unknown) => {
  const m = (e as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
  return Array.isArray(m) ? m.join(", ") : typeof m === "string" ? m : "Something went wrong";
};
const day = (d: string | null) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—");

function Progress({ list }: { list: List }) {
  const pct = Math.round((list.done / list.total) * 100);
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="h-1.5 flex-1 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full ${pct === 100 ? "bg-emerald-500" : "bg-indigo-500"}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] tabular-nums text-slate-500">{list.done}/{list.total}</span>
    </div>
  );
}

function Checklist({ person, list, onChange }: { person: Person; list: List; onChange: (p: Person) => void }) {
  const [error, setError] = useState<string | null>(null);
  const tick = useMutation({
    mutationFn: async (v: { key: string; done: boolean }) => (await api.patch(`/hr/employees/${person.employee.id}/checklist`, { kind: list.kind, ...v })).data as Person,
    onSuccess: (p) => { setError(null); onChange(p); },
    onError: (e) => setError(errText(e)),
  });
  return (
    <div>
      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
      <ul className="divide-y divide-slate-100">
        {list.items.map((i) => (
          <li key={i.key} className="flex items-start gap-2.5 py-2">
            {i.manual && i.source !== "system" ? (
              <button onClick={() => tick.mutate({ key: i.key, done: !i.done })} disabled={tick.isPending} aria-label={i.done ? "Untick" : "Tick"} className="mt-0.5">
                {i.done ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Circle className="w-4 h-4 text-slate-300 hover:text-slate-500" />}
              </button>
            ) : i.done ? <CheckCircle2 className="w-4 h-4 mt-0.5 text-emerald-600" /> : <Circle className="w-4 h-4 mt-0.5 text-slate-200" />}
            <div className="min-w-0 flex-1">
              <div className={`text-sm ${i.done ? "text-slate-500" : "text-slate-800"}`}>{i.title}</div>
              <div className="text-[11px] text-slate-400">
                {i.source === "system" ? "From the employee record"
                  : i.source === "hr" ? `Ticked by ${i.doneBy} on ${day(i.doneAt)}`
                  : i.manual ? (i.hint ? `Tick when done, or: ${i.hint}` : "Tick when done") : (i.hint ? `Ticks itself — ${i.hint}` : "Ticks itself")}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PersonPanel({ person, onChange, onClose }: { person: Person; onChange: (p: Person) => void; onClose: () => void }) {
  const [exit, setExit] = useState({ lastWorkingDay: person.exitDate?.slice(0, 10) || "", reason: person.exitReason || "", status: "NOTICE_PERIOD" });
  const [interview, setInterview] = useState("");
  const [error, setError] = useState<string | null>(null);
  const call = useMutation({
    mutationFn: async (fn: () => Promise<{ data: Person }>) => (await fn()).data,
    onSuccess: (p) => { setError(null); onChange(p); },
    onError: (e) => setError(errText(e)),
  });
  const id = person.employee.id;
  return (
    <div className="bg-white border border-slate-200 rounded-xl">
      <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-slate-100">
        <div>
          <div className="text-sm font-semibold text-slate-900">{person.employee.name}</div>
          <div className="text-xs text-slate-500">Joined {day(person.joiningDate)}{person.exitDate ? ` · Last day ${day(person.exitDate)}` : ""}</div>
        </div>
        <button onClick={onClose} className="text-xs text-slate-400 hover:text-slate-600">Close</button>
      </div>
      {error && <div className="mx-4 mt-3 flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2"><AlertTriangle className="w-3.5 h-3.5" /> {error}</div>}
      <div className="grid gap-4 p-4 lg:grid-cols-2">
        <div>
          <div className="flex items-center justify-between mb-1"><span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Joining</span><Progress list={person.onboarding} /></div>
          <Checklist person={person} list={person.onboarding} onChange={onChange} />
        </div>
        <div>
          {person.offboarding ? (
            <>
              <div className="flex items-center justify-between mb-1"><span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Exit</span><Progress list={person.offboarding} /></div>
              <Checklist person={person} list={person.offboarding} onChange={onChange} />
              <div className="mt-3 space-y-2">
                <textarea className={input} rows={2} placeholder="Exit interview notes" value={interview} onChange={(e) => setInterview(e.target.value)} />
                <div className="flex flex-wrap gap-2">
                  <button disabled={!interview.trim() || call.isPending} onClick={() => call.mutate(() => api.patch(`/hr/employees/${id}/exit-interview`, { notes: interview }))} className="px-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg disabled:opacity-50">Save interview notes</button>
                  {person.offboarding.items.find((i) => i.key === "access" && !i.done) && (
                    <button disabled={call.isPending} onClick={() => { if (confirm(`Turn off ${person.employee.name}'s login now? They are signed out everywhere.`)) call.mutate(() => api.post(`/hr/employees/${id}/disable-login`)); }} className="px-3 py-1.5 text-xs font-semibold text-red-700 border border-red-200 rounded-lg">Disable login</button>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Start exit</span>
              <div className="grid grid-cols-2 gap-2">
                <input type="date" className={input} value={exit.lastWorkingDay} onChange={(e) => setExit({ ...exit, lastWorkingDay: e.target.value })} />
                <select className={input} value={exit.status} onChange={(e) => setExit({ ...exit, status: e.target.value })}>
                  <option value="NOTICE_PERIOD">Serving notice</option>
                  <option value="RESIGNED">Resigned</option>
                  <option value="TERMINATED">Terminated</option>
                </select>
              </div>
              <input className={input} placeholder="Reason (optional)" value={exit.reason} onChange={(e) => setExit({ ...exit, reason: e.target.value })} />
              <button disabled={!exit.lastWorkingDay || call.isPending} onClick={() => call.mutate(() => api.post(`/hr/employees/${id}/exit`, exit))} className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-lg disabled:opacity-50">Start exit checklist</button>
              <p className="text-[11px] text-slate-400">The login stays on until you disable it from the exit checklist.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RosterPanel() {
  const qc = useQueryClient();
  const { data: rows, isLoading } = useQuery({ queryKey: ["hr-roster"], queryFn: async () => (await api.get("/hr/roster")).data as RosterRow[] });
  const [picked, setPicked] = useState<string[]>([]);
  const [form, setForm] = useState({ shiftName: "", start: "09:00", end: "18:00", graceMins: "15", weeklyOff: ["Saturday", "Sunday"] });
  const [msg, setMsg] = useState<string | null>(null);
  const assign = useMutation({
    mutationFn: async () => (await api.post("/hr/roster/assign", { userIds: picked, ...form, graceMins: Number(form.graceMins) })).data as { updated: number },
    onSuccess: (r) => { setMsg(`Shift saved for ${r.updated} employee${r.updated === 1 ? "" : "s"}.`); setPicked([]); qc.invalidateQueries({ queryKey: ["hr-roster"] }); },
    onError: (e) => setMsg(errText(e)),
  });
  const groups = useMemo(() => {
    const m = new Map<string, RosterRow[]>();
    for (const r of rows || []) {
      const k = `${r.start}–${r.end}`;
      m.set(k, [...(m.get(k) || []), r]);
    }
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [rows]);
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 text-sm font-semibold text-slate-800">Who works which shift</div>
        {isLoading ? <p className="p-4 text-xs text-slate-400">Loading…</p> : !rows?.length ? <p className="p-4 text-xs text-slate-400">No active employees.</p> : (
          <div className="divide-y divide-slate-100">
            {groups.map(([k, list]) => (
              <div key={k} className="px-4 py-3">
                <div className="flex items-center gap-2 text-xs text-slate-500 mb-2"><Clock className="w-3.5 h-3.5" /> {k} <span className="text-slate-300">·</span> {list.length} people</div>
                <div className="flex flex-wrap gap-1.5">
                  {list.map((r) => (
                    <button key={r.id} onClick={() => toggle(r.id)} title={`${r.shiftName || "Shift"} · grace ${r.graceMins} min · off ${r.weeklyOff.join(", ") || "none"}`}
                      className={`px-2.5 py-1 rounded-full text-xs border ${picked.includes(r.id) ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"}`}>
                      {r.name}{r.department ? <span className={picked.includes(r.id) ? "text-indigo-200" : "text-slate-400"}> · {r.department}</span> : null}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 h-fit">
        <div className="text-sm font-semibold text-slate-800">Assign a shift</div>
        <p className="text-xs text-slate-500">{picked.length ? `${picked.length} selected` : "Pick people on the left."} Punches after start + grace are marked late.</p>
        <input className={input} placeholder="Shift name (optional)" value={form.shiftName} onChange={(e) => setForm({ ...form, shiftName: e.target.value })} />
        <div className="grid grid-cols-3 gap-2">
          <label className="text-[11px] text-slate-500">Start<input type="time" className={input} value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} /></label>
          <label className="text-[11px] text-slate-500">End<input type="time" className={input} value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} /></label>
          <label className="text-[11px] text-slate-500">Grace (min)<input type="number" min={0} max={240} className={input} value={form.graceMins} onChange={(e) => setForm({ ...form, graceMins: e.target.value })} /></label>
        </div>
        <div>
          <div className="text-[11px] text-slate-500 mb-1">Weekly off</div>
          <div className="flex flex-wrap gap-1">
            {DAYS.map((d) => (
              <button key={d} onClick={() => setForm({ ...form, weeklyOff: form.weeklyOff.includes(d) ? form.weeklyOff.filter((x) => x !== d) : [...form.weeklyOff, d] })}
                className={`px-2 py-0.5 rounded text-[11px] border ${form.weeklyOff.includes(d) ? "bg-slate-900 text-white border-slate-900" : "border-slate-200 text-slate-600"}`}>{d.slice(0, 3)}</button>
            ))}
          </div>
        </div>
        <button disabled={!picked.length || assign.isPending} onClick={() => assign.mutate()} className="w-full py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg disabled:opacity-50">Save shift</button>
        {msg && <p className="text-xs text-slate-600">{msg}</p>}
      </div>
    </div>
  );
}

function PersonRow({ p, list, onOpen }: { p: Person; list: List; onOpen: (p: Person) => void }) {
  return (
    <button onClick={() => onOpen(p)} className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-slate-50">
      <div className="min-w-0">
        <div className="text-sm text-slate-800 truncate">{p.employee.name}</div>
        <div className="text-[11px] text-slate-400">{list.kind === "ONBOARDING" ? `Joined ${day(p.joiningDate)}` : `Last day ${day(p.exitDate)}`}</div>
      </div>
      <Progress list={list} />
    </button>
  );
}

/** Joiners and leavers with their checklists, and the shift roster. */
export function LifecycleTab() {
  const qc = useQueryClient();
  const [view, setView] = useState<"people" | "roster">("people");
  const [open, setOpen] = useState<Person | null>(null);
  const [pickId, setPickId] = useState("");
  const { data, isLoading, isError } = useQuery({ queryKey: ["hr-lifecycle"], queryFn: async () => (await api.get("/hr/lifecycle")).data as { joiners: Person[]; leavers: Person[] } });
  const { data: employees } = useQuery({ queryKey: ["hr-employees"], queryFn: async () => (await api.get("/hr/employees")).data as { id: string; firstName?: string; lastName?: string; email: string }[] });

  const openPerson = async (id: string) => {
    const { data: p } = await api.get(`/hr/employees/${id}/checklist`);
    setOpen(p);
  };
  const changed = (p: Person) => { setOpen(p); qc.invalidateQueries({ queryKey: ["hr-lifecycle"] }); };


  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Joiners, leavers and shifts</h2>
          <p className="text-xs text-slate-500">Checklists tick themselves from real records where they can; the rest HR ticks.</p>
        </div>
        <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-white">
          {(["people", "roster"] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} className={`px-3 py-1.5 text-xs font-semibold rounded-md ${view === v ? "bg-slate-900 text-white" : "text-slate-600"}`}>{v === "people" ? "Checklists" : "Shift roster"}</button>
          ))}
        </div>
      </div>

      {view === "roster" ? <RosterPanel /> : (
        <>
          <div className="flex gap-2 items-center">
            <select className={`${input} max-w-xs`} value={pickId} onChange={(e) => { setPickId(e.target.value); if (e.target.value) openPerson(e.target.value); }}>
              <option value="">Open any employee…</option>
              {(employees || []).map((e) => <option key={e.id} value={e.id}>{`${e.firstName || ""} ${e.lastName || ""}`.trim() || e.email}</option>)}
            </select>
          </div>
          {open && <PersonPanel key={open.employee.id} person={open} onChange={changed} onClose={() => { setOpen(null); setPickId(""); }} />}
          {isError ? <p className="text-xs text-red-600">Could not load checklists.</p> : (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 text-sm font-semibold text-slate-800"><UserPlus className="w-4 h-4 text-slate-400" /> Joining <span className="text-xs font-normal text-slate-400">{data?.joiners.length ?? ""}</span></div>
                {isLoading ? <p className="p-4 text-xs text-slate-400">Loading…</p> : !data?.joiners.length ? <p className="p-4 text-xs text-slate-400">No one is mid-joining.</p> :
                  <div className="divide-y divide-slate-100">{data.joiners.map((p) => <PersonRow key={p.employee.id} p={p} list={p.onboarding} onOpen={setOpen} />)}</div>}
              </div>
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 text-sm font-semibold text-slate-800"><LogOut className="w-4 h-4 text-slate-400" /> Leaving <span className="text-xs font-normal text-slate-400">{data?.leavers.length ?? ""}</span></div>
                {isLoading ? <p className="p-4 text-xs text-slate-400">Loading…</p> : !data?.leavers.length ? <p className="p-4 text-xs text-slate-400 flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> No exits in progress. Open an employee above to start one.</p> :
                  <div className="divide-y divide-slate-100">{data.leavers.map((p) => <PersonRow key={p.employee.id} p={p} list={p.offboarding!} onOpen={setOpen} />)}</div>}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
