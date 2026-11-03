import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Copy, Check, GitPullRequest, Code2, Bot, UserCheck } from "lucide-react";

interface ChallengeViewerProps {
  challenge: {
    title: string;
    description: string;
    starterCode: string;
    validationRules?: any;
  };
  onSubmit: (githubUrl: string, notes: string) => void;
  submissionStatus?: {
    status: string;
    aiScore?: number;
    aiFeedback?: string;
    mentorNotes?: string;
  };
}

export function ChallengeViewer({ challenge, onSubmit, submissionStatus }: ChallengeViewerProps) {
  const [githubUrl, setGithubUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(challenge.starterCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!githubUrl.includes("github.com/")) {
      alert("Please provide a valid GitHub Repository or Pull Request URL");
      return;
    }
    onSubmit(githubUrl, notes);
  };

  const isSubmitted = !!submissionStatus;

  return (
    <Card className="border border-slate-200 bg-white">
      <CardContent className="p-6 space-y-6 text-slate-800">
        {/* Challenge Header */}
        <div className="flex justify-between items-start border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-lg font-extrabold text-slate-900">{challenge.title}</h3>
            <span className="text-xs text-slate-500 font-mono block mt-1">Coding Challenge Submission</span>
          </div>
          <Badge className="bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-50 font-bold">
            Medium Difficulty
          </Badge>
        </div>

        {/* Description */}
        <div className="space-y-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Description</span>
          <pre className="whitespace-pre-wrap font-sans text-sm text-slate-600 leading-relaxed bg-slate-50 p-4 border border-slate-200 rounded-lg">
            {challenge.description}
          </pre>
        </div>

        {/* Starter Code */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Starter Code Base</span>
            <Button variant="ghost" size="icon-sm" onClick={handleCopy}>
              {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
            </Button>
          </div>
          <pre className="p-4 font-mono text-xs text-slate-800 bg-slate-950 text-slate-100 overflow-x-auto rounded-lg">
            {challenge.starterCode}
          </pre>
        </div>

        {/* Submission form or Status Tracker */}
        {!isSubmitted ? (
          <form onSubmit={handleFormSubmit} className="space-y-4 pt-4 border-t border-slate-100">
            <h4 className="font-extrabold text-sm text-slate-900">Submit Challenge Code</h4>
            <div>
              <label className="text-xs font-bold uppercase block mb-1">GitHub repository or PR URL</label>
              <Input
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
                placeholder="https://github.com/user/repo-name"
                required
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase block mb-1">Additional Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full min-h-[80px] p-2 border border-slate-200 rounded-md text-sm"
                placeholder="List package dependencies or setup modifications..."
              />
            </div>
            <Button type="submit" className="w-full bg-slate-900 text-white flex items-center justify-center gap-1.5">
              <GitPullRequest className="w-4 h-4" />
              Submit Link for Verification
            </Button>
          </form>
        ) : (
          <div className="pt-4 border-t border-slate-100 space-y-4">
            <h4 className="font-extrabold text-sm text-slate-900">Verification Steps Progress</h4>
            <div className="flex items-center gap-4 text-xs font-semibold text-slate-600 bg-slate-50 p-4 border border-slate-200 rounded-lg justify-around">
              <div className="text-center">
                <GitPullRequest className="w-5 h-5 mx-auto text-blue-600" />
                <span className="block mt-1">Submitted</span>
              </div>
              <div className="text-center">
                <Bot className="w-5 h-5 mx-auto text-cyan-600" />
                <span className="block mt-1">AI Review ({submissionStatus.aiScore || 0}%)</span>
              </div>
              <div className="text-center">
                <UserCheck className="w-5 h-5 mx-auto text-indigo-600" />
                <span className="block mt-1">Mentor Review</span>
              </div>
            </div>

            {submissionStatus.aiFeedback && (
              <div className="bg-slate-50 p-4 border border-slate-200 rounded-lg text-xs font-mono">
                <span className="font-sans font-bold text-slate-700 block mb-1">AI Automated Code Review Feedback</span>
                <p className="leading-relaxed whitespace-pre-wrap">{submissionStatus.aiFeedback}</p>
              </div>
            )}

            {submissionStatus.mentorNotes && (
              <div className="bg-indigo-50/50 p-4 border border-indigo-100 rounded-lg text-xs leading-relaxed text-slate-700">
                <span className="font-bold text-indigo-900 block mb-1">Mentor Reviewer Summary</span>
                <p>{submissionStatus.mentorNotes}</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
