"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/src/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, Edit, Trash2, Plus, RefreshCw, Sparkles } from "lucide-react";

interface AIPrompt {
  id: string;
  name: string;
  agentType: string;
  promptTemplate: string;
  modelConfig: any;
  outputSchema?: any;
  version: number;
  isActive: boolean;
  createdAt: string;
}

export default function AiPromptsPage() {
  const queryClient = useQueryClient();
  const [editingPrompt, setEditingPrompt] = useState<AIPrompt | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Edit Form states
  const [promptTemplate, setPromptTemplate] = useState("");
  const [modelConfigStr, setModelConfigStr] = useState("");
  const [outputSchemaStr, setOutputSchemaStr] = useState("");
  const [isActive, setIsActive] = useState(true);

  // Create Form states
  const [newName, setNewName] = useState("");
  const [newAgentType, setNewAgentType] = useState("planner");
  const [newPromptTemplate, setNewPromptTemplate] = useState("");
  const [newModelConfigStr, setNewModelConfigStr] = useState(
    JSON.stringify({ model: "gemini-2.5-flash", temperature: 0.3, maxTokens: 4000 }, null, 2)
  );
  const [newOutputSchemaStr, setNewOutputSchemaStr] = useState(
    JSON.stringify({ type: "object", properties: {} }, null, 2)
  );

  // Fetch prompts
  const { data: prompts, isLoading } = useQuery<AIPrompt[]>({
    queryKey: ["admin-ai-prompts"],
    queryFn: async () => {
      const { data } = await api.get("/admin/ai-prompts");
      return data.data || [];
    },
  });

  // Create prompt mutation
  const createMutation = useMutation({
    mutationFn: async (newPrompt: any) => {
      await api.post("/admin/ai-prompts", newPrompt);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-ai-prompts"] });
      setIsCreateOpen(false);
      resetCreateForm();
    },
  });

  // Update prompt mutation
  const updateMutation = useMutation({
    mutationFn: async (updated: Partial<AIPrompt> & { id: string }) => {
      await api.put(`/admin/ai-prompts/${updated.id}`, updated);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-ai-prompts"] });
      setEditingPrompt(null);
    },
  });

  // Delete prompt mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/admin/ai-prompts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-ai-prompts"] });
    },
  });

  // Version increment mutation
  const versionMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/admin/ai-prompts/${id}/version`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-ai-prompts"] });
      setEditingPrompt(null);
    },
  });

  const resetCreateForm = () => {
    setNewName("");
    setNewAgentType("planner");
    setNewPromptTemplate("");
    setNewModelConfigStr(
      JSON.stringify({ model: "gemini-2.5-flash", temperature: 0.3, maxTokens: 4000 }, null, 2)
    );
    setNewOutputSchemaStr(
      JSON.stringify({ type: "object", properties: {} }, null, 2)
    );
  };

  const handleEdit = (prompt: AIPrompt) => {
    setEditingPrompt(prompt);
    setPromptTemplate(prompt.promptTemplate);
    setModelConfigStr(JSON.stringify(prompt.modelConfig, null, 2));
    setOutputSchemaStr(prompt.outputSchema ? JSON.stringify(prompt.outputSchema, null, 2) : "{}");
    setIsActive(prompt.isActive);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    let modelConfig = {};
    let outputSchema = {};

    try {
      modelConfig = JSON.parse(newModelConfigStr);
    } catch (err) {
      alert("Invalid JSON format in Model Config");
      return;
    }

    try {
      if (newOutputSchemaStr.trim()) {
        outputSchema = JSON.parse(newOutputSchemaStr);
      }
    } catch (err) {
      alert("Invalid JSON format in Output Schema");
      return;
    }

    createMutation.mutate({
      name: newName,
      agentType: newAgentType,
      promptTemplate: newPromptTemplate,
      modelConfig,
      outputSchema,
      isActive: true,
    });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPrompt) return;

    let modelConfig = {};
    let outputSchema = {};

    try {
      modelConfig = JSON.parse(modelConfigStr);
    } catch (err) {
      alert("Invalid JSON format in Model Config");
      return;
    }

    try {
      if (outputSchemaStr.trim()) {
        outputSchema = JSON.parse(outputSchemaStr);
      }
    } catch (err) {
      alert("Invalid JSON format in Output Schema");
      return;
    }

    updateMutation.mutate({
      id: editingPrompt.id,
      promptTemplate,
      modelConfig,
      outputSchema,
      isActive,
    });
  };

  const handleSeedDefaults = async () => {
    const defaults = [
      {
        name: 'roadmap_planner',
        agentType: 'planner',
        promptTemplate: 'You are a master learning planner. Create a learning roadmap for {{technology}} at {{difficulty}} level for {{duration}} weeks. Return a JSON object matching the schema.',
        modelConfig: { model: 'gemini-2.5-flash', temperature: 0.2, maxTokens: 4000 },
        outputSchema: { type: 'object', properties: { levels: { type: 'array' } } },
      },
      {
        name: 'content_generator',
        agentType: 'content',
        promptTemplate: 'You are a technical writer. Write node notes, learning objectives, code examples for {{topic}} using {{technology}}.',
        modelConfig: { model: 'gemini-2.5-flash', temperature: 0.3, maxTokens: 4000 },
        outputSchema: { type: 'object', properties: { notes: { type: 'string' } } },
      },
      {
        name: 'quiz_generator',
        agentType: 'quiz',
        promptTemplate: 'Generate 10 multiple-choice questions for {{topic}} in {{technology}}.',
        modelConfig: { model: 'gemini-2.5-flash', temperature: 0.3, maxTokens: 2000 },
        outputSchema: { type: 'object', properties: { questions: { type: 'array' } } },
      },
      {
        name: 'challenge_generator',
        agentType: 'challenge',
        promptTemplate: 'Create a coding challenge for {{topic}} in {{technology}}.',
        modelConfig: { model: 'gemini-2.5-flash', temperature: 0.3, maxTokens: 2000 },
        outputSchema: { type: 'object', properties: { challenge: { type: 'object' } } },
      },
      {
        name: 'code_reviewer',
        agentType: 'validation',
        promptTemplate: 'Perform an AI review on the code submission for {{topic}}.',
        modelConfig: { model: 'gemini-2.5-flash', temperature: 0.1, maxTokens: 2000 },
        outputSchema: { type: 'object', properties: { score: { type: 'integer' } } },
      },
      {
        name: 'github_readme_generator',
        agentType: 'github',
        promptTemplate: 'Generate a detailed README.md file for the git repository setup.',
        modelConfig: { model: 'gemini-2.5-flash', temperature: 0.4, maxTokens: 2000 },
        outputSchema: { type: 'object', properties: { readme: { type: 'string' } } },
      },
    ];

    if (confirm("Seed default AI prompts into the database?")) {
      try {
        for (const item of defaults) {
          await api.post("/admin/ai-prompts", item);
        }
        queryClient.invalidateQueries({ queryKey: ["admin-ai-prompts"] });
        alert("AI prompts seeded successfully!");
      } catch (err) {
        alert("Failed to seed default prompts. Check server logs.");
      }
    }
  };

  const getAgentBadgeColor = (agentType: string) => {
    const colors: Record<string, string> = {
      planner: "bg-blue-50 text-blue-700 border-blue-200",
      content: "bg-purple-50 text-purple-700 border-purple-200",
      quiz: "bg-indigo-50 text-indigo-700 border-indigo-200",
      challenge: "bg-rose-50 text-rose-700 border-rose-200",
      interview: "bg-amber-50 text-amber-700 border-amber-200",
      validation: "bg-emerald-50 text-emerald-700 border-emerald-200",
      github: "bg-slate-50 text-slate-700 border-slate-200",
    };
    return colors[agentType] || "bg-slate-50 text-slate-700 border-slate-200";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6 text-slate-800">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">AI Agent Prompt Center</h2>
          <p className="text-sm text-slate-500">Manage LLM system prompt instructions and temperature configurations.</p>
        </div>
        <div className="flex gap-2">
          {(!prompts || prompts.length === 0) && (
            <Button onClick={handleSeedDefaults} variant="outline" className="flex items-center gap-1.5 border-indigo-200 hover:bg-indigo-50 text-indigo-700">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              Seed Defaults
            </Button>
          )}
          <Button onClick={() => setIsCreateOpen(true)} className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-sm flex items-center gap-1.5">
            <Plus className="w-4 h-4" />
            Create Prompt
          </Button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead className="font-semibold">Prompt Name</TableHead>
              <TableHead className="font-semibold">Agent Type</TableHead>
              <TableHead className="font-semibold">Version</TableHead>
              <TableHead className="font-semibold">Status</TableHead>
              <TableHead className="font-semibold">Created At</TableHead>
              <TableHead className="text-right font-semibold">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(!prompts || prompts.length === 0) ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-slate-400">
                  No AI prompts found. Click "Seed Defaults" or "Create Prompt" to get started.
                </TableCell>
              </TableRow>
            ) : (
              prompts.map((prompt) => (
                <TableRow key={prompt.id} className="hover:bg-slate-50/50 transition-colors">
                  <TableCell className="font-semibold text-slate-900">{prompt.name}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 text-xs font-bold rounded-md border ${getAgentBadgeColor(prompt.agentType)}`}>
                      {prompt.agentType}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-sm">v{prompt.version}</TableCell>
                  <TableCell>
                    <Badge variant={prompt.isActive ? "default" : "secondary"}>
                      {prompt.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-slate-500 text-xs">{new Date(prompt.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button variant="outline" size="sm" onClick={() => handleEdit(prompt)}>
                      <Edit className="w-3.5 h-3.5 mr-1" /> Configure
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => { if (confirm("Delete this prompt?")) deleteMutation.mutate(prompt.id); }} className="text-rose-600 border-rose-100 hover:bg-rose-50 hover:text-rose-700">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create Prompt Dialog */}
      {isCreateOpen && (
        <Dialog open={true} onOpenChange={(open) => { if (!open) setIsCreateOpen(false); }}>
          <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New AI Agent Prompt</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateSubmit} className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase block mb-1">Prompt Name</label>
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. roadmap_planner"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase block mb-1">Agent Type</label>
                  <select
                    value={newAgentType}
                    onChange={(e) => setNewAgentType(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded-md text-sm bg-white"
                  >
                    <option value="planner">planner</option>
                    <option value="content">content</option>
                    <option value="quiz">quiz</option>
                    <option value="challenge">challenge</option>
                    <option value="interview">interview</option>
                    <option value="validation">validation</option>
                    <option value="github">github</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase block mb-1">System Prompt Template</label>
                <textarea
                  value={newPromptTemplate}
                  onChange={(e) => setNewPromptTemplate(e.target.value)}
                  className="w-full min-h-[140px] p-2 border border-slate-200 rounded-md font-mono text-xs bg-slate-900 text-slate-100"
                  placeholder="You are an AI assistant..."
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase block mb-1">Model Configuration (JSON)</label>
                <textarea
                  value={newModelConfigStr}
                  onChange={(e) => setNewModelConfigStr(e.target.value)}
                  className="w-full min-h-[100px] p-2 border border-slate-200 rounded-md font-mono text-xs bg-slate-50"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase block mb-1">Output Schema Structure (JSON)</label>
                <textarea
                  value={newOutputSchemaStr}
                  onChange={(e) => setNewOutputSchemaStr(e.target.value)}
                  className="w-full min-h-[100px] p-2 border border-slate-200 rounded-md font-mono text-xs bg-slate-50"
                />
              </div>

              <div className="flex gap-2 justify-end mt-4">
                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                <Button type="submit" className="bg-indigo-600 text-white hover:bg-indigo-700">Create Prompt</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Edit Prompt Config dialog */}
      {editingPrompt && (
        <Dialog open={true} onOpenChange={(open) => { if (!open) setEditingPrompt(null); }}>
          <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Configure AI Agent Prompt</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSave} className="space-y-4 pt-4">
              <div>
                <label className="text-xs font-bold uppercase block mb-1">System Prompt Template</label>
                <textarea
                  value={promptTemplate}
                  onChange={(e) => setPromptTemplate(e.target.value)}
                  className="w-full min-h-[160px] p-2 border border-slate-200 rounded-md font-mono text-xs bg-slate-900 text-slate-100"
                  placeholder="You are an AI assistant..."
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase block mb-1">Model Configuration (JSON)</label>
                <textarea
                  value={modelConfigStr}
                  onChange={(e) => setModelConfigStr(e.target.value)}
                  className="w-full min-h-[100px] p-2 border border-slate-200 rounded-md font-mono text-xs bg-slate-50"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase block mb-1">Output Schema Structure (JSON)</label>
                <textarea
                  value={outputSchemaStr}
                  onChange={(e) => setOutputSchemaStr(e.target.value)}
                  className="w-full min-h-[100px] p-2 border border-slate-200 rounded-md font-mono text-xs bg-slate-50"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    id="isActivePromptEdit"
                  />
                  <label htmlFor="isActivePromptEdit" className="text-sm font-semibold cursor-pointer">Active</label>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => { if (confirm("Increment prompt version?")) versionMutation.mutate(editingPrompt.id); }}
                  className="flex items-center gap-1 text-xs"
                >
                  <RefreshCw className="w-3 h-3" />
                  Increment to v{editingPrompt.version + 1}
                </Button>
              </div>

              <div className="flex gap-2 justify-end mt-4">
                <Button type="button" variant="outline" onClick={() => setEditingPrompt(null)}>Cancel</Button>
                <Button type="submit" className="bg-indigo-600 text-white hover:bg-indigo-700">Save Changes</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
