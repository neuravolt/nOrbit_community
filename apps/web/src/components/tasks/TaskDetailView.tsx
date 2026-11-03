"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { useUsers, useUploadAttachment } from "../../hooks/queries";
import { useAuthStore } from "../../store/auth";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import {
  CheckSquare,
  Clock,
  MessageSquare,
  Paperclip,
  Send,
  Plus,
  Trash2,
  ChevronRight,
  ArrowLeft,
  Calendar,
  User as UserIcon,
  Flame,
  ChevronUp,
  ChevronDown,
  Equal,
  Play,
  Pause,
  RotateCcw,
  AlertCircle,
  Check,
  GitBranch,
  GitPullRequest,
  GitCommit,
  ExternalLink,
  Copy,
  Edit,
  X,
  MoreHorizontal,
  UploadCloud,
  FileText,
  Download,
  FolderOpen,
  Sparkles,
} from "lucide-react";

function GithubIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  );
}

const PRIORITY_CONFIG: Record<
  string,
  { label: string; code: string; color: string; bg: string; border: string; icon: any }
> = {
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

const STATUS_CONFIG: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  TODO: { label: "To Do / Queued", dot: "bg-slate-400", bg: "bg-slate-100", text: "text-slate-700" },
  IN_PROGRESS: { label: "In Progress", dot: "bg-blue-500", bg: "bg-blue-50", text: "text-blue-700" },
  REVIEW: { label: "In Review", dot: "bg-purple-500", bg: "bg-purple-50", text: "text-purple-700" },
  DONE: { label: "Completed", dot: "bg-emerald-500", bg: "bg-emerald-50", text: "text-emerald-700" },
};

function parseDescriptionAndCriteria(raw?: string | null) {
  if (!raw) return { description: "", criteria: [] as string[] };
  const parts = raw.split(/Acceptance Criteria(?:\s*\(optional\))?:?/i);
  const mainDesc = parts[0]?.trim() || "";
  const criteriaText = parts[1]?.trim() || "";
  const criteria = criteriaText
    ? criteriaText
        .split("\n")
        .map((l) => l.replace(/^[-*•\d.]+\s*/, "").trim())
        .filter(Boolean)
    : [];
  return { description: mainDesc, criteria };
}

function parseSubtaskTag(title: string) {
  const match = title.match(/^\[(Analysis|Development|Testing|Design|Review|Bug)\]\s*(.*)$/i);
  if (match) {
    return { tag: match[1], cleanTitle: match[2] };
  }
  const lower = title.toLowerCase();
  if (lower.includes("test") || lower.includes("qa") || lower.includes("verify")) {
    return { tag: "Testing", cleanTitle: title };
  }
  if (lower.includes("analyze") || lower.includes("flow") || lower.includes("spec") || lower.includes("research")) {
    return { tag: "Analysis", cleanTitle: title };
  }
  return { tag: "Development", cleanTitle: title };
}

interface GitCommitItem {
  sha: string;
  url: string;
  message: string;
}

interface GitActivityData {
  branch: string;
  commits: GitCommitItem[];
}

function parseGitActivityComment(content: string): GitActivityData | null {
  if (!content || (!content.includes("Code pushed to branch") && !content.includes("📦"))) {
    return null;
  }

  // Match branch name (e.g. `main` or `task/dsweb-1...`)
  const branchMatch = content.match(/branch\s+[`"']?([a-zA-Z0-9_\-\/\.]+)`?/i);
  const branch = branchMatch ? branchMatch[1] : "main";

  // Match commits format: • [`ca33c27`](url) message OR [`ca33c27`](url) message
  const commits: GitCommitItem[] = [];
  const lines = content.split("\n");

  for (const line of lines) {
    const commitMatch = line.match(/\[`?([a-f0-9]{6,40})`?\]\((https?:\/\/[^\s\)]+)\)\s*(.*)/i);
    if (commitMatch) {
      commits.push({
        sha: commitMatch[1].slice(0, 7),
        url: commitMatch[2],
        message: commitMatch[3].trim() || "Commit update",
      });
    }
  }

  return {
    branch,
    commits,
  };
}

function renderFormattedContent(text: string) {
  if (!text) return null;

  // Split by markdown link pattern: [label](url)
  const parts: (string | React.ReactNode)[] = [];
  const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    const label = match[1];
    const url = match[2];
    parts.push(
      <a
        key={match.index}
        href={url}
        target="_blank"
        rel="noreferrer"
        className="text-blue-600 hover:text-blue-700 underline font-medium inline-flex items-center gap-0.5"
      >
        <span>{label}</span>
        <ExternalLink className="w-2.5 h-2.5 opacity-60 inline" />
      </a>
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  // Format code blocks / backticks and bold text
  return parts.map((part, i) => {
    if (typeof part !== "string") return part;

    const subParts = part.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    return subParts.map((sub, j) => {
      if (sub.startsWith("**") && sub.endsWith("**")) {
        return (
          <strong key={`${i}-${j}`} className="font-bold text-slate-900">
            {sub.slice(2, -2)}
          </strong>
        );
      }
      if (sub.startsWith("`") && sub.endsWith("`")) {
        return (
          <code
            key={`${i}-${j}`}
            className="font-mono text-[11px] bg-slate-100 text-slate-800 px-1 py-0.5 rounded border border-slate-200"
          >
            {sub.slice(1, -1)}
          </code>
        );
      }
      return sub;
    });
  });
}

export interface TaskDetailViewProps {
  taskId: string;
  onClose?: () => void;
  isModal?: boolean;
}

export function TaskDetailView({ taskId, onClose, isModal = false }: TaskDetailViewProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const uploadAttachment = useUploadAttachment();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Active top-level tab
  const [topTab, setTopTab] = useState<"details" | "checklist" | "discussion" | "logs" | "attachments">("details");

  // Interactive local states
  const [newComment, setNewComment] = useState("");
  const [logHours, setLogHours] = useState("");
  const [logDesc, setLogDesc] = useState("");
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [newSubtaskTag, setNewSubtaskTag] = useState("Development");
  const [copiedBranch, setCopiedBranch] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [editDescValue, setEditDescValue] = useState("");
  const [editCriteriaValue, setEditCriteriaValue] = useState("");
  const [isAssigneeOpen, setIsAssigneeOpen] = useState(false);

  // Stopwatch effect
  useEffect(() => {
    let interval: any = null;
    if (timerRunning) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => {
          const next = prev + 1;
          const hrs = (next / 3600).toFixed(2);
          setLogHours(hrs);
          return next;
        });
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [timerRunning]);

  const formatTimer = (totalSecs: number) => {
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Queries
  const {
    data: task,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["task", taskId],
    queryFn: async () => {
      const { data } = await api.get(`/tasks/${taskId}`);
      return data;
    },
    enabled: !!taskId,
  });

  const { data: usersData } = useUsers();
  const usersList = usersData?.users || [];

  // Mutations
  const updateTaskMutation = useMutation({
    mutationFn: async (payload: any) => {
      const { data } = await api.patch(`/tasks/${taskId}`, payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task", taskId] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setIsEditingDesc(false);
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      const { data } = await api.patch(`/tasks/${taskId}/status`, { status });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task", taskId] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  const updatePriorityMutation = useMutation({
    mutationFn: async (priority: string) => {
      const { data } = await api.patch(`/tasks/${taskId}`, { priority });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task", taskId] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  const assignUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { data } = await api.post(`/tasks/${taskId}/assignments`, { userIds: [userId] });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task", taskId] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setIsAssigneeOpen(false);
    },
  });

  const unassignUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      await api.delete(`/tasks/${taskId}/assignments/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task", taskId] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/tasks/${taskId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      if (onClose) {
        onClose();
      } else {
        router.push("/tasks");
      }
    },
  });

  const createSubtaskMutation = useMutation({
    mutationFn: async ({ title, tag }: { title: string; tag: string }) => {
      const prefixedTitle = `[${tag}] ${title}`;
      const { data } = await api.post("/tasks", {
        title: prefixedTitle,
        parentId: taskId,
        projectId: task?.projectId,
        priority: "MEDIUM",
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task", taskId] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setNewSubtaskTitle("");
    },
  });

  const toggleSubtaskStatusMutation = useMutation({
    mutationFn: async ({ subtaskId, status }: { subtaskId: string; status: string }) => {
      const { data } = await api.patch(`/tasks/${subtaskId}/status`, { status });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task", taskId] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  const deleteSubtaskMutation = useMutation({
    mutationFn: async (subtaskId: string) => {
      await api.delete(`/tasks/${subtaskId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task", taskId] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  const addCommentMutation = useMutation({
    mutationFn: async (payload: { content: string }) => {
      const { data } = await api.post(`/tasks/${taskId}/comments`, payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task", taskId] });
      setNewComment("");
    },
  });

  const logTimeMutation = useMutation({
    mutationFn: async (payload: { hours: number; description: string; date: string }) => {
      const { data } = await api.post(`/tasks/${taskId}/time-logs`, payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task", taskId] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setLogHours("");
      setLogDesc("");
      setTimerRunning(false);
      setTimerSeconds(0);
    },
  });

  // Init edit description when task loads
  useEffect(() => {
    if (task) {
      const { description, criteria } = parseDescriptionAndCriteria(task.description);
      setEditDescValue(description);
      setEditCriteriaValue(criteria.join("\n"));
    }
  }, [task]);

  const handleSaveDescription = () => {
    let combined = editDescValue.trim();
    if (editCriteriaValue.trim()) {
      const bulleted = editCriteriaValue
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => (l.startsWith("•") || l.startsWith("-") ? l : `• ${l}`))
        .join("\n");
      combined += `\n\nAcceptance Criteria (optional):\n${bulleted}`;
    }
    updateTaskMutation.mutate({ description: combined });
  };

  const handleAddSubtaskSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtaskTitle.trim() || !task) return;
    createSubtaskMutation.mutate({ title: newSubtaskTitle.trim(), tag: newSubtaskTag });
  };

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    addCommentMutation.mutate({ content: newComment.trim() });
  };

  const handleLogTimeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!logHours) return;
    logTimeMutation.mutate({
      hours: Number(logHours),
      description: logDesc,
      date: new Date().toISOString(),
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32 bg-white rounded-2xl">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-semibold text-slate-500">Loading task details...</p>
        </div>
      </div>
    );
  }

  if (isError || !task) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl space-y-4">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
        <h3 className="text-sm font-bold text-slate-900">Task Not Found</h3>
        <p className="text-xs text-slate-500">The task may have been removed or deleted.</p>
        {onClose ? (
          <Button onClick={onClose} size="sm" variant="outline">
            Close
          </Button>
        ) : (
          <Button onClick={() => router.push("/tasks")} size="sm" variant="outline">
            Return to Tasks
          </Button>
        )}
      </div>
    );
  }

  const priority = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.MEDIUM;
  const PriorityIcon = priority.icon;
  const displayKey = task.taskCode || `NVLT-${String(task.id).slice(-4).toUpperCase()}`;
  const subtasksList = task.subtasks || [];
  const completedSubtasksCount = subtasksList.filter((st: any) => st.status === "DONE").length;
  const subtaskProgress =
    subtasksList.length > 0 ? Math.round((completedSubtasksCount / subtasksList.length) * 100) : 0;
  const totalLoggedHours = (task.timeLogs || []).reduce((acc: number, curr: any) => acc + Number(curr.hours || 0), 0);
  const primaryAssignee = task.assignments?.[0]?.user;
  const { description: parsedDesc, criteria: parsedCriteria } = parseDescriptionAndCriteria(task.description);

  const branchSlug = task.title
    ? task.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 30)
    : "work-item";
  const suggestedBranch = `task/${displayKey.toLowerCase()}-${branchSlug}`;
  const gitCheckoutCmd = `git checkout -b ${suggestedBranch}`;

  const handleCopyAiPrompt = () => {
    const repoName = task.project?.githubRepo?.split("/")[1] || task.project?.githubRepo || "repository";
    const promptText = `You are an expert engineer working on task [${displayKey}] in repository "${repoName}".

### 📌 Task Overview:
- Ticket ID: ${displayKey}
- Title: ${task.title}
- Priority: ${task.priority || "MEDIUM"}
- Description: ${parsedDesc || task.description || "Implement requested updates according to task scope."}
${parsedCriteria && parsedCriteria.length > 0 ? `\n### ✅ Acceptance Criteria:\n${parsedCriteria.map((c: string) => `- [ ] ${c}`).join('\n')}` : ""}

### 🌿 Git & Workflow Protocol:
1. Sync latest main and switch to task branch:
   \`git checkout main && git pull origin main && git checkout -b ${suggestedBranch}\`

2. Commit Convention (MANDATORY for NeuraVolt OS tracking):
   Include the ticket ID in every commit message so NeuraVolt OS auto-links your commits and updates task status:
   \`git commit -m "feat(${displayKey}): <summary of change>"\`

3. Quality Check:
   Run build and lint checks locally to ensure zero regressions before pushing.

4. Push & Open Pull Request:
   \`git push -u origin ${suggestedBranch}\`
   Open a Pull Request targeting 'main' with title:
   \`[${displayKey}] ${task.title}\`
   (Note: 'main' is protected — all changes must be merged via PR review).`;

    navigator.clipboard.writeText(promptText);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  const userInitials = user?.firstName
    ? `${user.firstName[0]}${user.lastName ? user.lastName[0] : ""}`.toUpperCase()
    : "SA";

  return (
    <div className="bg-[#f8fafc] text-slate-900 font-sans min-h-full">
      {/* ── Header Bar: Breadcrumb + Action Controls ── */}
      <div className="flex items-center justify-between gap-3 px-3.5 sm:px-6 py-3 sm:py-4 bg-white border-b border-slate-200/80 sticky top-0 z-20">
        <div className="flex items-center gap-1.5 sm:gap-2 text-xs text-slate-500 font-medium min-w-0">
          {onClose ? (
            <button
              onClick={onClose}
              className="inline-flex items-center gap-1 text-slate-600 hover:text-indigo-600 font-semibold transition shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
          ) : (
            <Link
              href="/tasks"
              className="inline-flex items-center gap-1 text-slate-600 hover:text-indigo-600 font-semibold transition shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </Link>
          )}
          <ChevronRight className="w-3.5 h-3.5 text-slate-400 hidden sm:inline shrink-0" />
          <span className="text-slate-600 font-medium hidden sm:inline">Backlog</span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400 hidden md:inline shrink-0" />
          <span className="text-slate-600 font-medium hidden md:inline truncate max-w-[120px]">{task.project?.name || "General"}</span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="font-mono font-bold text-indigo-600 truncate">{displayKey}</span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(`/tasks/${task.id}`, "_blank")}
            className="h-8 px-2 sm:px-3 text-xs font-medium text-slate-700 border-slate-200 hover:bg-slate-50 gap-1.5"
            title="Open in standalone tab"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Open in New Tab</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            disabled={deleteTaskMutation.isPending}
            onClick={() => {
              if (confirm(`Are you sure you want to delete task "${displayKey}"?`)) {
                deleteTaskMutation.mutate();
              }
            }}
            className="h-8 px-2 sm:px-3 text-xs font-medium text-rose-600 border-rose-200 hover:text-rose-700 hover:bg-rose-50 gap-1.5"
            title="Delete Item"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Delete</span>
          </Button>

          {isModal && onClose && (
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0 text-slate-500 hover:text-slate-800 border-slate-200"
              title="Close window"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-3.5 sm:p-6 space-y-5 sm:space-y-6">
        {/* ── Task Hero Header ── */}
        <div className="space-y-3">
          {/* Key pill + Status pill dropdown + Priority pill dropdown */}
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-2.5 py-1 rounded-md">
              {displayKey}
            </span>

            {/* Status Dropdown Pill */}
            <div className="relative inline-flex items-center">
              <select
                value={task.status}
                onChange={(e) => updateStatusMutation.mutate(e.target.value)}
                disabled={updateStatusMutation.isPending}
                aria-label="Task Status"
                className={`text-xs font-bold rounded-lg pl-3 pr-7 py-1 outline-none border cursor-pointer transition shadow-2xs appearance-none ${
                  task.status === "DONE"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                    : task.status === "REVIEW"
                    ? "bg-purple-50 text-purple-700 border-purple-300"
                    : task.status === "IN_PROGRESS"
                    ? "bg-blue-50 text-blue-700 border-blue-300"
                    : "bg-slate-100 text-slate-700 border-slate-300"
                }`}
              >
                <option value="TODO">⚪ To Do / Queued</option>
                <option value="IN_PROGRESS">🔵 In Progress</option>
                <option value="REVIEW">🟣 In Review</option>
                <option value="DONE">🟢 Completed</option>
              </select>
              <ChevronDown className="w-3 h-3 text-slate-500 absolute right-2 pointer-events-none" />
            </div>

            {/* Priority Dropdown Pill */}
            <div className="relative inline-flex items-center">
              <select
                value={task.priority}
                onChange={(e) => updatePriorityMutation.mutate(e.target.value)}
                disabled={updatePriorityMutation.isPending}
                aria-label="Task Priority"
                className={`text-xs font-bold rounded-lg pl-3 pr-7 py-1 outline-none border cursor-pointer transition shadow-2xs appearance-none ${priority.bg} ${priority.color} ${priority.border}`}
              >
                <option value="CRITICAL">🔥 P0 · Critical</option>
                <option value="HIGH">▲ P1 · High</option>
                <option value="MEDIUM">〓 P2 · Medium</option>
                <option value="LOW">▼ P3 · Low</option>
              </select>
              <ChevronDown className="w-3 h-3 text-slate-500 absolute right-2 pointer-events-none" />
            </div>
          </div>

          {/* Large Task Title */}
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 leading-tight">
            {task.title}
          </h1>

          {/* Subtitle Meta Chips */}
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
            {task.project?.name && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium text-blue-700 bg-blue-50 border border-blue-200/60">
                <FolderOpen className="w-3.5 h-3.5 text-blue-600" />
                <span>{task.project.name}</span>
              </span>
            )}

            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium text-slate-600 bg-white border border-slate-200">
              <UserIcon className="w-3.5 h-3.5 text-slate-400" />
              <span>
                {primaryAssignee
                  ? `${primaryAssignee.firstName} ${primaryAssignee.lastName || ""}`.trim()
                  : "Unassigned"}
              </span>
            </span>

            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium text-slate-600 bg-white border border-slate-200">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>
                {task.dueDate
                  ? new Date(task.dueDate).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "No target date"}
              </span>
            </span>
          </div>
        </div>

        {/* ── Top Navigation Tabs ── */}
        <div className="flex items-center gap-4 sm:gap-6 border-b border-slate-200 pt-2 overflow-x-auto no-scrollbar whitespace-nowrap">
          {[
            { id: "details", label: "Details" },
            { id: "checklist", label: `Checklist (${subtasksList.length})` },
            { id: "discussion", label: `Discussion (${task.comments?.length || 0})` },
            { id: "logs", label: `Work Logs (${task.timeLogs?.length || 0})` },
            { id: "attachments", label: `Attachments (${task.attachments?.length || 0})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setTopTab(tab.id as any)}
              className={`pb-3 text-xs font-semibold border-b-2 transition -mb-px ${
                topTab === tab.id
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-slate-500 hover:text-slate-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Main 2-Column Content Grid (Left 65% / Right 35%) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* ────── Left Main Column (65%) ────── */}
          <div className="lg:col-span-2 space-y-6">
            {/* 1. Description Card */}
            {(topTab === "details" || topTab === "checklist") && (
              <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-5 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-slate-500" />
                    <h3 className="text-sm font-bold text-slate-900">Description</h3>
                  </div>
                  {!isEditingDesc ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsEditingDesc(true)}
                      className="h-7 text-xs text-slate-600 hover:text-slate-900 gap-1 font-medium"
                    >
                      <Edit className="w-3 h-3" />
                      <span>Edit</span>
                    </Button>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsEditingDesc(false)}
                        className="h-7 text-xs text-slate-500"
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSaveDescription}
                        disabled={updateTaskMutation.isPending}
                        className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
                      >
                        {updateTaskMutation.isPending ? "Saving..." : "Save"}
                      </Button>
                    </div>
                  )}
                </div>

                {!isEditingDesc ? (
                  <div className="space-y-4">
                    <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-line">
                      {parsedDesc || (
                        <span className="text-slate-400 italic">No detailed description provided.</span>
                      )}
                    </p>

                    {parsedCriteria.length > 0 && (
                      <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-4 space-y-2">
                        <div className="text-xs font-bold text-slate-700">
                          Acceptance Criteria <span className="text-[11px] font-normal text-slate-400">(optional)</span>
                        </div>
                        <ul className="space-y-1.5 text-xs text-slate-600">
                          {parsedCriteria.map((item, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-1.5 shrink-0" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">Specification & Body</label>
                      <textarea
                        rows={3}
                        value={editDescValue}
                        onChange={(e) => setEditDescValue(e.target.value)}
                        placeholder="Detailed engineering scope..."
                        className="w-full text-xs p-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50/50"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">
                        Acceptance Criteria (one per line)
                      </label>
                      <textarea
                        rows={3}
                        value={editCriteriaValue}
                        onChange={(e) => setEditCriteriaValue(e.target.value)}
                        placeholder="Auto-retry payment intent on network failure&#10;Handle duplicate callbacks safely"
                        className="w-full text-xs p-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50/50"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 2. Engineering Checklist & Subtasks Card */}
            {(topTab === "details" || topTab === "checklist") && (
              <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-5 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <CheckSquare className="w-4 h-4 text-slate-500" />
                    <h3 className="text-sm font-bold text-slate-900">Engineering Checklist & Subtasks</h3>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                      <span>
                        {completedSubtasksCount} / {subtasksList.length} completed
                      </span>
                      <div className="w-20 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300"
                          style={{ width: `${subtaskProgress}%` }}
                        />
                      </div>
                      <span>{subtaskProgress}%</span>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const inputEl = document.getElementById("subtask-quick-input");
                        inputEl?.focus();
                      }}
                      className="h-7 text-xs font-semibold text-indigo-600 border-indigo-200 hover:bg-indigo-50 gap-1 px-2.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add</span>
                    </Button>
                  </div>
                </div>

                {/* Checklist Items */}
                <div className="space-y-1">
                  {subtasksList.map((st: any) => {
                    const isDone = st.status === "DONE";
                    const { tag, cleanTitle } = parseSubtaskTag(st.title);
                    return (
                      <div
                        key={st.id}
                        className="group flex items-center justify-between p-2.5 hover:bg-slate-50/80 rounded-xl border border-transparent hover:border-slate-100 transition"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Round Circular Checkbox */}
                          <button
                            type="button"
                            onClick={() =>
                              toggleSubtaskStatusMutation.mutate({
                                subtaskId: st.id,
                                status: isDone ? "TODO" : "DONE",
                              })
                            }
                            className={`w-4 h-4 rounded-full border flex items-center justify-center transition cursor-pointer shrink-0 ${
                              isDone
                                ? "bg-emerald-500 border-emerald-500 text-white"
                                : "border-slate-300 hover:border-indigo-500 bg-white"
                            }`}
                          >
                            {isDone && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                          </button>

                          <span
                            className={`text-xs font-medium leading-tight ${
                              isDone ? "line-through text-slate-400" : "text-slate-800"
                            }`}
                          >
                            {cleanTitle}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={`text-[10px] font-medium px-2 py-0.5 rounded ${
                              tag === "Analysis"
                                ? "bg-slate-100 text-slate-700"
                                : tag === "Testing"
                                ? "bg-purple-50 text-purple-700 border border-purple-200/60"
                                : "bg-blue-50 text-blue-700 border border-blue-200/60"
                            }`}
                          >
                            {tag}
                          </span>

                          <button
                            type="button"
                            onClick={() => {
                              if (confirm("Delete this subtask checkpoint?")) {
                                deleteSubtaskMutation.mutate(st.id);
                              }
                            }}
                            className="text-slate-300 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition p-1"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {subtasksList.length === 0 && (
                    <p className="text-slate-400 text-xs italic py-3 text-center">No checklist items added yet.</p>
                  )}
                </div>

                {/* Inline Quick Add Input */}
                <form
                  onSubmit={handleAddSubtaskSubmit}
                  className="flex items-center gap-2 pt-2 border-t border-slate-100"
                >
                  <Plus className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    id="subtask-quick-input"
                    type="text"
                    placeholder="Add a subtask or checklist item..."
                    value={newSubtaskTitle}
                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                    disabled={createSubtaskMutation.isPending}
                    className="flex-1 bg-transparent border-0 outline-none text-xs text-slate-800 placeholder:text-slate-400"
                  />
                  <select
                    value={newSubtaskTag}
                    onChange={(e) => setNewSubtaskTag(e.target.value)}
                    aria-label="Subtask Category"
                    className="text-[10px] font-medium bg-slate-100 text-slate-600 rounded px-2 py-1 outline-none border-0"
                  >
                    <option value="Development">Development</option>
                    <option value="Analysis">Analysis</option>
                    <option value="Testing">Testing</option>
                  </select>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={createSubtaskMutation.isPending || !newSubtaskTitle.trim()}
                    className="h-7 text-xs bg-slate-900 hover:bg-slate-800 text-white px-2.5"
                  >
                    Add
                  </Button>
                </form>
              </div>
            )}

            {/* 3. Discussion & Work Logs Card */}
            {(topTab === "details" || topTab === "discussion" || topTab === "logs") && (
              <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-5 space-y-4">
                {/* Sub-tab pills */}
                <div className="flex items-center gap-6 border-b border-slate-100 pb-3">
                  <button
                    onClick={() => setTopTab("discussion")}
                    className={`text-xs font-bold transition flex items-center gap-1.5 ${
                      topTab === "discussion" || topTab === "details"
                        ? "text-indigo-600"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Discussion ({task.comments?.length || 0})</span>
                  </button>

                  <button
                    onClick={() => setTopTab("logs")}
                    className={`text-xs font-bold transition flex items-center gap-1.5 ${
                      topTab === "logs" ? "text-indigo-600" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>Work Logs ({task.timeLogs?.length || 0})</span>
                  </button>
                </div>

                {/* Discussion Thread */}
                {topTab !== "logs" && (
                  <div className="space-y-4">
                    {task.comments?.length > 0 ? (
                      <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                        {task.comments.map((c: any) => {
                          const gitActivity = parseGitActivityComment(c.content);

                          if (gitActivity) {
                            return (
                              <div
                                key={c.id}
                                className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden transition hover:border-slate-300"
                              >
                                {/* Header bar */}
                                <div className="bg-slate-50/90 px-3.5 py-2.5 border-b border-slate-100 flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-md bg-slate-900 text-white flex items-center justify-center shadow-2xs">
                                      <GithubIcon className="w-3.5 h-3.5" />
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-bold text-slate-900">GitHub Code Push</span>
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-mono text-[10px] font-bold border border-indigo-200/60">
                                        <GitBranch className="w-3 h-3 text-indigo-500" />
                                        <span>{gitActivity.branch}</span>
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1 text-[10px] font-mono text-slate-400">
                                    <Clock className="w-3 h-3" />
                                    <span>
                                      {new Date(c.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                    </span>
                                  </div>
                                </div>

                                {/* Commits List */}
                                <div className="p-3 space-y-1.5 bg-white">
                                  {gitActivity.commits.length > 0 ? (
                                    gitActivity.commits.map((commit, idx) => (
                                      <div
                                        key={idx}
                                        className="flex items-center justify-between gap-3 text-xs p-2 rounded-lg bg-slate-50/50 hover:bg-slate-100/70 border border-slate-100 transition"
                                      >
                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                          <GitCommit className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                          <span className="text-slate-700 font-medium truncate" title={commit.message}>
                                            {commit.message}
                                          </span>
                                        </div>
                                        <a
                                          href={commit.url}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-blue-600 hover:text-blue-700 bg-white hover:bg-blue-50 px-2 py-0.5 rounded-md border border-slate-200 hover:border-blue-300 transition shrink-0"
                                          title="View commit on GitHub"
                                        >
                                          <span>{commit.sha}</span>
                                          <ExternalLink className="w-2.5 h-2.5 opacity-70" />
                                        </a>
                                      </div>
                                    ))
                                  ) : (
                                    <div className="text-xs text-slate-600 p-2">
                                      {renderFormattedContent(c.content)}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          }

                          // Regular Team Comment
                          const authorName = c.user?.firstName
                            ? `${c.user.firstName} ${c.user.lastName || ""}`.trim()
                            : "Team Member";
                          const authorInitial = c.user?.firstName?.[0] || "U";

                          return (
                            <div
                              key={c.id}
                              className="flex gap-3 bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs hover:border-slate-300 transition"
                            >
                              <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0 uppercase shadow-2xs">
                                {authorInitial}
                              </div>
                              <div className="flex-1 space-y-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-slate-900 text-xs">
                                    {authorName}
                                  </span>
                                  <span className="text-[10px] font-mono text-slate-400">
                                    {new Date(c.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                  </span>
                                </div>
                                <div className="text-slate-700 text-xs leading-relaxed whitespace-pre-wrap break-words">
                                  {renderFormattedContent(c.content)}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="py-8 text-center space-y-1">
                        <MessageSquare className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p className="text-xs font-bold text-slate-700">No comments yet</p>
                        <p className="text-[11px] text-slate-400">
                          Share updates, ask questions, or discuss implementation details.
                        </p>
                      </div>
                    )}

                    {/* Comment Input Bar */}
                    <form onSubmit={handleCommentSubmit} className="flex items-center gap-2 pt-2">
                      <div className="w-7 h-7 rounded-full bg-blue-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0 uppercase">
                        {userInitials}
                      </div>

                      <div className="flex-1 relative flex items-center">
                        <input
                          type="text"
                          placeholder="Write a comment, link a PR, or update team..."
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          disabled={addCommentMutation.isPending}
                          className="w-full text-xs px-3 py-2 pr-9 rounded-lg border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="absolute right-2.5 text-slate-400 hover:text-slate-600"
                          title="Attach file"
                        >
                          <Paperclip className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <Button
                        type="submit"
                        size="sm"
                        disabled={addCommentMutation.isPending || !newComment.trim()}
                        className="h-8 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium px-3 gap-1.5"
                      >
                        <Send className="w-3 h-3" />
                        <span>Send</span>
                      </Button>
                    </form>
                  </div>
                )}

                {/* Work Logs View */}
                {topTab === "logs" && (
                  <div className="space-y-3">
                    {task.timeLogs?.length ? (
                      <div className="border border-slate-200 rounded-xl overflow-hidden">
                        <table className="w-full text-xs">
                          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-left">
                            <tr>
                              <th className="p-2.5 font-semibold">Engineer</th>
                              <th className="p-2.5 font-semibold">Hours</th>
                              <th className="p-2.5 font-semibold">Description</th>
                              <th className="p-2.5 font-semibold">Date</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {task.timeLogs.map((log: any) => (
                              <tr key={log.id} className="hover:bg-slate-50/50">
                                <td className="p-2.5 font-bold text-slate-900">
                                  {log.user?.firstName} {log.user?.lastName}
                                </td>
                                <td className="p-2.5 font-mono font-bold text-indigo-600">{log.hours} hrs</td>
                                <td className="p-2.5 text-slate-600">{log.description || "—"}</td>
                                <td className="p-2.5 text-slate-400 font-mono text-[11px]">
                                  {new Date(log.date).toLocaleDateString()}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-slate-400 text-xs italic py-6 text-center">No time logs recorded yet.</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 4. Standalone Attachments View (When topTab === 'attachments') */}
            {topTab === "attachments" && (
              <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-5 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Paperclip className="w-4 h-4 text-slate-500" />
                    <h3 className="text-sm font-bold text-slate-900">Task Artifacts &amp; Attachments</h3>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {task.attachments?.map((att: any) => {
                    const base = typeof window !== "undefined" ? "/api" : "/api";
                    const downloadUrl = att.url.startsWith("http") ? att.url : `${base}${att.url}`;
                    return (
                      <div
                        key={att.id}
                        className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/20 transition text-xs group"
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <FileText className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 shrink-0" />
                          <span className="font-semibold truncate text-slate-700">{att.originalName || att.filename}</span>
                        </div>
                        <a
                          href={downloadUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1 text-slate-400 hover:text-indigo-600"
                          title="Download"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ────── Right Operational Column (35%) ────── */}
          <div className="space-y-5">
            {/* 1. Status & Priority Card */}
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-5 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Equal className="w-4 h-4 text-slate-500" />
                  <h3 className="text-xs font-bold text-slate-900">Status &amp; Priority</h3>
                </div>
                <button
                  type="button"
                  className="text-xs text-blue-600 font-medium hover:underline flex items-center gap-1"
                >
                  <Edit className="w-3 h-3" />
                  <span>Edit</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-[11px] font-medium text-slate-500 block mb-1">Status</label>
                  <div className="relative">
                    <select
                      value={task.status}
                      onChange={(e) => updateStatusMutation.mutate(e.target.value)}
                      disabled={updateStatusMutation.isPending}
                      aria-label="Sidebar Task Status"
                      className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 pr-6 appearance-none cursor-pointer outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="TODO">⚪ To Do / Queued</option>
                      <option value="IN_PROGRESS">🔵 In Progress</option>
                      <option value="REVIEW">🟣 In Review</option>
                      <option value="DONE">🟢 Completed</option>
                    </select>
                    <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 top-2.5 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-slate-500 block mb-1">Priority</label>
                  <div className="relative">
                    <select
                      value={task.priority}
                      onChange={(e) => updatePriorityMutation.mutate(e.target.value)}
                      disabled={updatePriorityMutation.isPending}
                      aria-label="Sidebar Task Priority"
                      className="w-full text-xs font-semibold bg-amber-50/60 text-amber-800 border border-amber-200 rounded-lg px-2.5 py-1.5 pr-6 appearance-none cursor-pointer outline-none focus:ring-1 focus:ring-amber-500"
                    >
                      <option value="CRITICAL">🔥 P0 · Critical</option>
                      <option value="HIGH">▲ P1 · High</option>
                      <option value="MEDIUM">〓 P2 · Medium</option>
                      <option value="LOW">▼ P3 · Low</option>
                    </select>
                    <ChevronDown className="w-3 h-3 text-amber-600 absolute right-2 top-2.5 pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Task Attributes Card */}
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-5 space-y-3.5">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <FileText className="w-4 h-4 text-slate-500" />
                <h3 className="text-xs font-bold text-slate-900">Task Attributes</h3>
              </div>

              <div className="space-y-3 text-xs">
                {/* Project */}
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Project</span>
                  <span className="font-medium text-blue-700 bg-blue-50 border border-blue-200/60 px-2 py-0.5 rounded text-[11px]">
                    {task.project?.name || "General"}
                  </span>
                </div>

                {/* Assignee */}
                <div className="flex items-center justify-between relative">
                  <span className="text-slate-500 font-medium">Assignee</span>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1.5 text-slate-700 font-medium">
                      <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                      <span>
                        {primaryAssignee
                          ? `${primaryAssignee.firstName} ${primaryAssignee.lastName || ""}`.trim()
                          : "Unassigned"}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsAssigneeOpen(!isAssigneeOpen)}
                      className="text-xs text-blue-600 hover:underline font-medium"
                    >
                      {primaryAssignee ? "Change" : "Assign"}
                    </button>
                  </div>

                  {/* Assignee Selection Dropdown */}
                  {isAssigneeOpen && (
                    <div className="absolute right-0 top-6 w-52 bg-white rounded-xl shadow-lg border border-slate-200 p-2 z-30 space-y-1">
                      <div className="text-[10px] font-bold text-slate-400 px-2 py-1 uppercase">Select Engineer</div>
                      <div className="max-h-40 overflow-y-auto space-y-0.5">
                        {usersList.map((u: any) => (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => assignUserMutation.mutate(u.id)}
                            className="w-full text-left text-xs p-1.5 rounded hover:bg-slate-50 flex items-center justify-between"
                          >
                            <span className="truncate">
                              {u.firstName} {u.lastName}
                            </span>
                            {primaryAssignee?.id === u.id && <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Target Delivery */}
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Target Delivery</span>
                  <span className="flex items-center gap-1 text-slate-700">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      {task.dueDate
                        ? new Date(task.dueDate).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "Unscheduled"}
                    </span>
                  </span>
                </div>

                {/* Total Time Spent */}
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Total Time Spent</span>
                  <span className="flex items-center gap-1 text-slate-700 font-mono font-medium">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>{totalLoggedHours} hrs</span>
                  </span>
                </div>

                {/* Created On */}
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Created On</span>
                  <span className="flex items-center gap-1 text-slate-700 text-[11px]">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>{new Date(task.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</span>
                  </span>
                </div>

                {/* Last Updated */}
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Last Updated</span>
                  <span className="flex items-center gap-1 text-slate-700 text-[11px]">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>{new Date(task.updatedAt || task.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* 3. GitHub & Development Card */}
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-5 space-y-3.5">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <GithubIcon className="w-4 h-4 text-slate-700" />
                <h3 className="text-xs font-bold text-slate-900">GitHub &amp; Development</h3>
              </div>

              {!task.project?.githubRepo ? (
                <div className="space-y-3">
                  <div className="flex items-start gap-2.5">
                    <Clock className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <p className="text-xs font-bold text-slate-800">No repository connected</p>
                      <p className="text-[11px] text-slate-400 leading-snug">
                        Link a GitHub repository to track commits and pull requests.
                      </p>
                    </div>
                  </div>

                  <Link href={`/projects/${task.projectId}`} className="block">
                    <Button size="sm" className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold gap-1.5 h-8">
                      <GithubIcon className="w-3.5 h-3.5" />
                      <span>Connect Repository</span>
                    </Button>
                  </Link>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-100">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Branch</span>
                      <span className="text-slate-500 font-mono">-</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Latest Commit</span>
                      <span className="text-slate-500 font-mono">-</span>
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Open Pull Requests</span>
                    <span className="text-slate-500 font-mono">0</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Repository</span>
                    <a
                      href={`https://github.com/${task.project.githubRepo}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-blue-600 hover:underline flex items-center gap-1"
                    >
                      <span>{task.project.githubRepo.split("/")[1] || task.project.githubRepo}</span>
                      <ExternalLink className="w-3 h-3 text-slate-400" />
                    </a>
                  </div>

                  <div className="space-y-1">
                    <span className="text-slate-500 block">Branch Checkout</span>
                    <div className="flex items-center gap-1 bg-slate-900 text-slate-100 p-2 rounded-lg font-mono text-[11px]">
                      <span className="truncate flex-1 select-all">{gitCheckoutCmd}</span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(gitCheckoutCmd);
                          setCopiedBranch(true);
                          setTimeout(() => setCopiedBranch(false), 2000);
                        }}
                        className="text-slate-300 hover:text-white px-1.5 py-0.5 rounded bg-slate-800 text-[10px]"
                      >
                        {copiedBranch ? "Copied!" : "Copy"}
                      </button>
                    </div>
                  </div>

                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={handleCopyAiPrompt}
                      className={`w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-medium transition-all ${
                        copiedPrompt
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200/80 hover:border-slate-300"
                      }`}
                      title="Copy structured task prompt for Antigravity, Claude, or Cursor"
                    >
                      {copiedPrompt ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="font-semibold text-emerald-700">Prompt Copied!</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Copy Prompt</span>
                        </>
                      )}
                    </button>
                  </div>

                  {task.pullRequests?.length > 0 && (
                    <div className="pt-2 border-t border-slate-100 space-y-1.5">
                      <span className="text-slate-500 block font-medium">Pull Requests ({task.pullRequests.length})</span>
                      {task.pullRequests.map((pr: any) => (
                        <a
                          key={pr.id}
                          href={pr.prUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200 hover:border-indigo-300 text-[11px]"
                        >
                          <span className="font-semibold text-blue-600 truncate">
                            #{pr.prNumber} {pr.prTitle}
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-50 text-purple-700">
                            {pr.status}
                          </span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 4. Time Tracker Card */}
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-5 space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <Clock className="w-4 h-4 text-slate-500" />
                <h3 className="text-xs font-bold text-slate-900">Time Tracker</h3>
              </div>

              {/* Monospace Stopwatch Display */}
              <div className="text-center space-y-3">
                <div className="text-3xl font-mono font-bold text-slate-900 tracking-wider">
                  {formatTimer(timerSeconds)}
                </div>

                <Button
                  type="button"
                  onClick={() => setTimerRunning(!timerRunning)}
                  className={`w-full font-semibold text-xs h-9 gap-1.5 ${
                    timerRunning
                      ? "bg-rose-600 hover:bg-rose-700 text-white"
                      : "bg-blue-600 hover:bg-blue-700 text-white"
                  }`}
                >
                  {timerRunning ? (
                    <>
                      <Pause className="w-3.5 h-3.5" />
                      <span>Pause Stopwatch</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5" />
                      <span>Start Stopwatch</span>
                    </>
                  )}
                </Button>
              </div>

              {/* Log Work Hours Form */}
              <form onSubmit={handleLogTimeSubmit} className="space-y-2.5 pt-2 border-t border-slate-100 text-xs">
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-1">
                    <label className="text-[10px] font-medium text-slate-500 block mb-1">Hours</label>
                    <Input
                      type="number"
                      step="0.1"
                      placeholder="e.g. 1.5"
                      value={logHours}
                      onChange={(e) => setLogHours(e.target.value)}
                      className="text-xs h-8 font-mono"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-[10px] font-medium text-slate-500 block mb-1">Description</label>
                    <Input
                      placeholder="Commit / debug work..."
                      value={logDesc}
                      onChange={(e) => setLogDesc(e.target.value)}
                      className="text-xs h-8"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={logTimeMutation.isPending || !logHours}
                  className="w-full bg-[#334155] hover:bg-slate-800 text-white font-medium text-xs h-8"
                >
                  {logTimeMutation.isPending ? "Logging..." : "Log Work Hours"}
                </Button>
              </form>
            </div>

            {/* 5. Attachments Card */}
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-5 space-y-3.5">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <Paperclip className="w-4 h-4 text-slate-500" />
                <h3 className="text-xs font-bold text-slate-900">
                  Attachments ({task.attachments?.length || 0})
                </h3>
              </div>

              {/* Drag & Drop Upload Dropzone */}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={async (e) => {
                  if (e.target.files && e.target.files[0]) {
                    const file = e.target.files[0];
                    try {
                      await uploadAttachment.mutateAsync({ file, taskId });
                      queryClient.invalidateQueries({ queryKey: ["task", taskId] });
                    } catch (err: any) {
                      alert(err?.response?.data?.message || "Failed to upload file.");
                    }
                  }
                }}
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-xl p-5 text-center cursor-pointer transition bg-slate-50/50 hover:bg-indigo-50/20 space-y-1.5"
              >
                <UploadCloud className="w-7 h-7 text-slate-400 mx-auto" />
                <p className="text-xs font-semibold text-slate-700">Drag &amp; drop files here or click to upload</p>
                <p className="text-[10px] text-slate-400">Supports images, documents, and code files.</p>
              </div>

              {/* Uploaded Files Mini-List */}
              {task.attachments?.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  {task.attachments.map((att: any) => {
                    const base = typeof window !== "undefined" ? "/api" : "/api";
                    const downloadUrl = att.url.startsWith("http") ? att.url : `${base}${att.url}`;
                    return (
                      <div
                        key={att.id}
                        className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200 text-xs"
                      >
                        <span className="font-medium text-slate-700 truncate max-w-[160px]">
                          {att.originalName || att.filename}
                        </span>
                        <a
                          href={downloadUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-indigo-600 hover:underline p-1"
                        >
                          <Download className="w-3 h-3" />
                        </a>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
