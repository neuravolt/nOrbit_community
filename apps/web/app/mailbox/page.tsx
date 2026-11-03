"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/src/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Mail,
  Send,
  Inbox,
  Clock,
  Search,
  RefreshCw,
  Reply,
  Copy,
  Check,
  Paperclip,
  CheckCircle2,
  AlertCircle,
  FileText,
  X,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";

interface MailboxMessage {
  id: string;
  folder: string;
  from: string;
  fromName?: string;
  to: string;
  subject: string;
  date: string;
  isRead: boolean;
  hasAttachments?: boolean;
  messageId?: string;
  sizeBytes?: number;
}

interface SentEmailRecord {
  id: string;
  templateName: string;
  recipientEmail: string;
  subject: string;
  smtpMessageId: string;
  entityType?: string | null;
  entityId?: string | null;
  createdAt: string;
}

export default function MailboxPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"inbox" | "sent">("inbox");
  const [inboxFolder, setInboxFolder] = useState<"inbox" | "sent" | "trash" | "junk">("inbox");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Compose / Reply Modal State
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [composeInReplyTo, setComposeInReplyTo] = useState<string | undefined>(undefined);
  const [composeReferences, setComposeReferences] = useState<string | undefined>(undefined);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // 1. Fetch Incoming Mailbox Messages
  const {
    data: inboxData,
    isLoading: isInboxLoading,
    refetch: refetchInbox,
  } = useQuery({
    queryKey: ["mailbox-inbox", inboxFolder, searchTerm],
    queryFn: async () => {
      const res = await api.get("/mailbox/inbox", {
        params: { folder: inboxFolder, search: searchTerm },
      });
      return res.data;
    },
    enabled: activeTab === "inbox",
  });

  // 2. Fetch Selected Message Full Details
  const {
    data: messageDetail,
    isLoading: isMessageLoading,
  } = useQuery({
    queryKey: ["mailbox-message", selectedMessageId],
    queryFn: async () => {
      if (!selectedMessageId) return null;
      const res = await api.get(`/mailbox/message/${selectedMessageId}`);
      return res.data;
    },
    enabled: !!selectedMessageId,
  });

  // 3. Fetch Sent Email History (Dispatched Invoices, Quotes, Alerts, Custom)
  const {
    data: sentData,
    isLoading: isSentLoading,
    refetch: refetchSent,
  } = useQuery({
    queryKey: ["mailbox-sent", searchTerm],
    queryFn: async () => {
      const res = await api.get("/mailbox/sent", {
        params: { search: searchTerm },
      });
      return res.data;
    },
    enabled: activeTab === "sent",
  });

  // 4. Send / Reply Mutation
  const sendEmailMutation = useMutation({
    mutationFn: async (payload: {
      to: string;
      subject: string;
      body: string;
      inReplyTo?: string;
      references?: string;
    }) => {
      const res = await api.post("/mailbox/send", payload);
      return res.data;
    },
    onSuccess: (data) => {
      setIsComposeOpen(false);
      setComposeTo("");
      setComposeSubject("");
      setComposeBody("");
      setComposeInReplyTo(undefined);
      setComposeReferences(undefined);
      setStatusMessage(`Email successfully sent! Message ID: ${data.messageId}`);
      setTimeout(() => setStatusMessage(null), 6000);
      queryClient.invalidateQueries({ queryKey: ["mailbox-sent"] });
      queryClient.invalidateQueries({ queryKey: ["mailbox-inbox"] });
    },
    onError: (err: any) => {
      alert(err?.response?.data?.message || err?.message || "Failed to send email");
    },
  });

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleOpenReply = (detail: any) => {
    setComposeTo(detail.fromAddress || detail.from);
    setComposeSubject(
      detail.subject.startsWith("Re:") ? detail.subject : `Re: ${detail.subject}`
    );
    setComposeInReplyTo(detail.messageId);
    setComposeReferences(detail.messageId);

    const quoteHeader = `\n\n--- On ${new Date(detail.date).toLocaleString()} ${detail.from} wrote ---\n`;
    const quoteBody = (detail.text || "").split("\n").map((line: string) => `> ${line}`).join("\n");
    setComposeBody(`${quoteHeader}${quoteBody}`);

    setIsComposeOpen(true);
  };

  const handleOpenNewCompose = () => {
    setComposeTo("");
    setComposeSubject("");
    setComposeBody("");
    setComposeInReplyTo(undefined);
    setComposeReferences(undefined);
    setIsComposeOpen(true);
  };

  const handleSendSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!composeTo.trim() || !composeSubject.trim() || !composeBody.trim()) {
      alert("Please fill in recipient, subject, and body.");
      return;
    }
    sendEmailMutation.mutate({
      to: composeTo.trim(),
      subject: composeSubject.trim(),
      body: composeBody,
      inReplyTo: composeInReplyTo,
      references: composeReferences,
    });
  };

  const messages: MailboxMessage[] = inboxData?.messages || [];
  const sentEmails: SentEmailRecord[] = sentData?.emails || [];

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600">
              <Mail className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                  Communications & Mailbox
                </h1>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  business@neuravolt.in
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Centralized mail hub — read client replies, inspect delivery proofs, and send custom emails.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (activeTab === "inbox") refetchInbox();
              else refetchSent();
            }}
            className="text-slate-600 hover:text-slate-900"
          >
            <RefreshCw
              className={`w-4 h-4 mr-1.5 ${
                isInboxLoading || isSentLoading ? "animate-spin text-indigo-600" : ""
              }`}
            />
            Refresh
          </Button>

          <Button
            onClick={handleOpenNewCompose}
            className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
            size="sm"
          >
            <Send className="w-4 h-4 mr-1.5" />
            Compose Email
          </Button>
        </div>
      </div>

      {/* Success Status Banner */}
      {statusMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg p-3.5 flex items-center justify-between text-sm shadow-sm animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="font-medium">{statusMessage}</span>
          </div>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-emerald-700 hover:text-emerald-900 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Tabs Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex p-1 bg-slate-100 rounded-xl max-w-fit border border-slate-200">
          <button
            type="button"
            onClick={() => {
              setActiveTab("inbox");
              setSelectedMessageId(null);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "inbox"
                ? "bg-white text-indigo-700 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Inbox className="w-4 h-4" />
            Inbox & Client Inquiries
            {inboxData?.total !== undefined && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-700 font-bold">
                {inboxData.total}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("sent");
              setSelectedMessageId(null);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "sent"
                ? "bg-white text-indigo-700 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Clock className="w-4 h-4" />
            Outbox & Dispatch History
            {sentData?.total !== undefined && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-700 font-bold">
                {sentData.total}
              </span>
            )}
          </button>
        </div>

        {/* Search bar */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={
              activeTab === "inbox"
                ? "Search from, subject..."
                : "Search recipient, subject, ID..."
            }
            className="pl-9 text-xs h-9 bg-white"
          />
        </div>
      </div>

      {/* ─── TAB 1: INBOX ────────────────────────────────────────── */}
      {activeTab === "inbox" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Messages List Column */}
          <div className={`${selectedMessageId ? "lg:col-span-5" : "lg:col-span-12"}`}>
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="py-3 px-4 border-b flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Folder:
                  </span>
                  <div className="flex gap-1">
                    {(["inbox", "sent", "trash", "junk"] as const).map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => {
                          setInboxFolder(f);
                          setSelectedMessageId(null);
                        }}
                        className={`text-[11px] px-2.5 py-1 rounded-md capitalize font-medium transition-colors ${
                          inboxFolder === f
                            ? "bg-indigo-50 text-indigo-700 font-bold"
                            : "text-slate-500 hover:bg-slate-100"
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>
                <span className="text-[11px] text-slate-400">
                  {messages.length} message{messages.length !== 1 ? "s" : ""}
                </span>
              </CardHeader>
              <CardContent className="p-0 divide-y divide-slate-100 max-h-[640px] overflow-y-auto">
                {isInboxLoading ? (
                  <div className="p-8 text-center text-xs text-slate-500">
                    <RefreshCw className="w-5 h-5 mx-auto mb-2 animate-spin text-indigo-500" />
                    Fetching incoming mail from server...
                  </div>
                ) : messages.length === 0 ? (
                  <div className="p-12 text-center">
                    <Inbox className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                    <p className="text-sm font-medium text-slate-700">No emails in {inboxFolder}</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Incoming emails sent to business@neuravolt.in will automatically arrive here.
                    </p>
                  </div>
                ) : (
                  messages.map((item) => {
                    const isSelected = selectedMessageId === item.id;
                    return (
                      <div
                        key={item.id}
                        onClick={() => setSelectedMessageId(item.id)}
                        className={`p-3.5 cursor-pointer transition-colors text-left flex items-start gap-3 ${
                          isSelected
                            ? "bg-indigo-50/70 border-l-4 border-indigo-600"
                            : "hover:bg-slate-50"
                        }`}
                      >
                        <div className="pt-1">
                          {!item.isRead ? (
                            <span
                              className="w-2 h-2 rounded-full bg-blue-600 block"
                              title="Unread"
                            />
                          ) : (
                            <span className="w-2 h-2 rounded-full bg-transparent block" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`text-xs truncate ${
                                !item.isRead
                                  ? "font-bold text-slate-900"
                                  : "font-medium text-slate-700"
                              }`}
                            >
                              {item.fromName || item.from}
                            </span>
                            <span className="text-[10px] text-slate-400 whitespace-nowrap shrink-0">
                              {new Date(item.date).toLocaleDateString("en-IN", {
                                day: "2-digit",
                                month: "short",
                              })}
                            </span>
                          </div>

                          <p
                            className={`text-xs truncate mt-0.5 ${
                              !item.isRead
                                ? "font-semibold text-slate-900"
                                : "text-slate-600"
                            }`}
                          >
                            {item.subject || "(No Subject)"}
                          </p>

                          <div className="flex items-center gap-2 mt-1">
                            {item.hasAttachments && (
                              <Paperclip className="w-3 h-3 text-slate-400 shrink-0" />
                            )}
                            <span className="text-[10px] text-slate-400 truncate">
                              To: {item.to}
                            </span>
                          </div>
                        </div>

                        <ChevronRight className="w-4 h-4 text-slate-300 self-center shrink-0" />
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </div>

          {/* Reading Pane Column */}
          {selectedMessageId && (
            <div className="lg:col-span-7">
              <Card className="border-slate-200 shadow-sm sticky top-6">
                {isMessageLoading ? (
                  <div className="p-12 text-center text-xs text-slate-500">
                    <RefreshCw className="w-5 h-5 mx-auto mb-2 animate-spin text-indigo-500" />
                    Loading message content...
                  </div>
                ) : messageDetail ? (
                  <>
                    <CardHeader className="border-b py-4 px-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <h2 className="text-base font-bold text-slate-900">
                            {messageDetail.subject}
                          </h2>
                          <div className="mt-2 text-xs space-y-1">
                            <div>
                              <span className="text-slate-400 font-medium">From: </span>
                              <strong className="text-slate-800">
                                {messageDetail.from}
                              </strong>
                            </div>
                            <div>
                              <span className="text-slate-400 font-medium">To: </span>
                              <span className="text-slate-700">{messageDetail.to}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 font-medium">Date: </span>
                              <span className="text-slate-600">
                                {new Date(messageDetail.date).toLocaleString("en-IN", {
                                  dateStyle: "full",
                                  timeStyle: "medium",
                                })}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <Button
                            size="sm"
                            onClick={() => handleOpenReply(messageDetail)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs"
                          >
                            <Reply className="w-3.5 h-3.5 mr-1" /> Reply
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSelectedMessageId(null)}
                            className="text-slate-400 hover:text-slate-700"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="p-6 space-y-4 max-h-[520px] overflow-y-auto">
                      {/* Attachments Section if any */}
                      {messageDetail.attachments?.length > 0 && (
                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                          <span className="text-xs font-semibold text-slate-700 block mb-2">
                            Attachments ({messageDetail.attachments.length})
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {messageDetail.attachments.map((att: any, i: number) => (
                              <div
                                key={i}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-md text-xs text-slate-700 shadow-2xs"
                              >
                                <Paperclip className="w-3.5 h-3.5 text-slate-400" />
                                <span className="font-medium truncate max-w-[180px]">
                                  {att.filename || `attachment-${i + 1}`}
                                </span>
                                {att.size && (
                                  <span className="text-[10px] text-slate-400">
                                    ({Math.round(att.size / 1024)} KB)
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Message Body Content */}
                      <div className="text-sm text-slate-800 leading-relaxed overflow-x-auto">
                        {messageDetail.html ? (
                          <div
                            className="prose prose-sm max-w-none"
                            dangerouslySetInnerHTML={{ __html: messageDetail.html }}
                          />
                        ) : (
                          <pre className="whitespace-pre-wrap font-sans text-xs text-slate-700">
                            {messageDetail.text}
                          </pre>
                        )}
                      </div>
                    </CardContent>
                  </>
                ) : (
                  <div className="p-12 text-center text-xs text-red-500">
                    Failed to load message.
                  </div>
                )}
              </Card>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 2: SENT & DISPATCH LOGS ──────────────────────────── */}
      {activeTab === "sent" && (
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="py-4 px-6 border-b flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-600" />
                Universal Email Transmission Logs & Delivery Proofs
              </CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">
                Full cryptographic history of all invoices, quotations, alert emails, and custom messages dispatched by NeuraVolt OS
              </p>
            </div>
            <span className="text-xs text-slate-400">
              Total Records: <strong className="text-slate-700">{sentEmails.length}</strong>
            </span>
          </CardHeader>
          <CardContent className="p-0">
            {isSentLoading ? (
              <div className="p-12 text-center text-xs text-slate-500">
                <RefreshCw className="w-5 h-5 mx-auto mb-2 animate-spin text-indigo-500" />
                Loading transmission history...
              </div>
            ) : sentEmails.length === 0 ? (
              <div className="p-12 text-center">
                <Clock className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-700">No sent emails recorded yet</p>
                <p className="text-xs text-slate-400 mt-1">
                  Invoices, quotes, alerts, or custom messages sent from the platform will be logged here.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="text-xs">Type</TableHead>
                      <TableHead className="text-xs">Recipient Email</TableHead>
                      <TableHead className="text-xs">Subject</TableHead>
                      <TableHead className="text-xs">SMTP Message ID (Proof of Delivery)</TableHead>
                      <TableHead className="text-xs">Date Dispatched</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sentEmails.map((item) => (
                      <TableRow key={item.id} className="hover:bg-slate-50/70">
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-semibold uppercase tracking-wider ${
                              item.templateName?.includes("invoice")
                                ? "bg-blue-50 text-blue-700 border-blue-200"
                                : item.templateName?.includes("quote")
                                ? "bg-amber-50 text-amber-700 border-amber-200"
                                : item.templateName?.includes("alert")
                                ? "bg-rose-50 text-rose-700 border-rose-200"
                                : "bg-indigo-50 text-indigo-700 border-indigo-200"
                            }`}
                          >
                            {item.templateName?.replace(/_/g, " ") || item.entityType || "EMAIL"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs font-semibold text-slate-800">
                          {item.recipientEmail}
                        </TableCell>
                        <TableCell className="text-xs text-slate-700 font-medium max-w-[280px] truncate" title={item.subject}>
                          {item.subject}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <code
                              className="font-mono text-[11px] text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 max-w-[220px] truncate"
                              title={item.smtpMessageId}
                            >
                              {item.smtpMessageId}
                            </code>
                            <button
                              type="button"
                              onClick={() => handleCopy(item.smtpMessageId, item.id)}
                              className="text-slate-400 hover:text-slate-700 p-1 rounded hover:bg-slate-100"
                              title="Copy Message ID"
                            >
                              {copiedId === item.id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-slate-500 whitespace-nowrap">
                          {new Date(item.createdAt).toLocaleString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: true,
                          })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ─── COMPOSE / REPLY MODAL ─────────────────────────────────── */}
      {isComposeOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b bg-slate-50/80">
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  {composeInReplyTo ? "Reply to Email" : "Compose New Email"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsComposeOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSendSubmit} className="p-6 space-y-4">
              <div className="text-[11px] text-slate-500 bg-indigo-50/50 p-2.5 rounded-lg border border-indigo-100">
                Sending from: <strong>business@neuravolt.in</strong> (via NeuraVolt Mail Server)
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Recipient Email (To) *</label>
                <Input
                  required
                  type="email"
                  value={composeTo}
                  onChange={(e) => setComposeTo(e.target.value)}
                  placeholder="e.g. client@example.com"
                  className="text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Subject *</label>
                <Input
                  required
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                  placeholder="Subject line..."
                  className="text-xs font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Message Body *</label>
                <textarea
                  required
                  rows={9}
                  value={composeBody}
                  onChange={(e) => setComposeBody(e.target.value)}
                  placeholder="Type your message here..."
                  className="w-full rounded-md border border-slate-200 p-3 text-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-sans leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsComposeOpen(false)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={sendEmailMutation.isPending}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-4"
                >
                  <Send className="w-3.5 h-3.5 mr-1.5" />
                  {sendEmailMutation.isPending ? "Sending Email..." : "Send Message"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
