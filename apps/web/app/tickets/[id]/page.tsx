"use client";

import { useState, useEffect, use } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../src/lib/api";
import { useUsers, useProjects, useTasks, useUploadAttachment, useAmcContracts } from "../../../src/hooks/queries";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";
import { Clock, MessageSquare, Shield, AlertTriangle, Send, User, Plus, Paperclip } from "lucide-react";
import { Modal, FormField, inputCls, selectCls } from "../../components/Modal";

export default function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const id = resolvedParams.id;
  const queryClient = useQueryClient();
  const uploadAttachment = useUploadAttachment();
  
  const [newComment, setNewComment] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [isAttachmentInternal, setIsAttachmentInternal] = useState(false);
  const [slaTimeLeft, setSlaTimeLeft] = useState("");
  const [isEscalateOpen, setIsEscalateOpen] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: "", description: "", projectId: "", assigneeId: "", priority: "MEDIUM", dueDate: "" });

  const { data: tasksData } = useTasks();
  const tasks = Array.isArray(tasksData) ? tasksData : (tasksData as any)?.tasks || [];
  const linkedTask = tasks.find((t: any) => t.ticketId === id);

  // Fetch Ticket Details
  const { data: ticket, isLoading, isError, error, refetch: refetchTicket } = useQuery({
    queryKey: ['ticket', id],
    queryFn: async () => {
      const { data } = await api.get(`/tickets/${id}`);
      return data;
    }
  });

  // Calculate SLA countdown
  useEffect(() => {
    if (!ticket?.slaDeadline) return;

    const timer = setInterval(() => {
      const difference = +new Date(ticket.slaDeadline) - +new Date();
      if (difference <= 0) {
        setSlaTimeLeft("SLA BREACHED");
        clearInterval(timer);
        return;
      }

      const hours = Math.floor(difference / (1000 * 60 * 60));
      const minutes = Math.floor((difference / 1000 / 60) % 60);
      const seconds = Math.floor((difference / 1000) % 60);

      setSlaTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
    }, 1000);

    return () => clearInterval(timer);
  }, [ticket?.slaDeadline]);

  const reopenTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const { data } = await api.patch(`/tasks/${taskId}/status`, { status: "TODO" });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      alert("Task has been reopened!");
    }
  });

  const updateTaskAssigneeMutation = useMutation({
    mutationFn: async ({ taskId, assigneeId }: { taskId: string; assigneeId: string | null }) => {
      const { data } = await api.patch(`/tasks/${taskId}`, { assigneeId: assigneeId || "" });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      alert("Task assignee updated!");
    }
  });

  // Update Ticket Status Mutation
  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      const { data } = await api.patch(`/tickets/${id}`, { status });
      return data;
    },
    onSuccess: (data, status) => {
      queryClient.invalidateQueries({ queryKey: ['ticket', id] });
      // If ticket is not resolved/closed, and task is DONE, reopen task
      if (status !== 'RESOLVED' && status !== 'CLOSED' && linkedTask && linkedTask.status === 'DONE') {
        reopenTaskMutation.mutate(linkedTask.id);
      }
    }
  });

  // Assign Ticket Mutation
  const assignTicketMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { data } = await api.patch(`/tickets/${id}/assign`, { assignedToId: userId });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket', id] });
    }
  });

  const { data: clientProjectsResponse } = useProjects(ticket?.clientId ? { clientId: ticket.clientId, limit: 100 } : undefined);
  const clientProjects = clientProjectsResponse?.projects || [];

  const { data: clientAmcsResponse } = useAmcContracts(ticket?.clientId ? { clientId: ticket.clientId, limit: 100 } : undefined);
  const clientAmcs = clientAmcsResponse?.contracts || [];

  const updateTicketMutation = useMutation({
    mutationFn: async (payload: any) => {
      const { data } = await api.patch(`/tickets/${id}`, payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket', id] });
    }
  });

  // Fetch Users for Assignment dropdown
  const { data: usersResponse } = useUsers({ limit: 100 });
  const users = usersResponse?.users || [];

  const { data: projectsResponse } = useProjects({ limit: 100 });
  const projects = projectsResponse?.projects || [];

  const createTaskMutation = useMutation({
    mutationFn: async (newTask: any) => {
      const { data } = await api.post('/tasks', newTask);
      return data;
    },
    onSuccess: () => {
      setIsEscalateOpen(false);
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      alert("Task created successfully on the Task Board!");
    }
  });
  const handleStartEscalate = () => {
    setTaskForm({
      title: `Ticket: ${ticket.title}`,
      description: `Source Ticket: ${window.location.origin}/tickets/${ticket.id}\n\n${ticket.description || ""}`,
      projectId: ticket.project?.id || projects[0]?.id || "",
      assigneeId: ticket.assignedTo?.id || "",
      priority: ticket.priority || "MEDIUM",
      dueDate: "",
    });
    setIsEscalateOpen(true);
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskForm.title || !taskForm.projectId) return;
    createTaskMutation.mutate({
      title: taskForm.title,
      description: taskForm.description,
      projectId: taskForm.projectId,
      assigneeId: taskForm.assigneeId || undefined,
      priority: taskForm.priority,
      ticketId: ticket.id,
      dueDate: taskForm.dueDate ? new Date(taskForm.dueDate) : undefined,
    });
  };

  // Post Comment Mutation
  const postCommentMutation = useMutation({
    mutationFn: async (payload: any) => {
      const { data } = await api.post(`/tickets/${id}/comments`, payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket', id] });
      setNewComment("");
    }
  });

  const handlePostComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment) return;
    postCommentMutation.mutate({
      content: newComment,
      isInternal
    });
  };

  if (isLoading) return <div className="p-8">Loading ticket details...</div>;
  if (isError || !ticket) {
    return (
      <div className="p-8 space-y-3">
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">
          Failed to load this ticket. {(error as any)?.response?.data?.message || (error as any)?.message || "Please try again."}
        </div>
        <Button onClick={() => refetchTicket()}>Retry</Button>
      </div>
    );
  }

  // Filter comments based on toggle or access (normally client only sees external, developer sees both)
  const displayComments = ticket.comments || [];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b pb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">{ticket.title}</h1>
            <Badge variant={ticket.priority === 'CRITICAL' ? 'destructive' : 'secondary'}>{ticket.priority}</Badge>
          </div>
          <p className="text-slate-500 text-sm">
            Client: <span className="font-semibold text-slate-700">{ticket.client?.name}</span>
            {ticket.projectId && (
              <> &bull; Project: <span className="font-semibold text-slate-700">{ticket.project?.name || '—'}</span></>
            )}
            {ticket.amcContractId && (
              <> &bull; AMC Contract: <span className="font-semibold text-indigo-600">{ticket.amcContract?.contractNumber || '—'}</span></>
            )}
            {!ticket.projectId && !ticket.amcContractId && (
              <> &bull; Scope: <span className="text-slate-400 italic">General Support</span></>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3 bg-white p-3 rounded-lg border shadow-sm">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-red-500" />
            <div>
              <div className="text-[10px] uppercase font-semibold text-slate-400">SLA Countdown</div>
              <div className={`text-sm font-bold ${slaTimeLeft.includes("BREACHED") ? "text-red-600 animate-pulse" : "text-slate-800"}`}>{slaTimeLeft}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        {/* Left Columns: Ticket details & Comments */}
        <div className="md:col-span-2 space-y-8">
          <Card>
            <CardHeader><CardTitle className="text-lg">Description</CardTitle></CardHeader>
            <CardContent>
              <p className="text-slate-700 text-sm whitespace-pre-line leading-relaxed">{ticket.description || "No description provided."}</p>
            </CardContent>
          </Card>

          {/* Comments section with client/internal switch */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-slate-500" /> Discussion Log
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                {displayComments.map((c: any) => (
                  <div key={c.id} className={`p-4 border rounded-lg space-y-2 ${c.isInternal ? "bg-amber-50/50 border-amber-200" : "bg-slate-50"}`}>
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-slate-900 text-xs">
                          {c.user ? `${c.user.firstName} ${c.user.lastName}` : (c.clientUser?.name || "Client")}
                        </span>
                        {c.isInternal && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0 border-amber-300 text-amber-800 bg-amber-100 flex items-center gap-1">
                            <Shield className="w-3 h-3" /> Internal Only
                          </Badge>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400">{new Date(c.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="text-slate-700 text-sm">{c.content}</p>
                  </div>
                ))}
              </div>

              <form onSubmit={handlePostComment} className="space-y-3 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <input type="checkbox" id="internal-toggle" checked={isInternal} onChange={() => setIsInternal(!isInternal)} className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer" />
                    <label htmlFor="internal-toggle" className="text-xs font-medium text-slate-600 cursor-pointer flex items-center gap-1">
                      Mark comment as <span className="font-bold text-amber-700">Internal Notes</span>
                    </label>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Input placeholder="Respond to ticket or log internal findings..." value={newComment} onChange={(e) => setNewComment(e.target.value)} />
                  <Button type="submit" size="sm" className="bg-blue-600 hover:bg-blue-700 text-white"><Send className="w-4 h-4" /></Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Controllers */}
        <div className="space-y-8">
          {/* Status dropdown */}
          <Card>
            <CardHeader><CardTitle className="text-sm font-semibold uppercase tracking-wider text-slate-400">Controls</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs text-slate-500 font-medium">Ticket Status</label>
                <Select key={ticket.status} defaultValue={ticket.status} onValueChange={(val: any) => updateStatusMutation.mutate(val ?? "OPEN")}>
                  <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="OPEN">Open</SelectItem>
                    <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                    <SelectItem value="PENDING_RESOLUTION">Pending Resolution</SelectItem>
                    <SelectItem value="RESOLVED">Resolved</SelectItem>
                    <SelectItem value="CLOSED">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1 pt-2">
                <label className="text-xs text-slate-500 font-medium">Assign To</label>
                <Select
                  key={ticket.assignedTo?.id || "unassigned"}
                  defaultValue={ticket.assignedTo?.id || "unassigned"}
                  items={[{ value: 'unassigned', label: 'Unassigned' }, ...users.map((u: any) => ({ value: u.id, label: `${u.firstName} ${u.lastName}` }))]}
                  onValueChange={(val: any) => {
                    if (val !== "unassigned") {
                      assignTicketMutation.mutate(val);
                    }
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Select Expert" /></SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {users.map((u: any) => (
                      <SelectItem key={u.id} value={u.id}>{u.firstName} {u.lastName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1 pt-2 border-t border-slate-100 mt-2">
                <label className="text-xs text-slate-500 font-medium font-semibold">Linked Project</label>
                <Select
                  key={ticket.projectId || "unlinked"}
                  defaultValue={ticket.projectId || "unlinked"}
                  items={[{ value: 'unlinked', label: 'Standard Support (Unlinked)' }, ...clientProjects.map((p: any) => ({ value: p.id, label: p.name }))]}
                  onValueChange={(val: string) => {
                    updateTicketMutation.mutate({ projectId: val === "unlinked" ? null : val });
                  }}
                >
                  <SelectTrigger className="bg-white text-xs"><SelectValue placeholder="Select Project" /></SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="unlinked">Standard Support (Unlinked)</SelectItem>
                    {clientProjects.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1 pt-2">
                <label className="text-xs text-slate-500 font-medium font-semibold">Linked AMC Contract</label>
                <Select
                  key={ticket.amcContractId || "unlinked"}
                  defaultValue={ticket.amcContractId || "unlinked"}
                  items={[{ value: 'unlinked', label: 'No Contract (Unlinked)' }, ...clientAmcs.map((a: any) => ({ value: a.id, label: `${a.contractNumber} (${a.status})` }))]}
                  onValueChange={(val: string) => {
                    updateTicketMutation.mutate({ amcContractId: val === "unlinked" ? null : val });
                  }}
                >
                  <SelectTrigger className="bg-white text-xs"><SelectValue placeholder="Select AMC Contract" /></SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="unlinked">No Contract (Unlinked)</SelectItem>
                    {clientAmcs.map((a: any) => (
                      <SelectItem key={a.id} value={a.id}>{a.contractNumber} ({a.status})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {linkedTask ? (
                <div className="pt-4 border-t border-slate-100 mt-4 space-y-2">
                  <label className="text-xs text-slate-500 font-medium">Linked Task</label>
                  <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-lg space-y-1.5">
                    <div
                      className="font-semibold text-sm text-indigo-900 truncate hover:underline cursor-pointer"
                      onClick={() => window.location.href = `/tasks/${linkedTask.id}`}
                    >
                      {linkedTask.title}
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>Status: <b className="text-indigo-700 uppercase">{linkedTask.status}</b></span>
                      <span>Priority: <b>{linkedTask.priority}</b></span>
                    </div>

                    <div className="space-y-1 pt-1.5 border-t border-indigo-100/50 mt-1">
                      <label className="text-[10px] text-slate-400 font-semibold uppercase">Task Assignee</label>
                      <Select
                        key={linkedTask.assignments?.[0]?.userId || "unassigned"}
                        defaultValue={linkedTask.assignments?.[0]?.userId || "unassigned"}
                        items={[{ value: 'unassigned', label: 'Unassigned' }, ...users.map((u: any) => ({ value: u.id, label: `${u.firstName} ${u.lastName}` }))]}
                        onValueChange={(val: any) => {
                          updateTaskAssigneeMutation.mutate({
                            taskId: linkedTask.id,
                            assigneeId: val === "unassigned" ? null : val
                          });
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs bg-white"><SelectValue placeholder="Select Assignee" /></SelectTrigger>
                        <SelectContent className="bg-white">
                          <SelectItem value="unassigned">Unassigned</SelectItem>
                          {users.map((u: any) => (
                            <SelectItem key={u.id} value={u.id}>{u.firstName} {u.lastName}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {linkedTask.status === 'DONE' && (
                      <Button
                        size="sm"
                        onClick={() => reopenTaskMutation.mutate(linkedTask.id)}
                        disabled={reopenTaskMutation.isPending}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs py-1 h-7 font-semibold mt-2"
                      >
                        {reopenTaskMutation.isPending ? "Reopening..." : "Reopen Task"}
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="pt-4 border-t border-slate-100 mt-4">
                  <Button
                    onClick={handleStartEscalate}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center gap-1.5 font-semibold"
                  >
                    <Plus className="w-4 h-4" /> Convert to Task
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Attachments */}
          <Card>
            <CardHeader><CardTitle className="text-sm font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2"><Paperclip className="w-4 h-4 text-slate-400" /> Attachments</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {ticket.attachments?.length ? (
                ticket.attachments.map((att: any) => {
                  const base = typeof window !== 'undefined' ? '/api' : (process.env.NEXT_PUBLIC_API_URL || '/api');
                  const downloadUrl = att.url.startsWith('http') ? att.url : `${base}${att.url}`;
                  return (
                    <div 
                      key={att.id} 
                      className="flex items-center justify-between p-2 border rounded hover:bg-slate-50 cursor-pointer" 
                      onClick={() => window.open(downloadUrl, '_blank')}
                    >
                      <div className="flex items-center gap-2 overflow-hidden flex-wrap">
                        <Paperclip className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="text-xs font-semibold truncate text-blue-600">{att.originalName || att.filename}</span>
                        {att.uploadedBy && (
                          <span className="text-[9px] text-slate-400 italic">
                            by {att.uploadedBy.firstName} {att.uploadedBy.lastName} (Staff)
                          </span>
                        )}
                        {att.uploadedByClientUser && (
                          <span className="text-[9px] text-slate-450 italic">
                            by {att.uploadedByClientUser.name} (Client)
                          </span>
                        )}
                        {att.taskId && (
                          <Badge variant="secondary" className="text-[8px] px-1 py-0 bg-slate-100 border text-slate-500 font-bold shrink-0">
                            Task File
                          </Badge>
                        )}
                        {att.isInternal && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 border-amber-300 text-amber-800 bg-amber-100 shrink-0 font-bold">
                            Internal
                          </Badge>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400">{(att.size / 1024).toFixed(1)} KB</span>
                    </div>
                  );
                })
              ) : (
                <p className="text-slate-500 text-xs">No attachments found.</p>
              )}

              <div className="pt-2 border-t mt-2">
                <div className="flex items-center gap-1.5 mb-2 mt-1">
                  <input
                    type="checkbox"
                    id="attachment-internal-toggle"
                    checked={isAttachmentInternal}
                    onChange={() => setIsAttachmentInternal(!isAttachmentInternal)}
                    className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <label htmlFor="attachment-internal-toggle" className="text-[11px] font-medium text-slate-600 cursor-pointer flex items-center gap-1">
                    Mark as <span className="font-bold text-amber-700">Internal (Hidden from Client)</span>
                  </label>
                </div>
                <input 
                  type="file" 
                  id="ticket-att-upload" 
                  className="hidden" 
                  onChange={async (e) => {
                    if (e.target.files && e.target.files[0]) {
                      const file = e.target.files[0];
                      try {
                        await uploadAttachment.mutateAsync({ file, ticketId: id, isInternal: isAttachmentInternal });
                        queryClient.invalidateQueries({ queryKey: ['ticket', id] });
                        alert("File uploaded successfully!");
                      } catch (err: any) {
                        alert(err?.response?.data?.message || "Failed to upload file.");
                      }
                    }
                  }}
                />
                <Button 
                  onClick={() => document.getElementById('ticket-att-upload')?.click()}
                  size="sm"
                  className="w-full bg-slate-900 text-white flex items-center justify-center gap-1 text-xs"
                  disabled={uploadAttachment.isPending}
                >
                  {uploadAttachment.isPending ? "Uploading..." : <><Plus className="w-3.5 h-3.5" /> Upload File</>}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Assigned Person */}
          <Card>
            <CardHeader><CardTitle className="text-sm font-semibold uppercase tracking-wider text-slate-400">Assigned Expert</CardTitle></CardHeader>
            <CardContent>
              {ticket.assignedTo ? (
                <div className="flex items-center gap-3 p-3 bg-slate-50 border rounded-lg">
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-xs uppercase shrink-0">
                    {ticket.assignedTo.firstName[0]}{ticket.assignedTo.lastName[0]}
                  </div>
                  <div>
                    <div className="font-semibold text-sm text-slate-900">{ticket.assignedTo.firstName} {ticket.assignedTo.lastName}</div>
                    <span className="text-xs text-slate-400">{ticket.assignedTo.email}</span>
                  </div>
                </div>
              ) : (
                <div className="p-3 border rounded-lg bg-yellow-50 text-yellow-800 text-xs flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" /> Unassigned ticket
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      <Modal isOpen={isEscalateOpen} onClose={() => setIsEscalateOpen(false)} title="Convert Ticket to Project Task" subtitle="Create a task on the task board pre-populated with ticket data.">
        <form onSubmit={handleCreateTask} className="p-6 space-y-4">
          <FormField label="Task Title" required>
            <input className={inputCls} value={taskForm.title} onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))} required />
          </FormField>
          <FormField label="Description">
            <textarea className="w-full min-h-[100px] p-2 border rounded-md text-sm" value={taskForm.description} onChange={e => setTaskForm(f => ({ ...f, description: e.target.value }))} />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Project" required>
              <select className={selectCls} value={taskForm.projectId} onChange={e => setTaskForm(f => ({ ...f, projectId: e.target.value }))} required>
                <option value="" disabled>Select Project</option>
                {projects.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Priority" required>
              <select className={selectCls} value={taskForm.priority} onChange={e => setTaskForm(f => ({ ...f, priority: e.target.value }))} required>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </FormField>
          </div>
          <FormField label="Assignee">
            <select className={selectCls} value={taskForm.assigneeId} onChange={e => setTaskForm(f => ({ ...f, assigneeId: e.target.value }))}>
              <option value="">Unassigned</option>
              {users.map((u: any) => (
                <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Due Date">
            <input type="date" className={inputCls} value={taskForm.dueDate} onChange={e => setTaskForm(f => ({ ...f, dueDate: e.target.value }))} />
          </FormField>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setIsEscalateOpen(false)} className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg">Cancel</button>
            <button type="submit" disabled={createTaskMutation.isPending} className="flex-1 flex items-center justify-center px-4 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg">
              {createTaskMutation.isPending ? "Creating..." : "Create Task"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
