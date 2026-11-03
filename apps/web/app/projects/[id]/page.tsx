"use client";

import { useState, use } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../src/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import { Progress } from "../../../components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { Button } from "../../../components/ui/button";
import { CheckCircle2, Clock, Calendar, CheckSquare, Plus, Paperclip, GitBranch, ExternalLink, Unlink, GitPullRequest, GitMerge, FileText, AlertTriangle, Users, UserPlus, Trash2, Shield, Search, Download, FolderArchive, FolderPlus, Eye, X, User, Link as LinkIcon, ArrowLeft, FolderKanban, Layers, Check, ChevronRight, FileSpreadsheet, Palette, Target, RefreshCw, Sparkles, MessageSquare, Loader2 } from "lucide-react";
import Link from "next/link";
import { useUploadAttachment, useCreateLinkAttachment, useDeleteAttachment } from "../../../src/hooks/queries";
import { Modal, FormField, inputCls } from "../../components/Modal";

const RESOURCE_CATEGORIES = [
  { id: 'ALL', label: 'All Resources', color: 'bg-zinc-100 text-zinc-800 border-zinc-200' },
  { id: 'DOCS', label: 'Docs & Specs', color: 'bg-blue-50/70 text-blue-700 border-blue-200/60' },
  { id: 'CONTRACT', label: 'Contracts & SOW', color: 'bg-emerald-50/70 text-emerald-700 border-emerald-200/60' },
  { id: 'DESIGN', label: 'Design & Assets', color: 'bg-purple-50/70 text-purple-700 border-purple-200/60' },
  { id: 'DELIVERABLE', label: 'Deliverables', color: 'bg-amber-50/70 text-amber-700 border-amber-200/60' },
  { id: 'OTHER', label: 'Other', color: 'bg-zinc-50 text-zinc-600 border-zinc-200/70' },
];

function parseAttachmentMeta(att: any) {
  const original = att.originalName || att.filename || 'Untitled';
  const match = original.match(/^\[([A-Z_]+)\]\s*(.*)$/);
  let category = 'OTHER';
  let displayName = original;

  if (match) {
    category = match[1];
    displayName = match[2];
  }

  let uploaderName = 'Team Member';
  if (att.uploadedBy) {
    uploaderName = `${att.uploadedBy.firstName || ''} ${att.uploadedBy.lastName || ''}`.trim() || att.uploadedBy.email || 'Team Member';
  }

  let formattedDate = 'Recent';
  if (att.createdAt) {
    try {
      const d = new Date(att.createdAt);
      formattedDate = d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      formattedDate = new Date(att.createdAt).toLocaleDateString();
    }
  }

  const isLink = att.mimeType === 'text/x-uri' || (att.url && (att.url.startsWith('http://') || att.url.startsWith('https://')));
  let formattedSize = '0 B';
  let ext = 'FILE';

  if (isLink) {
    formattedSize = 'External Link';
    const lowUrl = (att.url || '').toLowerCase();
    if (lowUrl.includes('docs.google.com/spreadsheets') || lowUrl.includes('sheet')) {
      ext = 'SHEET';
    } else if (lowUrl.includes('docs.google.com/document') || lowUrl.includes('doc')) {
      ext = 'DOCS';
    } else if (lowUrl.includes('figma.com')) {
      ext = 'FIGMA';
    } else if (lowUrl.includes('github.com')) {
      ext = 'REPO';
    } else if (lowUrl.includes('notion.so') || lowUrl.includes('notion.site')) {
      ext = 'NOTION';
    } else {
      ext = 'LINK';
    }
  } else {
    if (att.size) {
      if (att.size > 1024 * 1024) {
        formattedSize = `${(att.size / (1024 * 1024)).toFixed(2)} MB`;
      } else {
        formattedSize = `${(att.size / 1024).toFixed(1)} KB`;
      }
    }
    ext = (att.filename || original).split('.').pop()?.toUpperCase() || 'FILE';
  }

  return {
    category,
    displayName,
    rawName: att.filename || original,
    uploaderName,
    formattedDate,
    formattedSize,
    ext,
    isLink,
    url: att.url,
  };
}

function GithubIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  );
}

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const id = resolvedParams.id;
  const queryClient = useQueryClient();
  const uploadAttachment = useUploadAttachment();
  const createLinkAttachment = useCreateLinkAttachment();
  const deleteAttachmentMutation = useDeleteAttachment();
  
  const [isMilestoneOpen, setIsMilestoneOpen] = useState(false);
  const [milestoneForm, setMilestoneForm] = useState({ name: "", description: "", dueDate: "" });

  const [isGithubModalOpen, setIsGithubModalOpen] = useState(false);
  const [selectedRepoFullName, setSelectedRepoFullName] = useState("");
  const [selectedInstallationId, setSelectedInstallationId] = useState("");
  const [projectKeyInput, setProjectKeyInput] = useState("");

  // Phase 3 PR Merge Gate state
  const [activePRMergeModal, setActivePRMergeModal] = useState<any | null>(null);
  const [mergeabilityData, setMergeabilityData] = useState<any | null>(null);
  const [isCheckingMergeability, setIsCheckingMergeability] = useState(false);
  const [selectedMergeMethod, setSelectedMergeMethod] = useState<'squash' | 'merge'>('squash');

  // Collaborator Access Management state
  const [isCollaboratorModalOpen, setIsCollaboratorModalOpen] = useState(false);
  const [collabSearchQuery, setCollabSearchQuery] = useState("");
  const [selectedInviteUsername, setSelectedInviteUsername] = useState("");
  const [selectedInvitePermission, setSelectedInvitePermission] = useState<string>("push");

  // Resource Centre state
  const [isResourceModalOpen, setIsResourceModalOpen] = useState(false);
  const [resourceSearchQuery, setResourceSearchQuery] = useState("");
  const [selectedResourceCategory, setSelectedResourceCategory] = useState("ALL");
  const [resourceTab, setResourceTab] = useState<'file' | 'link'>('file');
  const [newResourceFile, setNewResourceFile] = useState<File | null>(null);
  const [newResourceCustomName, setNewResourceCustomName] = useState("");
  const [newResourceUrl, setNewResourceUrl] = useState("");
  const [newResourceLinkTitle, setNewResourceLinkTitle] = useState("");
  const [newResourceCategory, setNewResourceCategory] = useState("DOCS");
  const [isUploadingResource, setIsUploadingResource] = useState(false);
  const [isCicdModalOpen, setIsCicdModalOpen] = useState(false);
  const [cicdServerPath, setCicdServerPath] = useState("");
  const [cicdAppPort, setCicdAppPort] = useState("");
  const [copiedCicdPrompt, setCopiedCicdPrompt] = useState(false);
  const [isOpeningChat, setIsOpeningChat] = useState(false);

  const { data: releaseNotes = [] } = useQuery({
    queryKey: ['project-release-notes', id],
    queryFn: async () => {
      const { data } = await api.get(`/projects/${id}/release-notes`);
      return data;
    },
  });

  const generateDraftMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/projects/${id}/release-notes/draft`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-release-notes', id] });
      alert("Draft release note generated successfully!");
    },
    onError: (err: any) => {
      alert(err?.response?.data?.message || err?.message || "Failed to generate release draft.");
    },
  });

  const publishReleaseNoteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      const { data } = await api.post(`/projects/${id}/release-notes/${noteId}/publish`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-release-notes', id] });
      alert("Release note approved and published!");
    },
    onError: (err: any) => {
      alert(err?.response?.data?.message || err?.message || "Failed to publish release note.");
    },
  });

  const checkMergeability = async (prId: string) => {
    setIsCheckingMergeability(true);
    setMergeabilityData(null);
    try {
      const { data } = await api.get(`/projects/${id}/pull-requests/${prId}/mergeability`);
      setMergeabilityData(data);
    } catch (err: any) {
      alert(err?.response?.data?.message || err?.message || "Failed to check mergeability.");
    } finally {
      setIsCheckingMergeability(false);
    }
  };

  const mergePRMutation = useMutation({
    mutationFn: async ({ prId, mergeMethod }: { prId: string; mergeMethod: string }) => {
      const { data } = await api.post(`/projects/${id}/pull-requests/${prId}/merge`, { mergeMethod });
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      queryClient.invalidateQueries({ queryKey: ['project-release-notes', id] });
      setActivePRMergeModal(null);
      alert(`PR merged successfully! Task retained in REVIEW status for QA testing.`);
    },
    onError: (err: any) => {
      alert(err?.response?.data?.message || err?.message || "Merge failed.");
    },
  });

  const { data: project, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['project', id],
    queryFn: async () => {
      const { data } = await api.get(`/projects/${id}`);
      return data;
    }
  });

  const createMilestoneMutation = useMutation({
    mutationFn: async (newMilestone: any) => {
      const { data } = await api.post(`/projects/${id}/milestones`, newMilestone);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      setIsMilestoneOpen(false);
      setMilestoneForm({ name: "", description: "", dueDate: "" });
      alert("Milestone added successfully!");
    }
  });

  const { data: availableGithubData, isLoading: isLoadingGithubRepos } = useQuery({
    queryKey: ['available-github-repos'],
    queryFn: async () => {
      const { data } = await api.get('/projects/github/repositories');
      return data;
    },
    enabled: isGithubModalOpen,
  });

  const bindGithubMutation = useMutation({
    mutationFn: async (payload: { installationId: string; repoFullName: string; key?: string }) => {
      const { data } = await api.patch(`/projects/${id}/github`, payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      setIsGithubModalOpen(false);
      alert("GitHub repository connected successfully!");
    },
    onError: (err: any) => {
      alert(err?.response?.data?.message || err?.message || "Failed to connect repository.");
    },
  });

  const unbindGithubMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.delete(`/projects/${id}/github`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      alert("GitHub repository disconnected.");
    },
    onError: (err: any) => {
      alert(err?.response?.data?.message || err?.message || "Failed to disconnect repository.");
    },
  });

  // Collaborator Access Management queries & mutations
  const {
    data: collaboratorsData,
    isLoading: isLoadingCollaborators,
  } = useQuery({
    queryKey: ['project-collaborators', id],
    queryFn: async () => {
      const { data } = await api.get(`/projects/${id}/collaborators`);
      return data;
    },
    enabled: !!project?.githubRepo,
  });

  const {
    data: searchResults = [],
    isFetching: isSearchingUsers,
  } = useQuery({
    queryKey: ['github-user-search', id, collabSearchQuery],
    queryFn: async () => {
      if (!collabSearchQuery || collabSearchQuery.trim().length < 2) return [];
      const { data } = await api.get(`/projects/${id}/collaborators/search?q=${encodeURIComponent(collabSearchQuery.trim())}`);
      return data;
    },
    enabled: isCollaboratorModalOpen && collabSearchQuery.trim().length >= 2,
  });

  const inviteCollaboratorMutation = useMutation({
    mutationFn: async ({ username, permission }: { username: string; permission: string }) => {
      const { data } = await api.post(`/projects/${id}/collaborators/invite`, { username, permission });
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['project-collaborators', id] });
      setIsCollaboratorModalOpen(false);
      setSelectedInviteUsername("");
      setCollabSearchQuery("");
      alert(data?.message || "Invitation sent successfully!");
    },
    onError: (err: any) => {
      alert(err?.response?.data?.message || err?.message || "Failed to invite collaborator.");
    },
  });

  const cancelInvitationMutation = useMutation({
    mutationFn: async (invitationId: number) => {
      const { data } = await api.delete(`/projects/${id}/collaborators/invitations/${invitationId}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-collaborators', id] });
      alert("Invitation cancelled successfully.");
    },
    onError: (err: any) => {
      alert(err?.response?.data?.message || err?.message || "Failed to cancel invitation.");
    },
  });

  const removeCollaboratorMutation = useMutation({
    mutationFn: async (username: string) => {
      const { data } = await api.delete(`/projects/${id}/collaborators/${username}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-collaborators', id] });
      alert("Collaborator removed from repository.");
    },
    onError: (err: any) => {
      alert(err?.response?.data?.message || err?.message || "Failed to remove collaborator.");
    },
  });

  const handleCreateMilestone = (e: React.FormEvent) => {
    e.preventDefault();
    if (!milestoneForm.name) return;
    createMilestoneMutation.mutate({
      name: milestoneForm.name,
      description: milestoneForm.description || undefined,
      dueDate: milestoneForm.dueDate ? new Date(milestoneForm.dueDate) : undefined,
    });
  };

  if (isLoading) return <div className="p-8">Loading project details...</div>;
  if (isError || !project) {
    return (
      <div className="p-8 space-y-3">
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">
          Failed to load this project. {(error as any)?.response?.data?.message || (error as any)?.message || "Please try again."}
        </div>
        <Button onClick={() => refetch()}>Retry</Button>
      </div>
    );
  }

  const totalTime = project.timeLogs?.reduce((acc: number, log: any) => acc + log.hours, 0) || 0;
  const completedMilestones = project.milestones?.filter((m: any) => m.status === 'COMPLETED').length || 0;
  const progressPercent = project.milestones?.length ? (completedMilestones / project.milestones.length) * 100 : 0;

  const handleUploadResource = async () => {
    if (!newResourceFile) {
      alert("Please select a file to upload.");
      return;
    }
    setIsUploadingResource(true);
    try {
      await uploadAttachment.mutateAsync({
        file: newResourceFile,
        projectId: id,
        customName: newResourceCustomName.trim() || undefined,
        category: newResourceCategory,
      });
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      setIsResourceModalOpen(false);
      setNewResourceFile(null);
      setNewResourceCustomName("");
      setNewResourceCategory("DOCS");
      alert("Resource uploaded successfully!");
    } catch (err: any) {
      alert(err?.response?.data?.message || err?.message || "Failed to upload resource.");
    } finally {
      setIsUploadingResource(false);
    }
  };

  const handleSaveResourceLink = async () => {
    if (!newResourceUrl.trim()) {
      alert("Please enter a valid URL (e.g. Google Docs, Google Sheets, Figma, or Notion link).");
      return;
    }
    setIsUploadingResource(true);
    try {
      await createLinkAttachment.mutateAsync({
        url: newResourceUrl.trim(),
        title: newResourceLinkTitle.trim() || newResourceUrl.trim(),
        projectId: id,
        category: newResourceCategory,
      });
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      setIsResourceModalOpen(false);
      setNewResourceUrl("");
      setNewResourceLinkTitle("");
      setNewResourceCategory("DOCS");
      setResourceTab("file");
      alert("External resource link saved successfully!");
    } catch (err: any) {
      alert(err?.response?.data?.message || err?.message || "Failed to save resource link.");
    } finally {
      setIsUploadingResource(false);
    }
  };

  const handleDeleteResource = async (attId: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}" from this project?`)) {
      return;
    }
    try {
      await deleteAttachmentMutation.mutateAsync(attId);
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      alert("Resource deleted successfully.");
    } catch (err: any) {
      alert(err?.response?.data?.message || err?.message || "Failed to delete resource.");
    }
  };

  const handleCopyCicdPrompt = () => {
    const repoName = project.githubRepo || "repository";
    const serverPath = cicdServerPath.trim() || "/var/www/<project-app-dir>";
    const appPort = cicdAppPort.trim();
    const pm2Name = `${(project.name || 'app').toLowerCase().replace(/[^a-z0-9]/g, '-')}-service`;

    const promptText = `You are an expert DevOps engineer configuring automated CI/CD for this repository "${repoName}".

### 🎯 Goal:
Set up automated deployment via GitHub Actions to our Linux VPS (FastPanel / Ubuntu) for Staging and Production.

### 📁 Target Server Directory:
- Server Deployment Path: ${serverPath}

### ⚠️ Port & Process Safety (CRITICAL - AVOID SERVER CONFLICTS):
${appPort ? `- Assigned Application Port: ${appPort}` : `- No specific port designated. CRITICAL: Inspect server ports (\`ss -tulpn\`) and use a unique port in range 3010-3999.`}
- ⛔ STRICT RULE - NEVER USE THESE BUSY SYSTEM PORTS:
  • 3000 (NeuraVolt OS Web)
  • 3001 (NeuraVolt OS API)
  • 3002 (Python Biometric Engine)
  • 3306 (MySQL Database)
  • 5432 (PostgreSQL Database)
  • 6379 (Redis Cache)
  • 80 / 443 (Nginx Web Reverse Proxy / FastPanel)
- Unique PM2 Service Name: \`${pm2Name}\` (DO NOT use generic names like "app" or "web" that will override other server apps).

### 🛠️ What You Need to Do:
1. Inspect this repository's codebase (package.json, framework, requirements.txt, composer.json, or Dockerfile).
2. Create \`deploy.sh\` in the project root:
   - Make it executable (\`chmod +x deploy.sh\`)
   - Handle pull for the active branch ($DEPLOY_BRANCH)
   - Install dependencies (e.g. \`npm ci\` or \`pnpm install\`)
   - Run production build (e.g. \`npm run build\` or \`pnpm build\`)
   - Reload/Start process with PM2 using unique service name:
     \`pm2 restart ${pm2Name} || pm2 start dist/main.js --name "${pm2Name}" ${appPort ? ` -- --port ${appPort}` : ''}\`
   - Save PM2 state (\`pm2 save\`)
3. Create \`.github/workflows/deploy.yml\`:
   - Trigger on push to \`staging\` and \`main\`
   - SSH into server using GitHub Secrets:
     - SERVER_HOST
     - SERVER_USER
     - SERVER_SSH_KEY
     - SERVER_APP_DIR (set to "${serverPath}")
   - Execute:
     \`cd \${{ secrets.SERVER_APP_DIR }} && export DEPLOY_BRANCH=\${{ github.ref_name }} && bash deploy.sh\`
4. Print a concise summary of the 4 GitHub Secrets the developer needs to add in GitHub Repository Settings.`;

    navigator.clipboard.writeText(promptText);
    setCopiedCicdPrompt(true);
    setTimeout(() => setCopiedCicdPrompt(false), 2000);
  };

  const parsedAttachments = (project.attachments || []).map((att: any) => ({
    ...att,
    meta: parseAttachmentMeta(att),
  }));

  const filteredAttachments = parsedAttachments.filter((att: any) => {
    const matchesCategory = selectedResourceCategory === 'ALL' || att.meta.category === selectedResourceCategory;
    if (!matchesCategory) return false;

    if (!resourceSearchQuery.trim()) return true;
    const q = resourceSearchQuery.toLowerCase();
    return (
      att.meta.displayName.toLowerCase().includes(q) ||
      att.meta.rawName.toLowerCase().includes(q) ||
      att.meta.uploaderName.toLowerCase().includes(q) ||
      att.meta.category.toLowerCase().includes(q)
    );
  });

  const categoryCounts = parsedAttachments.reduce((acc: Record<string, number>, curr: any) => {
    acc[curr.meta.category] = (acc[curr.meta.category] || 0) + 1;
    return acc;
  }, {});

  const statusToneMap: Record<string, string> = {
    ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200/70',
    COMPLETED: 'bg-blue-50 text-blue-700 border-blue-200/70',
    ON_HOLD: 'bg-amber-50 text-amber-700 border-amber-200/70',
    CANCELLED: 'bg-zinc-100 text-zinc-500 border-zinc-200/70',
    PLANNING: 'bg-zinc-100 text-zinc-600 border-zinc-200/70',
  };

  const taskStatusMap: Record<string, string> = {
    DONE: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
    done: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
    IN_PROGRESS: 'bg-blue-50 text-blue-700 border-blue-200/60',
    in_progress: 'bg-blue-50 text-blue-700 border-blue-200/60',
    REVIEW: 'bg-purple-50 text-purple-700 border-purple-200/60',
    review: 'bg-purple-50 text-purple-700 border-purple-200/60',
    TODO: 'bg-zinc-100 text-zinc-600 border-zinc-200/60',
    todo: 'bg-zinc-100 text-zinc-600 border-zinc-200/60',
  };

  return (
    <div className="min-h-screen bg-zinc-50/40 p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Figma/Linear Breadcrumb & Header */}
      <div className="space-y-3">
        <div className="flex items-center gap-1.5 text-xs text-zinc-500 font-medium">
          <Link href="/projects" className="hover:text-zinc-900 transition-colors flex items-center gap-1">
            <FolderKanban className="w-3.5 h-3.5" />
            <span>Projects</span>
          </Link>
          <ChevronRight className="w-3 h-3 text-zinc-400" />
          <span className="text-zinc-900 font-medium truncate max-w-xs">{project.name}</span>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-zinc-200/80">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900">{project.name}</h1>
              {project.key && (
                <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-zinc-100 text-zinc-700 border border-zinc-200/80">
                  {project.key}
                </span>
              )}
              <span className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full border ${statusToneMap[project.status] || 'bg-zinc-100 text-zinc-600 border-zinc-200'}`}>
                {project.status}
              </span>
            </div>
            <p className="text-xs text-zinc-500 flex items-center gap-1.5">
              <span>Client:</span>
              <span className="font-medium text-zinc-800">{project.client?.name || "Internal Project"}</span>
              {project.description && (
                <>
                  <span className="text-zinc-300">•</span>
                  <span className="text-zinc-500 truncate max-w-md">{project.description}</span>
                </>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="hidden sm:flex items-center gap-3 px-3 py-1.5 bg-white border border-zinc-200/80 rounded-lg shadow-xs text-xs text-zinc-600">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                <span>Start: <strong className="font-medium text-zinc-800">{project.startDate ? new Date(project.startDate).toLocaleDateString('en-IN') : '—'}</strong></span>
              </div>
              <span className="text-zinc-200">|</span>
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-zinc-400" />
                <span>Due: <strong className="font-medium text-zinc-800">{project.endDate ? new Date(project.endDate).toLocaleDateString('en-IN') : '—'}</strong></span>
              </div>
            </div>

            <Button
              size="sm"
              onClick={() => setIsMilestoneOpen(true)}
              className="h-8.5 text-xs font-medium bg-white hover:bg-zinc-50 text-zinc-700 border border-zinc-200/90 rounded-lg shadow-xs transition-colors flex items-center gap-1.5 px-3"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Milestone</span>
            </Button>

            <Button
              size="sm"
              onClick={() => setIsResourceModalOpen(true)}
              className="h-8.5 text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg shadow-xs transition-colors flex items-center gap-1.5 px-3"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>Add Resource</span>
            </Button>

            <Button
              size="sm"
              disabled={isOpeningChat}
              onClick={async () => {
                setIsOpeningChat(true);
                try {
                  const res = await api.get('/chat/conversations');
                  const convs = res.data || [];
                  let projectConv = convs.find(
                    (c: any) => c.entityType === 'PROJECT' && c.entityId === project.id
                  );

                  if (!projectConv) {
                    const createRes = await api.post('/chat/conversations', {
                      title: `proj-${(project.key || project.name || 'project').toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
                      type: 'CHANNEL',
                      entityType: 'PROJECT',
                      entityId: project.id,
                      description: `Dedicated workspace channel for ${project.name}`,
                    });
                    projectConv = createRes.data;
                  }

                  window.location.href = `/chat?conversationId=${projectConv.id}`;
                } catch (e) {
                  window.location.href = `/chat`;
                } finally {
                  setIsOpeningChat(false);
                }
              }}
              className="h-8.5 text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 rounded-lg shadow-xs transition-colors flex items-center gap-1.5 px-3"
              title="Open Project Workspace Chat"
            >
              {isOpeningChat ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
              ) : (
                <MessageSquare className="w-3.5 h-3.5 text-indigo-600" />
              )}
              <span>Project Chat</span>
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Overview Chips */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3.5 bg-white rounded-xl border border-zinc-200/80 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Total Tasks</span>
          <div className="flex items-baseline justify-between mt-1.5">
            <span className="text-xl font-bold font-mono text-zinc-900">{project.tasks?.length || 0}</span>
            <span className="text-[11px] text-zinc-400 font-medium">Work items</span>
          </div>
        </div>

        <div className="p-3.5 bg-white rounded-xl border border-zinc-200/80 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Completed</span>
          <div className="flex items-baseline justify-between mt-1.5">
            <span className="text-xl font-bold font-mono text-emerald-600">
              {project.tasks?.filter((t: any) => t.status === 'DONE' || t.status === 'done').length || 0}
            </span>
            <span className="text-[11px] text-emerald-600 font-medium">
              {project.tasks?.length ? `${Math.round(((project.tasks?.filter((t: any) => t.status === 'DONE' || t.status === 'done').length || 0) / project.tasks.length) * 100)}% done` : '0%'}
            </span>
          </div>
        </div>

        <div className="p-3.5 bg-white rounded-xl border border-zinc-200/80 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Effort Logged</span>
          <div className="flex items-baseline justify-between mt-1.5">
            <span className="text-xl font-bold font-mono text-zinc-900">{totalTime.toFixed(1)} <span className="text-xs font-normal text-zinc-500">hrs</span></span>
            <span className="text-[11px] text-zinc-400 font-medium">Across tasks</span>
          </div>
        </div>

        <div className="p-3.5 bg-white rounded-xl border border-zinc-200/80 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Budget Allocation</span>
          <div className="flex items-baseline justify-between mt-1.5">
            <span className="text-xl font-bold font-mono text-zinc-900">
              ₹{Number(project.budget || 0).toLocaleString('en-IN')}
            </span>
            <span className="text-[11px] text-zinc-400 font-medium">Contract value</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Work & Sprints (Left 65%) vs Repository & Team (Right 35%) */}
      <div className="grid md:grid-cols-3 gap-6 items-start">
        <div className="md:col-span-2 space-y-6">
          {/* Milestones Card - Zero Empty Space Waste */}
          <div className="bg-white rounded-xl border border-zinc-200/80 shadow-xs p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-zinc-600" />
                <h3 className="text-sm font-semibold text-zinc-900">Milestones & Sprints</h3>
                <span className="text-[11px] text-zinc-500 font-medium bg-zinc-100 px-2 py-0.5 rounded-full">
                  {completedMilestones}/{project.milestones?.length || 0}
                </span>
              </div>
              <Button 
                size="sm" 
                variant="ghost" 
                className="h-7 text-xs text-zinc-600 hover:text-zinc-900 px-2 gap-1 font-medium" 
                onClick={() => setIsMilestoneOpen(true)}
              >
                <Plus className="w-3.5 h-3.5" /> New Milestone
              </Button>
            </div>

            {project.milestones?.length > 0 ? (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-zinc-500 font-medium">
                    <span>Overall Milestone Completion</span>
                    <span className="font-mono">{Math.round(progressPercent)}%</span>
                  </div>
                  <Progress value={progressPercent} className="h-1.5 bg-zinc-100" />
                </div>

                <div className="divide-y divide-zinc-100">
                  {project.milestones.map((milestone: any) => (
                    <div key={milestone.id} className="py-3 flex items-start justify-between gap-4">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className={`w-4 h-4 shrink-0 ${milestone.status === 'COMPLETED' ? 'text-emerald-600' : 'text-zinc-300'}`} />
                          <h4 className="text-xs font-semibold text-zinc-900 truncate">{milestone.name || milestone.title}</h4>
                          <span className={`text-[10px] px-1.5 py-0.2 rounded border font-medium ${milestone.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-zinc-50 text-zinc-600 border-zinc-200'}`}>
                            {milestone.status}
                          </span>
                        </div>
                        {milestone.description && (
                          <p className="text-[11px] text-zinc-500 pl-6 leading-relaxed">{milestone.description}</p>
                        )}
                      </div>
                      <span className="text-[11px] text-zinc-400 shrink-0 font-medium">
                        {milestone.dueDate ? new Date(milestone.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'No due date'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-4 px-4 bg-zinc-50/60 border border-dashed border-zinc-200 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
                <div className="space-y-0.5">
                  <p className="text-xs font-medium text-zinc-700">No active milestones created</p>
                  <p className="text-[11px] text-zinc-400">Break down project deliverables into weekly sprint goals and release deadlines.</p>
                </div>
                <Button 
                  size="sm" 
                  onClick={() => setIsMilestoneOpen(true)}
                  className="h-7 text-xs bg-white hover:bg-zinc-100 text-zinc-800 border border-zinc-200 font-medium shadow-2xs shrink-0"
                >
                  <Plus className="w-3 h-3 mr-1" /> Add First Milestone
                </Button>
              </div>
            )}
          </div>

          {/* Tasks & PRs Table - Linear Style */}
          <div className="bg-white rounded-xl border border-zinc-200/80 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-zinc-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-zinc-600" />
                <h3 className="text-sm font-semibold text-zinc-900">Tasks & Pull Requests</h3>
                <span className="text-[11px] font-mono font-medium text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-full">
                  {project.tasks?.length || 0}
                </span>
              </div>
              <a
                href={`/tasks?new=true&projectId=${id}`}
                className="inline-flex items-center gap-1 text-xs font-medium text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 px-2.5 py-1 rounded-md border border-zinc-200/80 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Task</span>
              </a>
            </div>

            {project.tasks?.length === 0 ? (
              <div className="py-8 text-center text-xs text-zinc-400">
                No tasks assigned to this project yet. Use the button above to create one.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-zinc-50/70 border-b border-zinc-200/70">
                    <TableRow>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 py-2.5">Task</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 py-2.5">Status</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 py-2.5">Priority</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 py-2.5">Linked PRs / Branch</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 py-2.5 text-right">Assignee</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-zinc-100 text-xs">
                    {project.tasks?.map((task: any) => {
                      const priorityColor =
                        task.priority === 'CRITICAL' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                        task.priority === 'HIGH' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                        'bg-zinc-100 text-zinc-600 border-zinc-200';

                      return (
                        <TableRow key={task.id} className="hover:bg-zinc-50/70 transition-colors">
                          <TableCell className="py-3 align-top">
                            <div className="flex items-start gap-2">
                              {task.taskCode && (
                                <span className="text-[10px] font-mono font-bold text-zinc-600 bg-zinc-100 border border-zinc-200 px-1.5 py-0.5 rounded shrink-0">
                                  {task.taskCode}
                                </span>
                              )}
                              <div>
                                <a href={`/tasks/${task.id}`} className="font-medium text-zinc-900 hover:text-indigo-600 hover:underline">
                                  {task.title}
                                </a>
                                {task.githubBranch && (
                                  <div className="flex items-center gap-1 text-[11px] font-mono text-zinc-400 mt-0.5">
                                    <GitBranch className="w-3 h-3 text-zinc-400" />
                                    <span>{task.githubBranch}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </TableCell>

                          <TableCell className="py-3 align-top">
                            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${taskStatusMap[task.status] || 'bg-zinc-100 text-zinc-600 border-zinc-200'}`}>
                              {task.status?.replace('_', ' ')}
                            </span>
                          </TableCell>

                          <TableCell className="py-3 align-top">
                            <span className={`text-[10px] font-medium px-2 py-0.5 rounded border ${priorityColor}`}>
                              {task.priority || 'MEDIUM'}
                            </span>
                          </TableCell>

                          <TableCell className="py-3 align-top">
                            {task.pullRequests?.length > 0 ? (
                              <div className="space-y-1.5">
                                {task.pullRequests.map((pr: any) => (
                                  <div key={pr.id} className="p-1.5 rounded bg-zinc-50 border border-zinc-200/80 text-[11px] flex flex-col gap-1">
                                    <div className="flex items-center justify-between gap-2">
                                      <a
                                        href={pr.prUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="font-medium text-blue-600 hover:underline flex items-center gap-1 truncate"
                                      >
                                        <GitPullRequest className="w-3 h-3 shrink-0" />
                                        <span>#{pr.prNumber} {pr.prTitle}</span>
                                        <ExternalLink className="w-2.5 h-2.5 text-zinc-400 shrink-0" />
                                      </a>
                                      <span className="text-[10px] font-mono font-medium px-1 rounded bg-zinc-200/70 text-zinc-700">
                                        {pr.status}
                                      </span>
                                    </div>
                                    {pr.status === 'OPEN' && (
                                      <button
                                        type="button"
                                        className="text-[10px] text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-1.5 py-0.5 rounded font-medium w-fit flex items-center gap-1 transition-colors"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setActivePRMergeModal(pr);
                                          checkMergeability(pr.id);
                                        }}
                                      >
                                        <GitMerge className="w-2.5 h-2.5" /> Check & Merge PR
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-[11px] text-zinc-400 italic">No PRs linked</span>
                            )}
                          </TableCell>

                          <TableCell className="py-3 align-top text-right text-zinc-600 font-medium">
                            {task.assignee ? (
                              <span className="text-zinc-800">{task.assignee.firstName} {task.assignee.lastName}</span>
                            ) : (
                              <span className="text-zinc-400 italic font-normal">Unassigned</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Repository & Collaborators (No redundant mini-widget) */}
        <div className="space-y-6">
          {/* GitHub Repository Card */}
          <div className="bg-white rounded-xl border border-zinc-200/80 shadow-xs p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <GithubIcon className="w-4 h-4 text-zinc-800" />
                <h3 className="text-sm font-semibold text-zinc-900">GitHub Repository</h3>
              </div>
              {project.githubRepo && (
                <button
                  type="button"
                  className="text-[11px] text-zinc-400 hover:text-rose-600 flex items-center gap-1 transition-colors"
                  onClick={() => {
                    if (confirm(`Disconnect repository ${project.githubRepo} from this project?`)) {
                      unbindGithubMutation.mutate();
                    }
                  }}
                  disabled={unbindGithubMutation.isPending}
                >
                  <Unlink className="w-3 h-3" /> Disconnect
                </button>
              )}
            </div>

            {project.githubRepo ? (
              <div className="space-y-2.5 pt-0.5">
                <div className="p-3 bg-zinc-50/70 border border-zinc-200/80 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold text-zinc-800 truncate">
                      {project.githubRepo}
                    </span>
                    <a
                      href={`https://github.com/${project.githubRepo}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-zinc-400 hover:text-zinc-700 ml-1.5"
                      title="Open on GitHub"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                  <div className="flex items-center gap-2 pt-0.5">
                    <span className="text-[10px] font-mono bg-white px-2 py-0.5 rounded border border-zinc-200 text-zinc-600 flex items-center gap-1">
                      <GitBranch className="w-2.5 h-2.5 text-zinc-400" />
                      {project.githubDefaultBranch || 'main'}
                    </span>
                    {project.key && (
                      <span className="text-[10px] font-mono font-semibold bg-zinc-200/60 px-1.5 py-0.5 rounded text-zinc-700">
                        Prefix: task/{project.key.toLowerCase()}-*
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-[11px] text-zinc-400 leading-normal">
                  Branches and commits matching this prefix automatically link pull requests and track CI review status.
                </p>

                <div className="pt-2 border-t border-zinc-100 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-semibold text-zinc-800 block">CI/CD & Deployment</span>
                    <span className="text-[10px] text-zinc-400 block">FastPanel / Linux VPS setup</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsCicdModalOpen(true)}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100/80 px-2.5 py-1 rounded-md transition-colors flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>Setup Guide</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5 pt-1">
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Bind this project to its dedicated GitHub repository for automated task tracking and release gates.
                </p>
                <Button
                  size="sm"
                  className="w-full bg-zinc-900 hover:bg-zinc-800 text-white flex items-center justify-center gap-1.5 text-xs font-medium rounded-lg h-8.5 shadow-xs"
                  onClick={() => {
                    setProjectKeyInput(project.key || "");
                    setIsGithubModalOpen(true);
                  }}
                >
                  <GithubIcon className="w-3.5 h-3.5" /> Connect GitHub Repo
                </Button>
              </div>
            )}
          </div>

          {/* Repository Collaborators Card */}
          {project.githubRepo && (
            <div className="bg-white rounded-xl border border-zinc-200/80 shadow-xs p-4 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-zinc-700" />
                  <h3 className="text-sm font-semibold text-zinc-900">Collaborators</h3>
                  <span className="text-[10px] font-mono bg-zinc-100 text-zinc-600 px-1.5 py-0.2 rounded-full">
                    {collaboratorsData?.collaborators?.length || 0}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6.5 text-[11px] gap-1 px-2 text-zinc-700 border-zinc-200 hover:bg-zinc-50"
                  onClick={() => setIsCollaboratorModalOpen(true)}
                >
                  <UserPlus className="w-3 h-3" /> Invite
                </Button>
              </div>

              {isLoadingCollaborators ? (
                <p className="text-xs text-zinc-400 py-2">Loading repository collaborators...</p>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {collaboratorsData?.collaborators?.map((c: any) => {
                      const username = c.login || c.username || 'User';
                      const avatar = c.avatarUrl || c.avatar_url;
                      const roleName = c.role_name || c.role || 'Member';
                      return (
                        <div
                          key={c.id || username}
                          className="flex items-center justify-between p-2 rounded-lg bg-zinc-50/70 border border-zinc-200/60 text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {avatar ? (
                              <img src={avatar} alt={username} className="w-5 h-5 rounded-full shrink-0" />
                            ) : (
                              <div className="w-5 h-5 rounded-full bg-zinc-200 flex items-center justify-center text-[10px] font-bold shrink-0">
                                {username.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <span className="font-medium text-zinc-900 truncate">{username}</span>
                            <span className="text-[10px] font-mono px-1 rounded bg-zinc-100 text-zinc-500 uppercase">
                              {roleName}
                            </span>
                          </div>
                          <button
                            type="button"
                            className="text-zinc-400 hover:text-rose-600 transition-colors p-1"
                            title="Remove Collaborator"
                            onClick={() => {
                              if (confirm(`Remove ${username} from repository access?`)) {
                                removeCollaboratorMutation.mutate(username);
                              }
                            }}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {collaboratorsData?.invitations?.length > 0 && (
                    <div className="pt-2 border-t border-zinc-100 space-y-1.5">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 block">
                        Pending ({collaboratorsData.invitations.length})
                      </span>
                      {collaboratorsData.invitations.map((inv: any) => {
                        const inviteeName = typeof inv.invitee === 'string' ? inv.invitee : inv.invitee?.login || 'Invited User';
                        return (
                          <div
                            key={inv.id}
                            className="flex items-center justify-between p-1.5 rounded bg-amber-50/60 border border-amber-200/60 text-xs"
                          >
                            <span className="font-medium text-amber-900 truncate text-[11px]">{inviteeName}</span>
                            <button
                              type="button"
                              className="text-[10px] text-rose-600 hover:underline font-medium"
                              onClick={() => {
                                if (confirm(`Cancel invitation for ${inviteeName}?`)) {
                                  cancelInvitationMutation.mutate(inv.id);
                                }
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Project Resource Centre (Dedicated Full-Width Section - Minimalist Figma Grade) */}
      <div id="project-resource-centre" className="bg-white rounded-xl border border-zinc-200/80 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-zinc-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <FolderArchive className="w-4 h-4 text-zinc-800" />
              <h2 className="text-base font-semibold text-zinc-900">Project Resource Centre</h2>
              <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700 border border-zinc-200">
                {parsedAttachments.length} items
              </span>
            </div>
            <p className="text-xs text-zinc-500">
              Live Google Sheets, Google Docs, Figma design files, PRDs, and uploaded architectural specifications.
            </p>
          </div>

          <Button
            size="sm"
            onClick={() => setIsResourceModalOpen(true)}
            className="h-8.5 text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg shadow-xs flex items-center gap-1.5 px-3 self-start md:self-auto"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            <span>Add Resource / Link</span>
          </Button>
        </div>

        <div className="p-5 space-y-4">
          {/* Working Search & Segmented Filter */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-2.5" />
              <input
                type="text"
                className="w-full h-8.5 pl-8 pr-7 text-xs bg-zinc-50/70 border border-zinc-200/80 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-400 focus:bg-white transition-colors"
                placeholder="Search resources by title, keyword, author..."
                value={resourceSearchQuery}
                onChange={(e) => setResourceSearchQuery(e.target.value)}
              />
              {resourceSearchQuery && (
                <button
                  type="button"
                  onClick={() => setResourceSearchQuery("")}
                  className="absolute right-2.5 top-2.5 text-zinc-400 hover:text-zinc-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Segmented Filter Pills */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0">
              {RESOURCE_CATEGORIES.map((cat) => {
                const count = cat.id === 'ALL' ? parsedAttachments.length : (categoryCounts[cat.id] || 0);
                const isSelected = selectedResourceCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedResourceCategory(cat.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-zinc-900 text-white shadow-xs'
                        : 'bg-zinc-100/70 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                    }`}
                  >
                    <span>{cat.label}</span>
                    <span className={`text-[10px] px-1 rounded-full font-mono ${isSelected ? 'bg-zinc-800 text-zinc-200' : 'bg-zinc-200 text-zinc-600'}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Table or Empty State */}
          {filteredAttachments.length === 0 ? (
            <div className="text-center py-12 px-4 rounded-xl border border-dashed border-zinc-200 bg-zinc-50/40">
              <div className="w-10 h-10 rounded-full bg-zinc-100 text-zinc-500 mx-auto flex items-center justify-center mb-2.5">
                <FolderArchive className="w-5 h-5" />
              </div>
              <h4 className="text-xs font-semibold text-zinc-800">
                {resourceSearchQuery || selectedResourceCategory !== 'ALL'
                  ? "No matching documents found"
                  : "No project resources linked yet"}
              </h4>
              <p className="text-[11px] text-zinc-400 max-w-sm mx-auto mt-1 mb-3">
                {resourceSearchQuery || selectedResourceCategory !== 'ALL'
                  ? "Try adjusting your query or resetting category filter."
                  : "Keep documents organized. Add live Google Sheets, Docs, Figma links, or upload specs."}
              </p>
              <Button
                size="sm"
                onClick={() => setIsResourceModalOpen(true)}
                className="h-7 text-xs bg-zinc-900 text-white font-medium rounded-lg"
              >
                <FolderPlus className="w-3 h-3 mr-1" /> Add First Resource
              </Button>
            </div>
          ) : (
            <div className="border border-zinc-200/80 rounded-lg overflow-hidden bg-white">
              <Table>
                <TableHeader className="bg-zinc-50/70 border-b border-zinc-200/70">
                  <TableRow>
                    <TableHead className="w-[42%] text-[11px] font-semibold uppercase tracking-wider text-zinc-500 py-2.5">Resource / Document</TableHead>
                    <TableHead className="w-[16%] text-[11px] font-semibold uppercase tracking-wider text-zinc-500 py-2.5">Category</TableHead>
                    <TableHead className="w-[22%] text-[11px] font-semibold uppercase tracking-wider text-zinc-500 py-2.5">Uploaded</TableHead>
                    <TableHead className="w-[10%] text-[11px] font-semibold uppercase tracking-wider text-zinc-500 py-2.5">Type</TableHead>
                    <TableHead className="w-[10%] text-right text-[11px] font-semibold uppercase tracking-wider text-zinc-500 py-2.5">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-zinc-100 text-xs">
                  {filteredAttachments.map((att: any) => {
                    const base = typeof window !== 'undefined' ? '/api' : (process.env.NEXT_PUBLIC_API_URL || '/api');
                    const downloadUrl = att.url.startsWith('http') ? att.url : `${base}${att.url}`;
                    const categoryObj = RESOURCE_CATEGORIES.find(c => c.id === att.meta.category) || RESOURCE_CATEGORIES[5];

                    // Visual icon style
                    let iconBg = "bg-zinc-100 text-zinc-700 border-zinc-200";
                    let IconComponent = FileText;

                    if (att.meta.ext === 'SHEET') {
                      iconBg = "bg-emerald-50 text-emerald-700 border-emerald-200";
                      IconComponent = FileSpreadsheet;
                    } else if (att.meta.ext === 'DOCS') {
                      iconBg = "bg-blue-50 text-blue-700 border-blue-200";
                      IconComponent = FileText;
                    } else if (att.meta.ext === 'FIGMA') {
                      iconBg = "bg-purple-50 text-purple-700 border-purple-200";
                      IconComponent = Palette;
                    } else if (att.meta.ext === 'REPO') {
                      iconBg = "bg-zinc-100 text-zinc-700 border-zinc-300";
                      IconComponent = GitBranch;
                    }

                    return (
                      <TableRow key={att.id} className="hover:bg-zinc-50/70 transition-colors">
                        <TableCell className="py-2.5 align-middle">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg border flex items-center justify-center font-bold text-[10px] shrink-0 ${iconBg}`}>
                              <IconComponent className="w-4 h-4" />
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span 
                                onClick={() => window.open(downloadUrl, '_blank')}
                                className="font-medium text-xs text-zinc-900 hover:text-indigo-600 cursor-pointer truncate flex items-center gap-1.5"
                                title={att.meta.displayName}
                              >
                                {att.meta.displayName}
                                {att.meta.isLink && (
                                  <ExternalLink className="w-3 h-3 text-zinc-400 shrink-0" />
                                )}
                              </span>
                              <span className="text-[11px] text-zinc-400 font-mono truncate" title={att.meta.rawName}>
                                {att.meta.isLink ? att.url : att.meta.rawName}
                              </span>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell className="py-2.5 align-middle">
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded border ${categoryObj.color}`}>
                            {categoryObj.label}
                          </span>
                        </TableCell>

                        <TableCell className="py-2.5 align-middle">
                          <div className="flex flex-col text-[11px] text-zinc-600">
                            <span className="font-medium text-zinc-800">{att.meta.formattedDate}</span>
                            <span className="text-zinc-400">{att.meta.uploaderName}</span>
                          </div>
                        </TableCell>

                        <TableCell className="py-2.5 align-middle font-mono text-[11px] text-zinc-500">
                          {att.meta.isLink ? (
                            <span className="text-[10px] font-sans font-medium text-indigo-600 bg-indigo-50/80 px-2 py-0.5 rounded border border-indigo-100">
                              Link
                            </span>
                          ) : (
                            att.meta.formattedSize
                          )}
                        </TableCell>

                        <TableCell className="py-2.5 align-middle text-right">
                          <div className="flex items-center justify-end gap-1">
                            {att.meta.isLink ? (
                              <a
                                href={att.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition-colors"
                                title="Open link in new tab"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                <span>Open</span>
                              </a>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition-colors"
                                  title="View / Open document in new tab"
                                  onClick={() => window.open(downloadUrl, '_blank')}
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>View</span>
                                </button>
                                <a
                                  href={downloadUrl}
                                  download
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 transition-colors"
                                  title="Download File"
                                >
                                  <Download className="w-3.5 h-3.5 text-zinc-500" />
                                </a>
                              </>
                            )}
                            <button
                              type="button"
                              className="h-7 w-7 rounded flex items-center justify-center text-zinc-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                              title="Delete Resource"
                              onClick={() => handleDeleteResource(att.id, att.meta.displayName)}
                              disabled={deleteAttachmentMutation.isPending}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>

      {/* Project Release Notes Section */}
      <div className="bg-white rounded-xl border border-zinc-200/80 shadow-xs p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-100">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-zinc-700" /> Release Notes
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">Automated changelogs compiled from verified pull requests and PR merges.</p>
          </div>
          <Button
            size="sm"
            onClick={() => generateDraftMutation.mutate()}
            disabled={generateDraftMutation.isPending}
            className="h-8 text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg shadow-xs flex items-center gap-1.5 px-3 self-start sm:self-auto"
          >
            <Plus className="w-3 h-3" />
            <span>{generateDraftMutation.isPending ? "Generating..." : "Generate Release Note"}</span>
          </Button>
        </div>

        {releaseNotes.length === 0 ? (
          <div className="text-center py-6 text-xs text-zinc-400 bg-zinc-50/60 rounded-lg border border-dashed border-zinc-200">
            No release notes generated yet. Click &quot;Generate Release Note&quot; to compile merged features.
          </div>
        ) : (
          <div className="space-y-4">
            {releaseNotes.map((note: any) => (
              <div key={note.id} className="p-4 rounded-lg border border-zinc-200 bg-zinc-50/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-zinc-900 text-xs">{note.title}</h4>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-medium border ${note.isPublished ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-800 border-amber-200"}`}>
                      {note.isPublished ? "Published" : "Draft (Unpublished)"}
                    </span>
                  </div>
                  <span className="text-[11px] text-zinc-400">
                    {new Date(note.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="text-xs text-zinc-700 bg-white p-3 rounded border border-zinc-200/80 font-mono whitespace-pre-wrap leading-relaxed">
                  {note.summary}
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-zinc-200/60 text-xs text-zinc-500">
                  <span>
                    {note.isPublished ? (
                      <>Published by <strong>{note.publishedBy?.firstName} {note.publishedBy?.lastName}</strong> on {note.publishedAt ? new Date(note.publishedAt).toLocaleDateString() : '—'}</>
                    ) : (
                      <>Requires manager approval before publication</>
                    )}
                  </span>
                  {!note.isPublished && (
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-7 flex items-center gap-1 shadow-xs"
                      onClick={() => publishReleaseNoteMutation.mutate(note.id)}
                      disabled={publishReleaseNoteMutation.isPending}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {publishReleaseNoteMutation.isPending ? "Publishing..." : "Approve & Publish"}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Client Reported Tickets */}
      {project.tickets?.length > 0 && (
        <div className="bg-white rounded-xl border border-zinc-200/80 shadow-xs p-5 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-zinc-100">
            <h3 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
              🎫 Client Reported Tickets
            </h3>
            <span className="text-[11px] font-mono font-medium text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-full">
              {project.tickets.length}
            </span>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-zinc-50/70 border-b border-zinc-200/70">
                <TableRow>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 py-2.5">Title</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 py-2.5">Category</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 py-2.5">Status</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 py-2.5">Priority</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 py-2.5">Raised On</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-zinc-100 text-xs">
                {project.tickets.map((ticket: any) => {
                  const priCls: Record<string, string> = {
                    CRITICAL: 'bg-rose-50 text-rose-700 border-rose-200',
                    HIGH: 'bg-orange-50 text-orange-700 border-orange-200',
                    MEDIUM: 'bg-amber-50 text-amber-700 border-amber-200',
                    LOW: 'bg-zinc-100 text-zinc-600 border-zinc-200',
                  };
                  return (
                    <TableRow key={ticket.id} className="hover:bg-zinc-50/70">
                      <TableCell className="font-medium">
                        <a href={`/tickets/${ticket.id}`} className="text-zinc-900 hover:text-indigo-600 text-xs">{ticket.title}</a>
                      </TableCell>
                      <TableCell className="text-xs text-zinc-600">{ticket.category || '—'}</TableCell>
                      <TableCell className="text-xs text-zinc-600">{ticket.status?.replace('_', ' ')}</TableCell>
                      <TableCell>
                        <span className={`text-[10px] px-2 py-0.5 rounded border font-medium ${priCls[ticket.priority] || 'bg-zinc-100 text-zinc-600'}`}>
                          {ticket.priority}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-zinc-400">{new Date(ticket.createdAt).toLocaleDateString('en-IN')}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <Modal isOpen={isMilestoneOpen} onClose={() => setIsMilestoneOpen(false)} title="Add Delivery Milestone" subtitle="Create a new milestone to track delivery timelines.">
        <form onSubmit={handleCreateMilestone} className="p-6 space-y-4">
          <FormField label="Milestone Name" required>
            <input className={inputCls} value={milestoneForm.name} onChange={e => setMilestoneForm(f => ({ ...f, name: e.target.value }))} required />
          </FormField>
          <FormField label="Description">
            <textarea className="w-full min-h-[80px] p-2 border rounded-md text-sm" value={milestoneForm.description} onChange={e => setMilestoneForm(f => ({ ...f, description: e.target.value }))} />
          </FormField>
          <FormField label="Due Date">
            <input type="date" className={inputCls} value={milestoneForm.dueDate} onChange={e => setMilestoneForm(f => ({ ...f, dueDate: e.target.value }))} />
          </FormField>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setIsMilestoneOpen(false)} className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg">Cancel</button>
            <button type="submit" disabled={createMilestoneMutation.isPending} className="flex-1 flex items-center justify-center px-4 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg">
              {createMilestoneMutation.isPending ? "Adding..." : "Add Milestone"}
            </button>
          </div>
        </form>
      </Modal>
      {/* GitHub Repository Connect Modal */}
      <Modal
        isOpen={isGithubModalOpen}
        onClose={() => setIsGithubModalOpen(false)}
        title="Connect GitHub Repository"
        subtitle={`Link a GitHub repository to ${project.name}`}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!selectedRepoFullName || !selectedInstallationId) {
              alert("Please select a GitHub repository.");
              return;
            }
            bindGithubMutation.mutate({
              installationId: selectedInstallationId,
              repoFullName: selectedRepoFullName,
              key: projectKeyInput ? projectKeyInput.toUpperCase().trim() : undefined,
            });
          }}
          className="p-6 space-y-4"
        >
          {availableGithubData?.isConfigured === false ? (
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-xs">
              GitHub App is not configured on this server. Please ensure <code>GITHUB_APP_ID</code> and <code>GITHUB_APP_PRIVATE_KEY</code> are set.
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs">
                <Shield className="w-4 h-4 text-emerald-600 shrink-0" />
                <span><strong>Strict Isolation Active:</strong> Student accounts and student repositories are completely isolated and excluded from company projects.</span>
              </div>

              {availableGithubData?.installations?.length === 0 ? (
                <div className="p-5 bg-slate-50 border border-slate-200 rounded-lg text-center space-y-3 my-2">
                  <div className="w-10 h-10 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center mx-auto text-indigo-600">
                    <GithubIcon className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-semibold text-slate-800">No Company Repositories Found</h4>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      To connect your internal company repositories, please install the GitHub App on your organization (<strong>neuravolt-technologies</strong>).
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
                    <a
                      href={availableGithubData?.installUrl || "https://github.com/apps/neuravolt-launchpad/installations/new"}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-xs font-medium"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Install App on GitHub Organization
                    </a>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => queryClient.invalidateQueries({ queryKey: ['available-github-repos'] })}
                    >
                      Refresh List
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <label className="font-semibold text-slate-700">Select Company Repository *</label>
                    <div className="flex items-center gap-2">
                      <a
                        href={availableGithubData?.selectTargetUrl || availableGithubData?.installUrl || "https://github.com/apps/neuravolt-launchpad/installations/select_target"}
                        target="_blank"
                        rel="noreferrer"
                        className="text-indigo-600 hover:text-indigo-700 hover:underline flex items-center gap-1 font-medium text-[11px]"
                        title="Add/choose GitHub account or grant repo permissions"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Add / Manage GitHub Accounts</span>
                      </a>
                      <button
                        type="button"
                        onClick={() => queryClient.invalidateQueries({ queryKey: ['available-github-repos'] })}
                        className="text-slate-600 hover:text-slate-900 flex items-center gap-1 text-[11px] bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded transition font-medium"
                        title="Refresh repository list"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Refresh</span>
                      </button>
                    </div>
                  </div>

                  {isLoadingGithubRepos ? (
                    <div className="text-xs text-slate-500 py-2">Loading accessible repositories...</div>
                  ) : (
                    <select
                      className={inputCls}
                      value={`${selectedInstallationId}:::${selectedRepoFullName}`}
                      onChange={(e) => {
                        const [instId, repo] = e.target.value.split(":::");
                        setSelectedInstallationId(instId || "");
                        setSelectedRepoFullName(repo || "");
                      }}
                      required
                    >
                      <option value=":::">-- Choose a repository --</option>
                      {availableGithubData?.installations?.map((inst: any) => (
                        <optgroup key={inst.id} label={`${inst.account?.login} (${inst.account?.type || 'Org'})`}>
                          {inst.repositories?.map((r: any) => (
                            <option key={r.id} value={`${inst.id}:::${r.fullName}`}>
                              {r.fullName} {r.private ? "(Private)" : ""}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  )}
                  <p className="text-[11px] text-slate-400">
                    Want to connect another GitHub ID or organization? Click <strong>Add / Manage GitHub Accounts</strong> above, then click <strong>Refresh</strong>.
                  </p>
                </div>
              )}

              <FormField label="Project Key (e.g. NV, CORE, XAR)">
                <input
                  type="text"
                  className={`${inputCls} font-mono uppercase`}
                  placeholder="e.g. CORE"
                  maxLength={10}
                  value={projectKeyInput}
                  onChange={(e) => setProjectKeyInput(e.target.value.toUpperCase())}
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Uppercase prefix used for task codes (e.g. CORE-1) and branch names (e.g. task/core-1-auth).
                </p>
              </FormField>
            </>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsGithubModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              disabled={bindGithubMutation.isPending || !selectedRepoFullName || availableGithubData?.isConfigured === false}
            >
              {bindGithubMutation.isPending ? "Connecting..." : "Connect Repository"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Collaborator Invite Modal */}
      {isCollaboratorModalOpen && (
        <Modal
          isOpen={isCollaboratorModalOpen}
          onClose={() => {
            setIsCollaboratorModalOpen(false);
            setCollabSearchQuery("");
            setSelectedInviteUsername("");
          }}
          title="Invite Developer to Repository"
          subtitle={`Connected Repository: ${project?.githubRepo || ''}`}
        >
          <div className="p-6 space-y-4">
            <FormField label="Search Developer by GitHub Username" required>
              <div className="relative">
                <input
                  type="text"
                  className={inputCls}
                  placeholder="Type GitHub username (min 2 characters)..."
                  value={collabSearchQuery}
                  onChange={(e) => {
                    setCollabSearchQuery(e.target.value);
                    if (selectedInviteUsername && e.target.value !== selectedInviteUsername) {
                      setSelectedInviteUsername("");
                    }
                  }}
                />
                {isSearchingUsers && (
                  <div className="absolute right-3 top-2.5">
                    <Clock className="w-4 h-4 animate-spin text-indigo-600" />
                  </div>
                )}
              </div>
            </FormField>

            {/* Search Results */}
            {searchResults.length > 0 && !selectedInviteUsername && (
              <div className="border rounded-lg max-h-48 overflow-y-auto divide-y bg-white shadow-sm">
                {searchResults.map((user: any) => {
                  const avatar = user.avatar_url || user.avatarUrl;
                  const username = user.login || user.username || "Dev";
                  return (
                    <div
                      key={user.id}
                      className="p-2.5 flex items-center justify-between hover:bg-slate-50 cursor-pointer"
                      onClick={() => {
                        setSelectedInviteUsername(username);
                        setCollabSearchQuery(username);
                      }}
                    >
                      <div className="flex items-center gap-2.5">
                        {avatar ? (
                          <img
                            src={avatar}
                            alt={username}
                            className="w-7 h-7 rounded-full border border-slate-200 object-cover"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                              const next = (e.target as HTMLElement).nextElementSibling as HTMLElement;
                              if (next) next.style.display = 'flex';
                            }}
                          />
                        ) : null}
                        <div
                          className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center border border-indigo-200"
                          style={{ display: avatar ? 'none' : 'flex' }}
                        >
                          {username.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-semibold text-xs text-slate-900 leading-tight">@{username}</span>
                          {user.name && <span className="text-[11px] text-slate-500 leading-tight">{user.name}</span>}
                        </div>
                      </div>
                      <Button size="sm" variant="ghost" className="h-6 text-xs text-indigo-600">
                        Select
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}

            {selectedInviteUsername && (
              <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-indigo-900">Selected:</span>
                  <span className="font-mono font-bold text-indigo-700">@{selectedInviteUsername}</span>
                </div>
                <button
                  type="button"
                  className="text-xs text-indigo-600 hover:underline"
                  onClick={() => {
                    setSelectedInviteUsername("");
                    setCollabSearchQuery("");
                  }}
                >
                  Clear
                </button>
              </div>
            )}

            <FormField label="Repository Permission Level" required>
              <select
                className={inputCls}
                value={selectedInvitePermission}
                onChange={(e) => setSelectedInvitePermission(e.target.value)}
              >
                <option value="push">Write (Push) - Recommended for Developers</option>
                <option value="triage">Triage - Issues and PRs management</option>
                <option value="pull">Read (Pull) - View and clone only</option>
                <option value="maintain">Maintain - Repository maintenance without full admin</option>
              </select>
              <p className="text-[11px] text-slate-400 mt-1">
                Admin permissions are restricted by enterprise policy and cannot be granted through project dashboard.
              </p>
            </FormField>

            <div className="p-3 bg-slate-50 border rounded-lg text-xs text-slate-600 space-y-1">
              <div className="font-semibold text-slate-800 flex items-center gap-1">
                <Shield className="w-3.5 h-3.5 text-indigo-600" /> Enterprise Access Guard
              </div>
              <p>
                GitHub will send an email invitation to the developer. Developer access will be marked as <strong>Pending</strong> until accepted on GitHub.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsCollaboratorModalOpen(false);
                  setSelectedInviteUsername("");
                  setCollabSearchQuery("");
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
                disabled={!selectedInviteUsername || inviteCollaboratorMutation.isPending}
                onClick={() => {
                  inviteCollaboratorMutation.mutate({
                    username: selectedInviteUsername,
                    permission: selectedInvitePermission,
                  });
                }}
              >
                {inviteCollaboratorMutation.isPending ? "Sending..." : "Send GitHub Invitation"}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* In-App PR Merge Gate Modal */}
      {activePRMergeModal && (
        <Modal
          isOpen={!!activePRMergeModal}
          onClose={() => setActivePRMergeModal(null)}
          title={`Merge Pull Request #${activePRMergeModal.prNumber}`}
          subtitle={`${activePRMergeModal.repoFullName} • ${activePRMergeModal.headBranch} ➔ ${activePRMergeModal.baseBranch}`}
        >
          <div className="p-6 space-y-4">
            <div className="p-3 bg-slate-50 border rounded-lg text-sm">
              <div className="font-semibold text-slate-900">{activePRMergeModal.prTitle}</div>
              <a
                href={activePRMergeModal.prUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-1"
              >
                View on GitHub <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            {isCheckingMergeability ? (
              <div className="p-4 bg-slate-50 border rounded-lg text-center text-xs text-slate-600 flex items-center justify-center gap-2">
                <Clock className="w-4 h-4 animate-spin text-indigo-600" />
                <span>Checking fresh mergeability and branch protections with GitHub...</span>
              </div>
            ) : mergeabilityData ? (
              <div className="space-y-3">
                {mergeabilityData.canMerge ? (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs space-y-1">
                    <div className="font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Ready to Merge
                    </div>
                    <p>PR passes all repository checks and has no merge conflicts.</p>
                  </div>
                ) : (
                  <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-xs space-y-1">
                    <div className="font-semibold flex items-center gap-1">
                      <AlertTriangle className="w-4 h-4 text-amber-600" /> Merge Blocked
                    </div>
                    <p>{mergeabilityData.reason || "GitHub has blocked merging this pull request."}</p>
                  </div>
                )}

                {mergeabilityData.canMerge && (
                  <>
                    <FormField label="Merge Strategy">
                      <select
                        className={inputCls}
                        value={selectedMergeMethod}
                        onChange={(e) => setSelectedMergeMethod(e.target.value as any)}
                      >
                        <option value="squash">Squash and Merge (Recommended)</option>
                        <option value="merge">Create a Merge Commit</option>
                      </select>
                    </FormField>

                    <div className="p-3 bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-lg text-xs">
                      <strong>QA Workflow Policy:</strong> Merging will update the remote repository branch. The linked task will be retained in <strong>REVIEW</strong> status for QA testing and verification before completion.
                    </div>
                  </>
                )}
              </div>
            ) : null}

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => setActivePRMergeModal(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1"
                disabled={!mergeabilityData?.canMerge || mergePRMutation.isPending || isCheckingMergeability}
                onClick={() => {
                  mergePRMutation.mutate({
                    prId: activePRMergeModal.id,
                    mergeMethod: selectedMergeMethod,
                  });
                }}
              >
                <GitMerge className="w-4 h-4" />
                {mergePRMutation.isPending ? "Merging..." : "Confirm & Merge PR"}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Upload Resource Modal */}
      {isResourceModalOpen && (
        <Modal
          isOpen={isResourceModalOpen}
          onClose={() => {
            setIsResourceModalOpen(false);
            setNewResourceFile(null);
            setNewResourceCustomName("");
            setNewResourceUrl("");
            setNewResourceLinkTitle("");
            setResourceTab("file");
          }}
          title={resourceTab === 'file' ? "Upload Project Document / Asset" : "Add External Resource Link"}
          subtitle="Add Google Docs, Google Sheets, Figma designs, specs, or upload project files."
        >
          <div className="p-6 space-y-4">
            {/* Mode Switcher Tabs */}
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setResourceTab('file')}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  resourceTab === 'file'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FolderPlus className="w-3.5 h-3.5" /> Upload File
              </button>
              <button
                type="button"
                onClick={() => setResourceTab('link')}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  resourceTab === 'link'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ExternalLink className="w-3.5 h-3.5" /> External Link (Docs, Sheets, Figma)
              </button>
            </div>

            {resourceTab === 'file' ? (
              <>
                <FormField label="Choose File" required>
                  <div 
                    className="border-2 border-dashed border-slate-200 rounded-lg p-5 text-center hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => document.getElementById('resource-file-input')?.click()}
                  >
                    <input
                      type="file"
                      id="resource-file-input"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setNewResourceFile(e.target.files[0]);
                        }
                      }}
                    />
                    {newResourceFile ? (
                      <div className="flex flex-col items-center">
                        <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2">
                          <FolderArchive className="w-5 h-5" />
                        </div>
                        <span className="font-semibold text-xs text-slate-900">{newResourceFile.name}</span>
                        <span className="text-[11px] text-slate-400">
                          {(newResourceFile.size / 1024).toFixed(1)} KB • Click to change file
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center">
                        <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mb-2">
                          <FolderPlus className="w-5 h-5" />
                        </div>
                        <span className="text-xs font-semibold text-slate-700">Click to browse or select a file</span>
                        <span className="text-[11px] text-slate-400 mt-0.5">
                          PDF, DOCX, ZIP, XLSX, PNG, JPG, CSV, SVG up to 50MB
                        </span>
                      </div>
                    )}
                  </div>
                </FormField>

                <FormField label="Display Name (Optional)">
                  <div>
                    <input
                      type="text"
                      className={inputCls}
                      placeholder="e.g. System Architecture Spec v1.0"
                      value={newResourceCustomName}
                      onChange={(e) => setNewResourceCustomName(e.target.value)}
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      Friendly title. If left blank, original filename ({newResourceFile ? newResourceFile.name : 'filename.ext'}) will be used.
                    </p>
                  </div>
                </FormField>
              </>
            ) : (
              <>
                <FormField label="Resource URL (Google Docs, Sheet, Figma, PRD, Notion)" required>
                  <div>
                    <input
                      type="url"
                      className={inputCls}
                      placeholder="https://docs.google.com/spreadsheets/d/... or https://docs.google.com/..."
                      value={newResourceUrl}
                      onChange={(e) => setNewResourceUrl(e.target.value)}
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      Paste live Google Sheets, Google Docs, Figma designs, Notion workspaces, or PRDs.
                    </p>
                  </div>
                </FormField>

                <FormField label="Resource Title / Label" required>
                  <div>
                    <input
                      type="text"
                      className={inputCls}
                      placeholder="e.g. Foxrun Master Operations & Driver Payout Sheet"
                      value={newResourceLinkTitle}
                      onChange={(e) => setNewResourceLinkTitle(e.target.value)}
                    />
                  </div>
                </FormField>
              </>
            )}

            <FormField label="Resource Category" required>
              <select
                className={inputCls}
                value={newResourceCategory}
                onChange={(e) => setNewResourceCategory(e.target.value)}
              >
                <option value="DOCS">Documentation & Specifications</option>
                <option value="CONTRACT">Contracts & Statement of Work (SOW)</option>
                <option value="DESIGN">Design & Creative Assets</option>
                <option value="DELIVERABLE">Client Deliverables & Final Artifacts</option>
                <option value="OTHER">Other Project Documents</option>
              </select>
            </FormField>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsResourceModalOpen(false);
                  setNewResourceFile(null);
                  setNewResourceCustomName("");
                  setNewResourceUrl("");
                  setNewResourceLinkTitle("");
                  setResourceTab("file");
                }}
              >
                Cancel
              </Button>
              {resourceTab === 'file' ? (
                <Button
                  type="button"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5"
                  disabled={!newResourceFile || isUploadingResource}
                  onClick={handleUploadResource}
                >
                  <FolderPlus className="w-4 h-4" />
                  {isUploadingResource ? "Uploading..." : "Upload Document"}
                </Button>
              ) : (
                <Button
                  type="button"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5"
                  disabled={!newResourceUrl.trim() || isUploadingResource}
                  onClick={handleSaveResourceLink}
                >
                  <ExternalLink className="w-4 h-4" />
                  {isUploadingResource ? "Saving Link..." : "Save Resource Link"}
                </Button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* CI/CD & Deployment Guide Modal */}
      {isCicdModalOpen && (
        <Modal
          isOpen={isCicdModalOpen}
          onClose={() => setIsCicdModalOpen(false)}
          title="CI/CD & Server Deployment Setup"
          subtitle="Universal Automated Deployment Guide for FastPanel & Linux VPS"
          maxWidth="max-w-3xl"
        >
          <div className="p-6 space-y-5">
            {/* Input Config Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-900 mb-1">
                  Server Application Directory Path <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  className={inputCls}
                  placeholder="e.g. /var/www/dewstream_in_usr/data/www/dewstream.in"
                  value={cicdServerPath}
                  onChange={(e) => setCicdServerPath(e.target.value)}
                />
                <p className="text-[11px] text-zinc-400 mt-1">
                  Copy from FastPanel (Site Settings &rarr; Path) or Linux server.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-900 mb-1">
                  Application Port (e.g. Node / Python)
                </label>
                <input
                  type="text"
                  className={inputCls}
                  placeholder="e.g. 3005 (or 3010+)"
                  value={cicdAppPort}
                  onChange={(e) => setCicdAppPort(e.target.value)}
                />
                <p className="text-[11px] text-amber-600 font-medium mt-1">
                  ⚠️ Busy system ports: 3000, 3001, 3002, 3306, 5432, 6379, 80, 443
                </p>
              </div>
            </div>

            {/* Checklist Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
                <span className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
                  One-Time Server Setup Checklist
                </span>
                <span className="text-[11px] text-zinc-400">Run once per project/server</span>
              </div>

              {/* Step 1 */}
              <div className="p-3.5 rounded-xl border border-zinc-200/80 bg-zinc-50/50 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-zinc-900 text-white text-[10px] font-bold flex items-center justify-center">1</span>
                    <span className="text-xs font-semibold text-zinc-900">Initial Server Clone</span>
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-zinc-200/70 text-zinc-700">
                    Run on Server via SSH
                  </span>
                </div>
                <div className="relative group">
                  <pre className="bg-zinc-900 text-zinc-100 text-[11px] font-mono p-2.5 rounded-lg overflow-x-auto whitespace-pre-wrap select-all">
                    {`git clone git@github.com:${project.githubRepo || '<org/repo>'}.git ${cicdServerPath || '<folder>'}`}
                  </pre>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(`git clone git@github.com:${project.githubRepo || '<org/repo>'}.git ${cicdServerPath || '<folder>'}`);
                      alert("Clone command copied!");
                    }}
                    className="absolute right-2 top-2 px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-[10px] font-medium transition-colors"
                  >
                    Copy
                  </button>
                </div>
              </div>

              {/* Step 2 */}
              <div className="p-3.5 rounded-xl border border-zinc-200/80 bg-zinc-50/50 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-zinc-900 text-white text-[10px] font-bold flex items-center justify-center">2</span>
                    <span className="text-xs font-semibold text-zinc-900">SSH Deploy Key Setup</span>
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">
                    Run on Local Laptop or Server
                  </span>
                </div>
                <p className="text-[11px] text-zinc-600 leading-normal">
                  Generate an SSH key pair in your local terminal or directly on the server:
                </p>
                <div className="relative group">
                  <pre className="bg-zinc-900 text-zinc-100 text-[11px] font-mono p-2.5 rounded-lg overflow-x-auto whitespace-pre-wrap select-all">
                    ssh-keygen -t ed25519 -C "github-deploy" -N ""
                  </pre>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(`ssh-keygen -t ed25519 -C "github-deploy" -N ""`);
                      alert("Keygen command copied!");
                    }}
                    className="absolute right-2 top-2 px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-[10px] font-medium transition-colors"
                  >
                    Copy
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] pt-1">
                  <div className="p-2.5 rounded-lg bg-white border border-zinc-200">
                    <span className="font-semibold text-zinc-900 block mb-0.5">🔑 Public Key (id_ed25519.pub):</span>
                    <span className="text-zinc-500">Append content into server's <code className="font-mono text-zinc-800 bg-zinc-100 px-1 py-0.5 rounded">~/.ssh/authorized_keys</code></span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white border border-zinc-200">
                    <span className="font-semibold text-zinc-900 block mb-0.5">🔒 Private Key (id_ed25519):</span>
                    <span className="text-zinc-500">Add content into GitHub Secret <code className="font-mono text-zinc-800 bg-zinc-100 px-1 py-0.5 rounded">SERVER_SSH_KEY</code></span>
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="p-3.5 rounded-xl border border-zinc-200/80 bg-zinc-50/50 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-zinc-900 text-white text-[10px] font-bold flex items-center justify-center">3</span>
                    <span className="text-xs font-semibold text-zinc-900">GitHub Repository Secrets</span>
                  </div>
                  <span className="text-[11px] text-zinc-500">GitHub &rarr; Settings &rarr; Secrets &rarr; Actions</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono">
                  <div className="p-2 rounded-lg bg-white border border-zinc-200">
                    <span className="font-semibold text-zinc-900 block">SERVER_HOST</span>
                    <span className="text-[10px] text-zinc-400 font-sans">e.g. 187.127.x.x</span>
                  </div>
                  <div className="p-2 rounded-lg bg-white border border-zinc-200">
                    <span className="font-semibold text-zinc-900 block">SERVER_USER</span>
                    <span className="text-[10px] text-zinc-400 font-sans">e.g. root or fastuser</span>
                  </div>
                  <div className="p-2 rounded-lg bg-white border border-zinc-200">
                    <span className="font-semibold text-zinc-900 block">SERVER_SSH_KEY</span>
                    <span className="text-[10px] text-zinc-400 font-sans">Private key content</span>
                  </div>
                  <div className="p-2 rounded-lg bg-white border border-zinc-200">
                    <span className="font-semibold text-zinc-900 block">SERVER_APP_DIR</span>
                    <span className="text-[10px] text-zinc-400 font-sans truncate block">{cicdServerPath || '/var/www/...'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* AI Generator Action Box */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-50/70 to-blue-50/70 border border-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  <span>Generate CI/CD with AI (Antigravity / Claude)</span>
                </div>
                <p className="text-[11px] text-indigo-800/80">
                  Copies a full context prompt with port conflict rules, deploy script, and GitHub Actions workflow.
                </p>
              </div>

              <button
                type="button"
                onClick={handleCopyCicdPrompt}
                className={`flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-lg text-xs font-semibold transition-all shadow-xs shrink-0 ${
                  copiedCicdPrompt
                    ? "bg-emerald-600 text-white"
                    : "bg-indigo-600 hover:bg-indigo-700 text-white"
                }`}
              >
                {copiedCicdPrompt ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-white" />
                    <span>Copied to Clipboard!</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>Copy CI/CD Prompt</span>
                  </>
                )}
              </button>
            </div>

            <div className="flex justify-end pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCicdModalOpen(false)}
                className="text-xs"
              >
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
