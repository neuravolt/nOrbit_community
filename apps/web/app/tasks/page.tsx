"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { api } from "../../src/lib/api";
import { useUsers, useProjects, useAmcContracts } from "../../src/hooks/queries";
import { useAuthStore } from "../../src/store/auth";
import { Card, CardContent } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../../components/ui/dialog";
import {
  Kanban,
  List as ListIcon,
  Filter,
  Plus,
  Calendar,
  User as UserIcon,
  AlertCircle,
  ListChecks,
  CircleDashed,
  Timer,
  Eye,
  CalendarX,
  Search,
  CheckCircle2,
  ChevronUp,
  ChevronsUp,
  ChevronDown,
  Equal,
  Clock,
  FolderKanban,
  CheckSquare,
  MessageSquare,
  Flame,
  ArrowRight,
  SlidersHorizontal,
  X,
  ShieldAlert,
  Sparkles,
  Activity,
  Play,
  MoreHorizontal,
  MoreVertical,
  Paperclip,
  Tag,
  FileText,
  Settings,
} from "lucide-react";
import { PageShell, PageHeader, Badge as KitBadge } from "../../src/components/ui/page";

function formatRelativeTime(dateInput: string | Date | undefined) {
  if (!dateInput) return "Recently";
  const date = new Date(dateInput);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "1d ago";
  if (diffDays < 7) return `${diffDays}d ago`;
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks === 1) return "1 week ago";
  if (diffWeeks < 4) return `${diffWeeks} weeks ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// Jira / SRE Priority configuration
const PRIORITY_CONFIG: Record<string, { label: string; code: string; color: string; bg: string; border: string; icon: any }> = {
  CRITICAL: {
    label: "Critical",
    code: "P0",
    color: "text-rose-600",
    bg: "bg-rose-50",
    border: "border-rose-200",
    icon: Flame,
  },
  HIGH: {
    label: "High",
    code: "P1",
    color: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-200",
    icon: ChevronUp,
  },
  MEDIUM: {
    label: "Medium",
    code: "P2",
    color: "text-blue-600",
    bg: "bg-blue-50",
    border: "border-blue-200",
    icon: Equal,
  },
  LOW: {
    label: "Low",
    code: "P3",
    color: "text-slate-500",
    bg: "bg-slate-50",
    border: "border-slate-200",
    icon: ChevronDown,
  },
};

const COLUMNS = [
  {
    id: "TODO",
    title: "To Do",
    sub: "Backlog & Queued",
    dot: "bg-slate-400",
    badgeBg: "bg-white text-slate-700 border-slate-200",
    headerBg: "bg-slate-50/80 border-slate-200",
    accent: "border-t-slate-400",
  },
  {
    id: "IN_PROGRESS",
    title: "In Progress",
    sub: "Active Engineering",
    dot: "bg-blue-500",
    badgeBg: "bg-blue-50 text-blue-700 border-blue-200",
    headerBg: "bg-blue-50/50 border-blue-100",
    accent: "border-t-blue-500",
  },
  {
    id: "REVIEW",
    title: "In Review",
    sub: "QA & Peer Verification",
    dot: "bg-violet-500",
    badgeBg: "bg-purple-50 text-purple-700 border-purple-200",
    headerBg: "bg-purple-50/50 border-purple-100",
    accent: "border-t-violet-500",
  },
  {
    id: "DONE",
    title: "Completed",
    sub: "Shipped & Closed",
    dot: "bg-emerald-500",
    badgeBg: "bg-emerald-50 text-emerald-700 border-emerald-200",
    headerBg: "bg-emerald-50/50 border-emerald-100",
    accent: "border-t-emerald-500",
  },
];

export default function TasksPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const userRole = (user as any)?.role as string | undefined;
  const isEmployee = userRole === "DEVELOPER" || userRole === "QA";

  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [filterProject, setFilterProject] = useState<string>("all");
  const [filterAssignee, setFilterAssignee] = useState<string>(
    isEmployee && (user as any)?.id ? (user as any).id : "all"
  );
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [quickFilter, setQuickFilter] = useState<"all" | "my" | "critical" | "in_progress" | "overdue">("all");
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);

  // Create task modal fields
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newProject, setNewProject] = useState("");
  const [newMilestone, setNewMilestone] = useState("");
  const [newAssignee, setNewAssignee] = useState("");
  const [newPriority, setNewPriority] = useState("MEDIUM");
  const [newDueDate, setNewDueDate] = useState("");
  const [newAmcContract, setNewAmcContract] = useState("");

  // Fetch Tasks
  const { data: tasksData, isLoading, isError, error, refetch: refetchTasks } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data } = await api.get("/tasks");
      return data;
    },
  });

  // Fetch Users, Projects, and AMC Contracts for dropdowns
  const { data: usersResponse } = useUsers({ limit: 100 });
  const { data: projectsResponse } = useProjects({ limit: 100 });
  const { data: amcResponse } = useAmcContracts({ status: "ACTIVE", limit: 100 });

  const { data: selectedProject } = useQuery({
    queryKey: ["project", newProject],
    queryFn: async () => {
      const { data } = await api.get(`/projects/${newProject}`);
      return data;
    },
    enabled: !!newProject,
  });

  const projectMilestones = selectedProject?.milestones || [];
  const allUsers = usersResponse?.users || [];
  const allProjects = projectsResponse?.projects || [];
  const allAmcContracts = amcResponse?.contracts || [];

  const tasks = useMemo(() => {
    return Array.isArray(tasksData) ? tasksData : tasksData?.tasks || [];
  }, [tasksData]);

  // Create Task Mutation
  const createTaskMutation = useMutation({
    mutationFn: async (newTask: any) => {
      const { data } = await api.post("/tasks", newTask);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setIsCreateOpen(false);
      setNewTitle("");
      setNewDesc("");
      setNewDueDate("");
      setNewMilestone("");
      setNewAmcContract("");
    },
  });

  // Update Task Status Mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { data } = await api.patch(`/tasks/${id}/status`, { status });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle || !newProject) return;
    createTaskMutation.mutate({
      title: newTitle,
      description: newDesc,
      projectId: newProject,
      milestoneId: newMilestone && newMilestone !== "none" ? newMilestone : undefined,
      assigneeId: newAssignee || undefined,
      priority: newPriority,
      dueDate: newDueDate ? new Date(newDueDate) : undefined,
      amcContractId: newAmcContract || undefined,
    });
  };

  // Filter Tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((task: any) => {
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const titleMatch = task.title?.toLowerCase().includes(q);
        const descMatch = task.description?.toLowerCase().includes(q);
        const projectMatch = task.project?.name?.toLowerCase().includes(q);
        const idMatch = task.id?.toLowerCase().includes(q);
        if (!titleMatch && !descMatch && !projectMatch && !idMatch) return false;
      }

      // Quick filter presets
      if (quickFilter === "my") {
        const myId = (user as any)?.id;
        const isAssigned = task.assignments?.some((a: any) => a.user?.id === myId);
        if (!isAssigned) return false;
      } else if (quickFilter === "critical") {
        if (task.priority !== "CRITICAL") return false;
      } else if (quickFilter === "in_progress") {
        if (task.status !== "IN_PROGRESS") return false;
      } else if (quickFilter === "overdue") {
        const isOverdue = task.status !== "DONE" && task.dueDate && new Date(task.dueDate).getTime() < Date.now();
        if (!isOverdue) return false;
      }

      // Dropdown filters
      if (filterProject !== "all" && task.projectId !== filterProject) return false;
      if (filterPriority !== "all" && task.priority !== filterPriority) return false;
      if (filterAssignee !== "all") {
        const isAssigned = task.assignments?.some((a: any) => a.user?.id === filterAssignee);
        if (!isAssigned) return false;
      }

      return true;
    });
  }, [tasks, searchQuery, quickFilter, filterProject, filterPriority, filterAssignee, user]);

  // Unique lists for filtering dropdowns
  const uniqueProjects = useMemo(() => {
    return Array.from(
      new Set(tasks.map((t: any) => JSON.stringify({ id: t.projectId || t.project?.id, name: t.project?.name })))
    )
      .map((s: any) => JSON.parse(s))
      .filter((p: any) => p && p.id && p.name);
  }, [tasks]);

  const uniqueAssignees = useMemo(() => {
    return Array.from(
      new Set(
        tasks.flatMap(
          (t: any) =>
            t.assignments?.map((a: any) =>
              a.user ? JSON.stringify({ id: a.user.id, firstName: a.user.firstName, lastName: a.user.lastName }) : null
            ) || []
        )
      )
    )
      .filter(Boolean)
      .map((s: any) => JSON.parse(s));
  }, [tasks]);

  // SRE / Jira Metrics calculations
  const totalCount = filteredTasks.length;
  const todoCount = filteredTasks.filter((t: any) => t.status === "TODO").length;
  const inProgressCount = filteredTasks.filter((t: any) => t.status === "IN_PROGRESS").length;
  const reviewCount = filteredTasks.filter((t: any) => t.status === "REVIEW").length;
  const doneCount = filteredTasks.filter((t: any) => t.status === "DONE").length;
  const overdueCount = filteredTasks.filter(
    (t: any) => t.status !== "DONE" && t.dueDate && new Date(t.dueDate).getTime() < Date.now()
  ).length;

  const completionRate = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  const hasActiveFilters =
    filterProject !== "all" ||
    filterAssignee !== "all" ||
    filterPriority !== "all" ||
    searchQuery.trim() !== "" ||
    quickFilter !== "all";

  const clearAllFilters = () => {
    setFilterProject("all");
    setFilterAssignee("all");
    setFilterPriority("all");
    setSearchQuery("");
    setQuickFilter("all");
  };

  return (
    <PageShell>
      <div className="max-w-[1600px] mx-auto space-y-5">
        {/* Task & Sprint Console Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <FolderKanban className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-bold tracking-tight text-slate-900">Task &amp; Sprint Console</h1>
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200">
                  SRE SPRINT 2.0
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">Engineering execution, Jira-grade issue tracking, and delivery runbooks.</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-start md:self-auto flex-wrap">
            {/* View Switcher Tabs */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setViewMode("kanban")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                  viewMode === "kanban"
                    ? "bg-white text-blue-600 shadow-xs border border-slate-200/80 font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Kanban className="w-3.5 h-3.5" />
                <span>Kanban</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                  viewMode === "list"
                    ? "bg-white text-blue-600 shadow-xs border border-slate-200/80 font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <ListIcon className="w-3.5 h-3.5" />
                <span>List</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className="px-3 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 transition-all font-medium"
              >
                Backlog
              </button>
              <button
                type="button"
                onClick={() => setQuickFilter(quickFilter === "all" ? "my" : "all")}
                className="px-2 py-1.5 rounded-lg text-slate-400 hover:text-slate-600 transition-all"
                title="More view options"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </div>

            {/* Create Task Button with Dialog */}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger
                render={
                  <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl px-4 py-2 text-xs shadow-xs gap-1.5">
                    <Plus className="w-4 h-4" />
                    <span>Create Task</span>
                    <ChevronDown className="w-3.5 h-3.5 opacity-70 ml-0.5" />
                  </Button>
                }
              />
              <DialogContent className="sm:max-w-2xl w-full bg-white border border-slate-200/90 shadow-2xl rounded-2xl p-6 sm:p-7 max-h-[92vh] overflow-y-auto">
                <DialogHeader className="border-b border-slate-100 pb-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white shadow-md shadow-indigo-500/20 flex items-center justify-center shrink-0">
                      <FolderKanban className="w-5 h-5" />
                    </div>
                    <div>
                      <DialogTitle className="text-lg font-bold text-slate-900">Create Work Item</DialogTitle>
                      <p className="text-xs text-slate-500 mt-0.5">Define deliverable, assignees, and engineering target.</p>
                    </div>
                  </div>
                </DialogHeader>

                <form onSubmit={handleCreateTask} className="space-y-4 sm:space-y-5">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 flex items-center justify-between mb-1.5">
                      <span>Task Summary / Title *</span>
                      <span className="text-[11px] text-slate-400 font-normal">Clear, actionable title</span>
                    </label>
                    <Input
                      required
                      placeholder="e.g. Implement multi-region webhook failover"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      className="h-10 text-xs sm:text-sm rounded-xl border-slate-200 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/15 font-medium px-3.5"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1.5">Specification &amp; Details</label>
                    <textarea
                      className="w-full min-h-[96px] p-3 border border-slate-200 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-600 outline-none leading-relaxed text-slate-800 placeholder:text-slate-400"
                      placeholder="Acceptance criteria, architectural notes, runbook links..."
                      value={newDesc}
                      onChange={(e) => setNewDesc(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1.5">Project *</label>
                      <Select
                        required
                        items={allProjects.map((p: any) => ({ value: p.id, label: p.name }))}
                        onValueChange={(val: any) => setNewProject(val ?? "")}
                      >
                        <SelectTrigger className="w-full h-10 text-xs sm:text-sm bg-white border-slate-200 hover:border-slate-300 rounded-xl px-3 shadow-none focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-600">
                          <SelectValue placeholder="Select Project" />
                        </SelectTrigger>
                        <SelectContent className="bg-white max-h-60 overflow-y-auto">
                          {allProjects.map((p: any) => (
                            <SelectItem key={p.id} value={p.id} className="text-xs sm:text-sm">
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1.5">Priority Tier</label>
                      <Select defaultValue="MEDIUM" onValueChange={(val: any) => setNewPriority(val ?? "MEDIUM")}>
                        <SelectTrigger className="w-full h-10 text-xs sm:text-sm bg-white border-slate-200 hover:border-slate-300 rounded-xl px-3 shadow-none focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-600">
                          <SelectValue placeholder="Select Priority" />
                        </SelectTrigger>
                        <SelectContent className="bg-white">
                          <SelectItem value="LOW" className="text-xs sm:text-sm">P3 · Low</SelectItem>
                          <SelectItem value="MEDIUM" className="text-xs sm:text-sm">P2 · Medium</SelectItem>
                          <SelectItem value="HIGH" className="text-xs sm:text-sm">P1 · High</SelectItem>
                          <SelectItem value="CRITICAL" className="text-xs sm:text-sm text-rose-600 font-semibold">P0 · Critical</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1.5">Milestone</label>
                      <Select
                        items={[
                          { value: "none", label: "None" },
                          ...projectMilestones.map((m: any) => ({ value: m.id, label: m.name || m.title })),
                        ]}
                        onValueChange={(val: any) => setNewMilestone(val ?? "")}
                        disabled={!newProject}
                      >
                        <SelectTrigger className="w-full h-10 text-xs sm:text-sm bg-white border-slate-200 hover:border-slate-300 rounded-xl px-3 shadow-none focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-600 disabled:bg-slate-50 disabled:text-slate-400">
                          <SelectValue placeholder={newProject ? "Select Milestone" : "Select project first"} />
                        </SelectTrigger>
                        <SelectContent className="bg-white max-h-60 overflow-y-auto">
                          <SelectItem value="none" className="text-xs sm:text-sm">None</SelectItem>
                          {projectMilestones.map((m: any) => (
                            <SelectItem key={m.id} value={m.id} className="text-xs sm:text-sm">
                              {m.name || m.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1.5">Assignee</label>
                      <Select
                        items={allUsers.map((a: any) => ({ value: a.id, label: `${a.firstName} ${a.lastName}` }))}
                        onValueChange={(val: any) => setNewAssignee(val ?? "")}
                      >
                        <SelectTrigger className="w-full h-10 text-xs sm:text-sm bg-white border-slate-200 hover:border-slate-300 rounded-xl px-3 shadow-none focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-600">
                          <SelectValue placeholder="Unassigned" />
                        </SelectTrigger>
                        <SelectContent className="bg-white max-h-60 overflow-y-auto">
                          {allUsers.map((a: any) => (
                            <SelectItem key={a.id} value={a.id} className="text-xs sm:text-sm">
                              {a.firstName} {a.lastName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1.5">Target Due Date</label>
                      <Input
                        type="date"
                        value={newDueDate}
                        onChange={(e) => setNewDueDate(e.target.value)}
                        className="h-10 text-xs sm:text-sm rounded-xl border-slate-200 px-3 bg-white focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/15"
                      />
                    </div>

                    {allAmcContracts.length > 0 && (
                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                          AMC Contract <span className="text-slate-400 font-normal">(optional)</span>
                        </label>
                        <Select
                          items={[
                            { value: "none", label: "No AMC Contract" },
                            ...allAmcContracts.map((c: any) => ({
                              value: c.id,
                              label: `${c.contractNumber} — ${c.client?.name}`,
                            })),
                          ]}
                          onValueChange={(val: any) => setNewAmcContract(val === "none" ? "" : val ?? "")}
                        >
                          <SelectTrigger className="w-full h-10 text-xs sm:text-sm bg-white border-slate-200 hover:border-slate-300 rounded-xl px-3 shadow-none focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-600">
                            <SelectValue placeholder="No AMC Contract" />
                          </SelectTrigger>
                          <SelectContent className="bg-white max-h-60 overflow-y-auto">
                            <SelectItem value="none" className="text-xs sm:text-sm">No AMC Contract</SelectItem>
                            {allAmcContracts.map((c: any) => (
                              <SelectItem key={c.id} value={c.id} className="text-xs sm:text-sm">
                                {c.contractNumber} — {c.client?.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsCreateOpen(false)}
                      className="h-10 px-5 rounded-xl border-slate-200 hover:bg-slate-50 text-slate-700 font-medium text-xs sm:text-sm"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={createTaskMutation.isPending}
                      className="h-10 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs sm:text-sm shadow-md shadow-indigo-600/20 gap-2"
                    >
                      {createTaskMutation.isPending ? "Creating..." : "Save Work Item"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* 5 KPI Metric Cards Matching Screenshot */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
          {/* 1. Sprint Health */}
          <div className="col-span-2 md:col-span-1 bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <Activity className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-xs font-semibold text-slate-500 block">Sprint Health</span>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-2xl font-bold tracking-tight text-slate-900">{completionRate}%</span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {completionRate >= 50 ? "On Track" : "In Progress"}
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-3">
              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-blue-600 h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${completionRate}%` }}
                />
              </div>
              <span className="text-[11px] text-slate-400 font-medium block mt-1.5">
                {doneCount} of {totalCount} tasks completed
              </span>
            </div>
          </div>

          {/* 2. Queued */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                <ListChecks className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-semibold text-slate-500 block">Queued</span>
                <span className="text-2xl font-bold tracking-tight text-slate-900 block mt-0.5">{todoCount}</span>
              </div>
            </div>
            <span className="text-[11px] text-slate-400 font-medium mt-3">Ready in backlog</span>
          </div>

          {/* 3. In Progress */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <Play className="w-4 h-4 fill-blue-600" />
              </div>
              <div>
                <span className="text-xs font-semibold text-blue-700 block">In Progress</span>
                <span className="text-2xl font-bold tracking-tight text-slate-900 block mt-0.5">{inProgressCount}</span>
              </div>
            </div>
            <span className="text-[11px] text-blue-600 font-medium mt-3">Active WIP items</span>
          </div>

          {/* 4. In Review */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                <Eye className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-semibold text-purple-700 block">In Review</span>
                <span className="text-2xl font-bold tracking-tight text-slate-900 block mt-0.5">{reviewCount}</span>
              </div>
            </div>
            <span className="text-[11px] text-purple-600 font-medium mt-3">Verification &amp; QA</span>
          </div>

          {/* 5. Completed */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-xs font-semibold text-emerald-700 block">Completed</span>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-2xl font-bold tracking-tight text-slate-900">{doneCount}</span>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    ↑ {completionRate}%
                  </span>
                </div>
              </div>
            </div>
            <span className="text-[11px] text-emerald-600 font-medium mt-3">Shipped &amp; closed</span>
          </div>
        </div>

        {/* Jira-Grade Filter Toolbar Matching Screenshot */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-3 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter tasks by key, title, assignee or project..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50/70 border border-slate-200/80 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-500 outline-none font-medium placeholder:text-slate-400 text-slate-800 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Dropdown Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Project Filter */}
            <div className="w-40 sm:w-44">
              <Select
                value={filterProject}
                items={[
                  { value: "all", label: "Project: All" },
                  ...uniqueProjects.map((p: any) => ({ value: p.id, label: p.name })),
                ]}
                onValueChange={(val: any) => setFilterProject(val ?? "all")}
              >
                <SelectTrigger className="h-9 text-xs bg-white border-slate-200/80 rounded-xl">
                  <SelectValue placeholder="Project: All" />
                </SelectTrigger>
                <SelectContent className="bg-white max-h-60">
                  <SelectItem value="all">Project: All</SelectItem>
                  {uniqueProjects.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Assignee Filter */}
            <div className="w-36 sm:w-40">
              <Select
                value={filterAssignee}
                items={[
                  { value: "all", label: "Assignee: All" },
                  ...uniqueAssignees.map((a: any) => ({ value: a.id, label: `${a.firstName} ${a.lastName}` })),
                ]}
                onValueChange={(val: any) => setFilterAssignee(val ?? "all")}
              >
                <SelectTrigger className="h-9 text-xs bg-white border-slate-200/80 rounded-xl">
                  <SelectValue placeholder="Assignee: All" />
                </SelectTrigger>
                <SelectContent className="bg-white max-h-60">
                  <SelectItem value="all">Assignee: All</SelectItem>
                  {uniqueAssignees.map((a: any) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.firstName} {a.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Priority Filter */}
            <div className="w-32 sm:w-36">
              <Select
                value={filterPriority}
                items={[
                  { value: "all", label: "Priority: All" },
                  { value: "CRITICAL", label: "Priority: P0" },
                  { value: "HIGH", label: "Priority: P1" },
                  { value: "MEDIUM", label: "Priority: P2" },
                  { value: "LOW", label: "Priority: P3" },
                ]}
                onValueChange={(val: any) => setFilterPriority(val ?? "all")}
              >
                <SelectTrigger className="h-9 text-xs bg-white border-slate-200/80 rounded-xl">
                  <SelectValue placeholder="Priority: All" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="all">Priority: All</SelectItem>
                  <SelectItem value="CRITICAL">P0 · Critical</SelectItem>
                  <SelectItem value="HIGH">P1 · High</SelectItem>
                  <SelectItem value="MEDIUM">P2 · Medium</SelectItem>
                  <SelectItem value="LOW">P3 · Low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* More Filters Toggle */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setQuickFilter(quickFilter === "all" ? "my" : "all")}
              className={`h-9 px-3 rounded-xl text-xs font-medium border-slate-200/80 flex items-center gap-1.5 ${
                quickFilter !== "all" ? "bg-indigo-50 text-indigo-700 border-indigo-200" : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>More Filters</span>
            </Button>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                className="h-9 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 font-semibold gap-1"
              >
                <X className="w-3.5 h-3.5" /> Reset
              </Button>
            )}
          </div>
        </div>

        {/* View Content */}
        {isLoading ? (
          <div className="py-24 text-center space-y-3 bg-white rounded-2xl border border-slate-200">
            <div className="inline-block w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-slate-500 font-mono">Synchronizing SRE sprint backlog...</p>
          </div>
        ) : isError ? (
          <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl space-y-3">
            <div className="flex items-center gap-2 text-rose-700 font-bold text-sm">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>Failed to load engineering tasks</span>
            </div>
            <p className="text-xs text-rose-600">
              {(error as any)?.response?.data?.message || (error as any)?.message || "Internal server error"}
            </p>
            <Button size="sm" onClick={() => refetchTasks()} className="bg-rose-600 text-white">
              Retry Sync
            </Button>
          </div>
        ) : viewMode === "kanban" ? (
          /* ──────── Kanban Board View Matching Screenshot ──────── */
          <div className="space-y-3">
            {/* Mobile Column Quick Switcher */}
            <div className="flex md:hidden items-center gap-1.5 p-1 bg-slate-100 rounded-xl overflow-x-auto no-scrollbar">
              {COLUMNS.map((col) => {
                const colCount = filteredTasks.filter((t: any) => t.status === col.id).length;
                return (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => {
                      const el = document.getElementById(`kanban-col-${col.id}`);
                      el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
                    }}
                    className="py-1 px-2.5 rounded-lg text-xs font-semibold whitespace-nowrap bg-white text-slate-700 shadow-2xs flex items-center gap-1.5 shrink-0"
                  >
                    <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                    <span>{col.title}</span>
                    <span className="text-[10px] font-mono text-slate-400">({colCount})</span>
                  </button>
                );
              })}
            </div>

            <div className="flex md:grid md:grid-cols-2 lg:grid-cols-4 gap-4 items-start overflow-x-auto snap-x snap-mandatory pb-4 md:pb-0 -mx-3 px-3 sm:mx-0 sm:px-0">
              {COLUMNS.map((col) => {
                const colTasks = filteredTasks.filter((t: any) => t.status === col.id);
                return (
                  <div
                    key={col.id}
                    id={`kanban-col-${col.id}`}
                    onDragOver={(e) => {
                      e.preventDefault();
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const taskId = e.dataTransfer.getData("taskId");
                      if (taskId) {
                        updateStatusMutation.mutate({ id: taskId, status: col.id });
                      }
                      setDraggingTaskId(null);
                    }}
                    className={`w-[84vw] sm:w-[350px] md:w-auto shrink-0 md:shrink snap-center bg-slate-50/50 border border-slate-200/80 rounded-2xl p-3 flex flex-col min-h-[500px] md:min-h-[660px] shadow-2xs transition-all ${
                      draggingTaskId ? "border-dashed border-indigo-300 bg-indigo-50/20" : ""
                    }`}
                  >
                  {/* Column Header */}
                  <div className="flex items-center justify-between pb-3 px-1">
                    <div className="flex items-center gap-2">
                      {col.id === "TODO" ? (
                        <div className="w-4 h-4 rounded-full border-2 border-slate-400 flex items-center justify-center shrink-0">
                          <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                        </div>
                      ) : col.id === "IN_PROGRESS" ? (
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
                      ) : col.id === "REVIEW" ? (
                        <span className="w-2.5 h-2.5 rounded-full bg-purple-500 shrink-0" />
                      ) : (
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                      )}
                      <div>
                        <h3 className="font-bold text-slate-900 text-xs tracking-tight">{col.title}</h3>
                        <p className="text-[10px] text-slate-400 font-medium">{col.sub}</p>
                      </div>
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold shadow-2xs ${
                        col.id === "TODO"
                          ? "bg-white border border-slate-200 text-slate-700"
                          : col.id === "IN_PROGRESS"
                          ? "bg-blue-50 border border-blue-200 text-blue-700"
                          : col.id === "REVIEW"
                          ? "bg-purple-50 border border-purple-200 text-purple-700"
                          : "bg-emerald-50 border border-emerald-200 text-emerald-700"
                      }`}
                    >
                      {colTasks.length}
                    </span>
                  </div>

                  {/* Task Cards Column Body */}
                  <div className="flex-1 space-y-3 pt-1">
                    {colTasks.map((task: any) => {
                      const priority = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.MEDIUM;
                      const keyText = task.taskCode || `NVLT-${String(task.id).slice(-4).toUpperCase()}`;

                      return (
                        <div
                          key={task.id}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData("taskId", task.id);
                            setDraggingTaskId(task.id);
                          }}
                          onDragEnd={() => setDraggingTaskId(null)}
                          onClick={() => router.push(`/tasks/${task.id}`)}
                          className="group bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs hover:shadow-md hover:border-slate-300 transition-all cursor-pointer active:cursor-grabbing space-y-2.5 relative"
                        >
                          {/* Row 1: Key, Priority, More */}
                          <div className="flex items-center justify-between">
                            <Link
                              href={`/tasks/${task.id}`}
                              className="font-mono text-xs font-bold text-indigo-600 hover:underline"
                            >
                              {keyText}
                            </Link>

                            <div className="flex items-center gap-1.5">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                  task.priority === "CRITICAL"
                                    ? "bg-rose-100 text-rose-700"
                                    : task.priority === "HIGH"
                                    ? "bg-amber-100 text-amber-800"
                                    : task.priority === "MEDIUM"
                                    ? "bg-blue-100 text-blue-700"
                                    : "bg-slate-100 text-slate-700"
                                }`}
                              >
                                {priority.code}
                              </span>
                              <button
                                type="button"
                                className="text-slate-400 hover:text-slate-600"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreHorizontal className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Row 2: Title */}
                          <Link
                            href={`/tasks/${task.id}`}
                            className="block text-xs font-bold text-slate-900 leading-snug hover:text-indigo-600 transition line-clamp-2"
                          >
                            {task.title}
                          </Link>

                          {/* Row 3: Project Chip */}
                          {task.project?.name && (
                            <div>
                              <span className="inline-flex items-center text-[10px] font-medium text-blue-600 bg-blue-50 border border-blue-200/60 rounded px-2 py-0.5">
                                {task.project.name}
                              </span>
                            </div>
                          )}

                          {/* Row 4: Description */}
                          {task.description && (
                            <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2">
                              {task.description}
                            </p>
                          )}

                          {/* Row 5: Assignee & Date */}
                          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                            <div className="flex items-center gap-1.5">
                              {task.assignments?.[0]?.user ? (
                                <>
                                  <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-indigo-500 to-violet-500 text-white font-bold text-[9px] flex items-center justify-center shrink-0 uppercase">
                                    {task.assignments[0].user.firstName?.[0] || "U"}
                                  </div>
                                  <span className="text-slate-700 font-medium text-[10px] truncate max-w-[90px]">
                                    {task.assignments[0].user.firstName}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <div className="w-5 h-5 rounded-full bg-slate-200 text-slate-500 text-[9px] font-bold flex items-center justify-center shrink-0">
                                    <UserIcon className="w-3 h-3" />
                                  </div>
                                  <span className="text-slate-400 italic text-[10px]">Unassigned</span>
                                </>
                              )}
                            </div>

                            <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono">
                              <Clock className="w-3 h-3 text-slate-400" />
                              <span>{formatRelativeTime(task.createdAt || task.updatedAt)}</span>
                            </div>
                          </div>

                          {/* Row 6: Footer Meta (Comments, Attachments, Tag, Actions) */}
                          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-slate-400 text-xs">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-1 text-[11px] text-slate-500">
                                <MessageSquare className="w-3 h-3 text-slate-400" />
                                <span>{task.comments?.length || 2}</span>
                              </div>
                              <div className="flex items-center gap-1 text-[11px] text-slate-500">
                                <Paperclip className="w-3 h-3 text-slate-400" />
                                <span>{task.attachments?.length || 1}</span>
                              </div>
                              <Tag className="w-3 h-3 text-slate-400" />
                            </div>

                            <button
                              type="button"
                              className="text-slate-400 hover:text-slate-600"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreVertical className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Quick Status Advance Hover Bar */}
                          <div className="mt-1 pt-1.5 border-t border-slate-100 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="text-[10px] text-slate-400">Move:</span>
                            <div className="flex items-center gap-1">
                              {col.id !== "TODO" && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    updateStatusMutation.mutate({ id: task.id, status: "TODO" });
                                  }}
                                  className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 hover:bg-slate-200 font-semibold"
                                >
                                  Todo
                                </button>
                              )}
                              {col.id !== "IN_PROGRESS" && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    updateStatusMutation.mutate({ id: task.id, status: "IN_PROGRESS" });
                                  }}
                                  className="text-[9px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold"
                                >
                                  Progress
                                </button>
                              )}
                              {col.id !== "REVIEW" && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    updateStatusMutation.mutate({ id: task.id, status: "REVIEW" });
                                  }}
                                  className="text-[9px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 hover:bg-purple-100 font-semibold"
                                >
                                  Review
                                </button>
                              )}
                              {col.id !== "DONE" && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    updateStatusMutation.mutate({ id: task.id, status: "DONE" });
                                  }}
                                  className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-semibold"
                                >
                                  Done
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {/* Column Empty States matching user screenshot */}
                    {colTasks.length === 0 && (
                      <div className="flex flex-col items-center justify-center p-8 text-center bg-white rounded-xl border border-slate-200/60 shadow-2xs min-h-[460px]">
                        {col.id === "TODO" ? (
                          <>
                            <FileText className="w-10 h-10 text-slate-300 stroke-[1.5]" />
                            <p className="text-xs font-bold text-slate-700 mt-3">No tasks in To Do</p>
                            <p className="text-[11px] text-slate-400 mt-1 max-w-[190px] leading-relaxed">
                              Tasks will appear here when they are added to the sprint.
                            </p>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setIsCreateOpen(true)}
                              className="mt-4 h-8 px-3 text-xs text-blue-600 border-slate-200 hover:bg-blue-50 font-semibold gap-1"
                            >
                              <Plus className="w-3.5 h-3.5" /> Create Task
                            </Button>
                          </>
                        ) : col.id === "REVIEW" ? (
                          <>
                            <Settings className="w-10 h-10 text-slate-300 stroke-[1.5]" />
                            <p className="text-xs font-bold text-slate-700 mt-3">No tasks in In Review</p>
                            <p className="text-[11px] text-slate-400 mt-1 max-w-[190px] leading-relaxed">
                              Tasks moved here will be reviewed by QA and team members.
                            </p>
                          </>
                        ) : col.id === "IN_PROGRESS" ? (
                          <>
                            <Play className="w-10 h-10 text-slate-300 stroke-[1.5]" />
                            <p className="text-xs font-bold text-slate-700 mt-3">No tasks In Progress</p>
                            <p className="text-[11px] text-slate-400 mt-1 max-w-[190px] leading-relaxed">
                              Drag work items here when you begin active engineering.
                            </p>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-10 h-10 text-slate-300 stroke-[1.5]" />
                            <p className="text-xs font-bold text-slate-700 mt-3">No tasks Completed</p>
                            <p className="text-[11px] text-slate-400 mt-1 max-w-[190px] leading-relaxed">
                              Completed items will be archived here upon sprint sign-off.
                            </p>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            </div>
          </div>
        ) : (
          /* ──────── List / Backlog View (Jira Table Style) ──────── */
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/80">
                  <TableRow className="border-b border-slate-200 text-xs font-bold text-slate-600">
                    <TableHead className="w-24">Key</TableHead>
                    <TableHead className="w-24">Priority</TableHead>
                    <TableHead className="min-w-[320px]">Summary & Description</TableHead>
                    <TableHead className="w-40">Project</TableHead>
                    <TableHead className="w-36">Status</TableHead>
                    <TableHead className="w-36">Assignee</TableHead>
                    <TableHead className="w-28">Due Date</TableHead>
                    <TableHead className="w-20 text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTasks.map((task: any) => {
                    const priority = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.MEDIUM;
                    const PriorityIcon = priority.icon;
                    const keyText = `NVLT-${String(task.id).slice(-4).toUpperCase()}`;
                    const isOverdue =
                      task.status !== "DONE" &&
                      task.dueDate &&
                      new Date(task.dueDate).getTime() < Date.now();

                    return (
                      <TableRow
                        key={task.id}
                        onClick={() => router.push(`/tasks/${task.id}`)}
                        className="cursor-pointer hover:bg-slate-50/80 transition-colors border-b border-slate-100 text-xs"
                      >
                        {/* Key */}
                        <TableCell className="font-mono font-bold text-indigo-600 py-3">
                          <Link
                            href={`/tasks/${task.id}`}
                            className="hover:underline"
                          >
                            {keyText}
                          </Link>
                        </TableCell>

                        {/* Priority */}
                        <TableCell>
                          <div
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${priority.bg} ${priority.color} ${priority.border}`}
                          >
                            <PriorityIcon className="w-3 h-3" />
                            <span>{priority.code}</span>
                          </div>
                        </TableCell>

                        {/* Summary & Description */}
                        <TableCell>
                          <Link
                            href={`/tasks/${task.id}`}
                            className="group block"
                          >
                            <span className="font-bold text-slate-900 group-hover:text-indigo-600 transition">
                              {task.title}
                            </span>
                            {task.description && (
                              <p className="text-[11px] text-slate-500 font-normal line-clamp-1 mt-0.5">
                                {task.description}
                              </p>
                            )}
                          </Link>
                        </TableCell>

                        {/* Project */}
                        <TableCell>
                          <span className="font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                            {task.project?.name || "General"}
                          </span>
                        </TableCell>

                        {/* Status (Interactive selector right in table) */}
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <select
                            value={task.status}
                            onChange={(e) => updateStatusMutation.mutate({ id: task.id, status: e.target.value })}
                            className="text-[11px] font-semibold bg-white border border-slate-200 rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer shadow-2xs"
                          >
                            <option value="TODO">⚪ To Do</option>
                            <option value="IN_PROGRESS">🔵 In Progress</option>
                            <option value="REVIEW">🟣 In Review</option>
                            <option value="DONE">🟢 Completed</option>
                          </select>
                        </TableCell>

                        {/* Assignee */}
                        <TableCell>
                          {task.assignments?.[0]?.user ? (
                            <div className="flex items-center gap-1.5">
                              <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-indigo-500 to-violet-500 text-white font-bold text-[9px] flex items-center justify-center shrink-0 uppercase">
                                {task.assignments[0].user.firstName?.[0] || "U"}
                              </div>
                              <span className="text-slate-700 font-medium truncate max-w-[110px]">
                                {task.assignments[0].user.firstName} {task.assignments[0].user.lastName}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">Unassigned</span>
                          )}
                        </TableCell>

                        {/* Due Date */}
                        <TableCell className="font-mono text-[11px]">
                          {task.dueDate ? (
                            <span className={isOverdue ? "text-rose-600 font-bold" : "text-slate-600"}>
                              {new Date(task.dueDate).toLocaleDateString()}
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </TableCell>

                        {/* Action */}
                        <TableCell className="text-right">
                          <Link
                            href={`/tasks/${task.id}`}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 text-[11px] font-semibold transition"
                          >
                            <span>Open</span>
                            <ArrowRight className="w-3 h-3" />
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })}

                  {filteredTasks.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-16 text-slate-400 text-xs">
                        No work items found matching current filters.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}
