"use client";

import { useState } from "react";
import {
  useMeetings,
  useCreate,
  useUpdate,
  useDelete,
  useCancelMeeting,
} from "@/src/hooks/queries";
import {
  Search,
  Plus,
  Video,
  Copy,
  Share2,
  Edit2,
  Trash2,
  XCircle,
  ExternalLink,
  Loader2,
  CheckCircle2,
  Calendar,
  Clock,
  Lock,
  Eye,
  Sparkles,
  Globe,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import {
  Modal,
  FormField,
  inputCls,
  selectCls,
} from "../components/Modal";
import Link from "next/link";
import { PageShell, PageHeader, Button, SearchInput, selectClass } from "../../src/components/ui/page";
import { KpiCard } from "../../src/components/ui/charts";

interface MeetingItem {
  id: string;
  title: string;
  meetingDate: string;
  meetingUrl: string;
  slug: string;
  status: "ACTIVE" | "EXPIRED" | "CANCELLED";
  computedStatus?: "ACTIVE" | "EXPIRED" | "CANCELLED";
  pin?: string;
  createdAt: string;
  createdBy?: {
    firstName?: string;
    lastName?: string;
    email?: string;
  };
}

export default function MeetingsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [createOpen, setCreateOpen] = useState(false);
  const [editMeeting, setEditMeeting] = useState<MeetingItem | null>(null);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [formErr, setFormErr] = useState("");
  const [meetingProvider, setMeetingProvider] = useState<"NEURAVOLT" | "EXTERNAL">("NEURAVOLT");

  const generateAutoRoom = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://teams.neuravolt.in';
    const randomCode = Math.random().toString(36).substring(2, 8);
    const timeCode = Date.now().toString(36).slice(-4);
    return `${origin}/meet/room/nv-${randomCode}-${timeCode}`;
  };

  const generateRandomPin = () => {
    return Math.floor(1000 + Math.random() * 9000).toString();
  };

  // Form state for Create / Edit
  const [form, setForm] = useState({
    title: "",
    date: "",
    time: "",
    meetingUrl: "",
    pin: "",
  });

  const { data, isLoading } = useMeetings({
    search: search || undefined,
    status: statusFilter !== "ALL" ? statusFilter : undefined,
  });

  const createMutation = useCreate("meetings", "meetings");
  const updateMutation = useUpdate("meetings", "meetings");
  const deleteMutation = useDelete("meetings", "meetings");
  const cancelMutation = useCancelMeeting();

  const meetings: MeetingItem[] = data?.meetings || [];

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const getPublicUrl = (slug: string) => {
    const origin =
      typeof window !== "undefined"
        ? window.location.origin
        : "https://teams.neuravolt.in";
    return `${origin}/meet/${slug}`;
  };

  const handleCopyLink = (slug: string, pin?: string, title?: string) => {
    const url = getPublicUrl(slug);
    const pinPart = pin ? `\n🔑 4-Digit PIN: ${pin}` : "";
    const invitationText = title
      ? `Meeting: ${title}\nJoin: ${url}${pinPart}`
      : `${url}${pinPart}`;
    navigator.clipboard.writeText(invitationText);
    showToast("Meeting link & PIN copied.");
  };

  const handleWhatsAppShare = (m: MeetingItem) => {
    const publicUrl = getPublicUrl(m.slug);
    const dateObj = new Date(m.meetingDate);
    const formattedDate = dateObj.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const formattedTime = dateObj.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const pinText = m.pin
      ? `🔑 *Meeting PIN:* ${m.pin}`
      : `🔒 *(4-Digit PIN required to join)*`;

    const shareText = `*${m.title}* - NeuraConnect Invitation\n\n📅 Date: ${formattedDate}\n⏰ Time: ${formattedTime}\n\n🔗 *Join Link:* ${publicUrl}\n${pinText}\n\n(Enter this 4-digit PIN on the link above to join)`;
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(
      shareText
    )}`;
    window.open(waUrl, "_blank");
  };

  const openCreateModal = () => {
    setMeetingProvider("NEURAVOLT");
    setForm({
      title: "",
      date: new Date().toISOString().split("T")[0],
      time: "14:00",
      meetingUrl: generateAutoRoom(),
      pin: generateRandomPin(),
    });
    setFormErr("");
    setCreateOpen(true);
  };

  const openEditModal = (m: MeetingItem) => {
    const d = new Date(m.meetingDate);
    const dateStr = d.toISOString().split("T")[0];
    const timeStr = d.toTimeString().slice(0, 5);
    const isBuiltIn = m.meetingUrl?.includes("meet.jit.si") || !m.meetingUrl?.includes("meet.google.com");

    setMeetingProvider(isBuiltIn ? "NEURAVOLT" : "EXTERNAL");
    setEditMeeting(m);
    setForm({
      title: m.title,
      date: dateStr,
      time: timeStr,
      meetingUrl: m.meetingUrl,
      pin: "", // Optional on edit
    });
    setFormErr("");
  };

function parseMeetingDateTime(dateStr: string, timeStr: string): string {
  try {
    let y = 0, m = 0, d = 0;
    if (dateStr.includes("-")) {
      const parts = dateStr.split("-");
      y = parseInt(parts[0], 10);
      m = parseInt(parts[1], 10) - 1;
      d = parseInt(parts[2], 10);
    } else if (dateStr.includes("/")) {
      const parts = dateStr.split("/");
      if (parts[0].length === 4) {
        y = parseInt(parts[0], 10);
        m = parseInt(parts[1], 10) - 1;
        d = parseInt(parts[2], 10);
      } else {
        d = parseInt(parts[0], 10);
        m = parseInt(parts[1], 10) - 1;
        y = parseInt(parts[2], 10);
      }
    }

    let hh = 0, mm = 0;
    const isPm = /pm/i.test(timeStr);
    const isAm = /am/i.test(timeStr);
    const cleanTime = timeStr.replace(/(am|pm)/i, "").trim();
    const timeParts = cleanTime.split(":");
    hh = parseInt(timeParts[0] || "0", 10);
    mm = parseInt(timeParts[1] || "0", 10);

    if (isPm && hh < 12) hh += 12;
    if (isAm && hh === 12) hh = 0;

    const dt = new Date(y, m, d, hh, mm, 0);
    if (isNaN(dt.getTime())) {
      const fallback = new Date(`${dateStr} ${timeStr}`);
      if (!isNaN(fallback.getTime())) return fallback.toISOString();
      return new Date().toISOString();
    }
    return dt.toISOString();
  } catch (err) {
    return new Date().toISOString();
  }
}

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setFormErr("Meeting Title is required.");
      return;
    }
    if (!form.date) {
      setFormErr("Date is required.");
      return;
    }
    if (!form.time) {
      setFormErr("Time is required.");
      return;
    }
    const finalMeetingUrl =
      meetingProvider === "NEURAVOLT" && (!form.meetingUrl || !form.meetingUrl.trim())
        ? generateAutoRoom()
        : form.meetingUrl.trim();

    if (!finalMeetingUrl) {
      setFormErr(meetingProvider === "NEURAVOLT" ? "Please generate a room." : "Meeting URL is required.");
      return;
    }
    if (!form.pin.trim() || !/^\d{4}$/.test(form.pin.trim())) {
      setFormErr("4-Digit PIN must be exactly 4 numbers.");
      return;
    }

    try {
      setFormErr("");
      const isoDate = parseMeetingDateTime(form.date, form.time);
      await createMutation.mutateAsync({
        title: form.title.trim(),
        meetingDate: isoDate,
        meetingUrl: finalMeetingUrl,
        pin: form.pin.trim(),
      });
      setCreateOpen(false);
      showToast("Meeting created successfully.");
    } catch (err: any) {
      const rawMsg = err.response?.data?.message;
      const msg = Array.isArray(rawMsg)
        ? rawMsg.join(", ")
        : typeof rawMsg === "string"
        ? rawMsg
        : "Failed to create meeting.";
      setFormErr(msg);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editMeeting) return;

    if (!form.title.trim()) {
      setFormErr("Meeting Title is required.");
      return;
    }
    if (!form.date || !form.time) {
      setFormErr("Date and Time are required.");
      return;
    }
    const finalMeetingUrl =
      meetingProvider === "NEURAVOLT" && (!form.meetingUrl || !form.meetingUrl.trim())
        ? generateAutoRoom()
        : form.meetingUrl.trim();

    if (!finalMeetingUrl) {
      setFormErr(meetingProvider === "NEURAVOLT" ? "Please generate a room." : "Meeting URL is required.");
      return;
    }
    if (form.pin.trim() && !/^\d{4}$/.test(form.pin.trim())) {
      setFormErr("PIN must be exactly 4 numbers if provided.");
      return;
    }

    try {
      setFormErr("");
      const isoDate = parseMeetingDateTime(form.date, form.time);
      const payload: any = {
        id: editMeeting.id,
        title: form.title.trim(),
        meetingDate: isoDate,
        meetingUrl: finalMeetingUrl,
      };
      if (form.pin.trim()) {
        payload.pin = form.pin.trim();
      }

      await updateMutation.mutateAsync(payload);
      setEditMeeting(null);
      showToast("Meeting updated successfully.");
    } catch (err: any) {
      const rawMsg = err.response?.data?.message;
      const msg = Array.isArray(rawMsg)
        ? rawMsg.join(", ")
        : typeof rawMsg === "string"
        ? rawMsg
        : "Failed to update meeting.";
      setFormErr(msg);
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancelId) return;
    try {
      await cancelMutation.mutateAsync(cancelId);
      setCancelId(null);
      showToast("Meeting cancelled.");
    } catch (err: any) {
      showToast("Failed to cancel meeting.");
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteMutation.mutateAsync(deleteId);
      setDeleteId(null);
      showToast("Meeting deleted.");
    } catch (err: any) {
      showToast("Failed to delete meeting.");
    }
  };

  const STATUS_BADGES: Record<string, { label: string; cls: string }> = {
    ACTIVE: { label: "Active", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    EXPIRED: { label: "Expired", cls: "bg-amber-50 text-amber-700 border-amber-200" },
    CANCELLED: { label: "Cancelled", cls: "bg-rose-50 text-rose-700 border-rose-200" },
  };

  const [now] = useState(() => Date.now());
  const upcoming = meetings.filter((m) => (m.computedStatus || m.status) === "ACTIVE" && new Date(m.meetingDate).getTime() >= now).length;
  const today = meetings.filter((m) => new Date(m.meetingDate).toDateString() === new Date().toDateString()).length;

  return (
    <PageShell>
      {/* Toast notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-slate-900 text-white text-sm font-medium px-4 py-3 rounded-xl shadow-2xl animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          {toast}
        </div>
      )}

      <PageHeader
        icon={Video}
        title="NeuraConnect"
        subtitle="Secure HD video conferences and branded meeting links for your team and clients."
        actions={<Button variant="primary" onClick={openCreateModal}><Plus className="w-4 h-4" /> Create meeting</Button>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Meetings" value={meetings.length} icon={Video} tone="info" />
        <KpiCard label="Today" value={today} icon={Calendar} tone={today ? "violet" : "neutral"} />
        <KpiCard label="Upcoming" value={upcoming} icon={CheckCircle2} tone="ok" />
        <KpiCard label="Expired or cancelled" value={meetings.filter((m) => ["EXPIRED", "CANCELLED"].includes(m.computedStatus || m.status)).length} tone="neutral" />
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <SearchInput className="flex-1" placeholder="Search meetings by title…" value={search} onChange={setSearch} />
        <select className={selectClass} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="ALL">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="EXPIRED">Expired</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      {/* Meetings List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20 bg-white rounded-2xl border border-slate-100">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        </div>
      ) : meetings.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-100 p-8 space-y-4">
          <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto">
            <Video className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">No meetings yet</h3>
          <p className="text-slate-500 text-sm max-w-md mx-auto">
            Create your first secure branded meeting link.
          </p>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-all"
          >
            <Plus className="w-4 h-4 mr-2" /> Create Meeting
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-6">Meeting Title</th>
                  <th className="py-3.5 px-6">Date & Time</th>
                  <th className="py-3.5 px-6">Status</th>
                  <th className="py-3.5 px-6">Public Link</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                {meetings.map((m) => {
                  const statusKey = m.computedStatus || m.status;
                  const badge = STATUS_BADGES[statusKey] || STATUS_BADGES.ACTIVE;
                  const meetingDateObj = new Date(m.meetingDate);

                  return (
                    <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-4 px-6 font-semibold text-slate-900">
                        <Link
                          href={`/meetings/${m.id}`}
                          className="hover:text-indigo-600 transition-colors"
                        >
                          {m.title}
                        </Link>
                      </td>
                      <td className="py-4 px-6 text-slate-600">
                        <div className="flex items-center gap-1.5 text-xs">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {meetingDateObj.toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
                          <Clock className="w-3.5 h-3.5" />
                          {meetingDateObj.toLocaleTimeString("en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${badge.cls}`}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-slate-600 truncate max-w-[200px]">
                            {getPublicUrl(m.slug)}
                          </span>
                          <button
                            onClick={() => handleCopyLink(m.slug, m.pin, m.title)}
                            title="Copy Public Link & PIN"
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleWhatsAppShare(m)}
                            title="Share on WhatsApp"
                            className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                          >
                            <Share2 className="w-4 h-4" />
                          </button>

                          <Link
                            href={`/meetings/${m.id}`}
                            title="View Details"
                            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>

                          <button
                            onClick={() => openEditModal(m)}
                            title="Edit Meeting"
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          {statusKey === "ACTIVE" && (
                            <button
                              onClick={() => setCancelId(m.id)}
                              title="Cancel Meeting"
                              className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          )}

                          <button
                            onClick={() => setDeleteId(m.id)}
                            title="Delete Meeting"
                            className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE MEETING MODAL */}
      <Modal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create Secure Meeting"
        subtitle="Generate a branded NeuraConnect link protected with a 4-digit PIN"
      >
        <form onSubmit={handleCreateSubmit} className="p-6 space-y-4">
          {formErr && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-600">
              {formErr}
            </div>
          )}

          <FormField label="Meeting Title" required>
            <input
              type="text"
              placeholder="e.g. Team Progress Meeting"
              className={inputCls}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Date" required>
              <input
                type="date"
                className={inputCls}
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </FormField>
            <FormField label="Time" required>
              <input
                type="time"
                className={inputCls}
                value={form.time}
                onChange={(e) => setForm({ ...form, time: e.target.value })}
              />
            </FormField>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-700">Platform</label>
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg text-xs font-medium">
              <button
                type="button"
                onClick={() => {
                  setMeetingProvider("NEURAVOLT");
                  if (!form.meetingUrl || form.meetingUrl.includes("meet.google.com") || form.meetingUrl.includes("zoom.us")) {
                    setForm({ ...form, meetingUrl: generateAutoRoom() });
                  }
                }}
                className={`py-2 px-3 rounded-md transition-all ${
                  meetingProvider === "NEURAVOLT"
                    ? "bg-white text-slate-900 shadow-2xs font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                NeuraConnect Room
              </button>
              <button
                type="button"
                onClick={() => {
                  setMeetingProvider("EXTERNAL");
                  if (form.meetingUrl.includes("meet/room")) {
                    setForm({ ...form, meetingUrl: "" });
                  }
                }}
                className={`py-2 px-3 rounded-md transition-all ${
                  meetingProvider === "EXTERNAL"
                    ? "bg-white text-slate-900 shadow-2xs font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Google Meet / Zoom
              </button>
            </div>

            {meetingProvider === "NEURAVOLT" ? (
              <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/60 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-700">Dedicated Room Link</span>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, meetingUrl: generateAutoRoom() })}
                    className="text-xs text-slate-500 hover:text-slate-900 underline"
                  >
                    Regenerate
                  </button>
                </div>
                <div className="bg-white px-2.5 py-1.5 rounded border border-slate-200 font-mono text-xs text-slate-700 truncate">
                  {form.meetingUrl}
                </div>
              </div>
            ) : (
              <FormField label="Meeting URL" required>
                <input
                  type="url"
                  placeholder="https://meet.google.com/... or https://zoom.us/j/..."
                  className={inputCls}
                  value={form.meetingUrl}
                  onChange={(e) => setForm({ ...form, meetingUrl: e.target.value })}
                />
              </FormField>
            )}
          </div>

          <FormField label="4-Digit Passcode" required>
            <div className="flex items-center gap-2">
              <input
                type="text"
                maxLength={4}
                placeholder="4827"
                className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono font-semibold tracking-widest text-slate-900 bg-white focus:border-slate-900 focus:outline-none transition-colors"
                value={form.pin}
                onChange={(e) =>
                  setForm({
                    ...form,
                    pin: e.target.value.replace(/\D/g, "").slice(0, 4),
                  })
                }
              />
              <button
                type="button"
                onClick={() => setForm({ ...form, pin: generateRandomPin() })}
                className="px-3 py-2 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors shrink-0"
              >
                Generate
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Required by participants to enter the room.
            </p>
          </FormField>

          <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="inline-flex items-center px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
            >
              {createMutation.isPending && (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              )}
              Create Meeting
            </button>
          </div>
        </form>
      </Modal>

      {/* EDIT MEETING MODAL */}
      <Modal
        isOpen={!!editMeeting}
        onClose={() => setEditMeeting(null)}
        title="Edit Meeting"
        subtitle="Update meeting details or set a new PIN"
      >
        <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
          {formErr && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-600">
              {formErr}
            </div>
          )}

          <FormField label="Meeting Title" required>
            <input
              type="text"
              className={inputCls}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Date" required>
              <input
                type="date"
                className={inputCls}
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </FormField>
            <FormField label="Time" required>
              <input
                type="time"
                className={inputCls}
                value={form.time}
                onChange={(e) => setForm({ ...form, time: e.target.value })}
              />
            </FormField>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-700">Platform</label>
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg text-xs font-medium">
              <button
                type="button"
                onClick={() => {
                  setMeetingProvider("NEURAVOLT");
                  if (!form.meetingUrl || form.meetingUrl.includes("meet.google.com") || form.meetingUrl.includes("zoom.us")) {
                    setForm({ ...form, meetingUrl: generateAutoRoom() });
                  }
                }}
                className={`py-2 px-3 rounded-md transition-all ${
                  meetingProvider === "NEURAVOLT"
                    ? "bg-white text-slate-900 shadow-2xs font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                NeuraConnect Room
              </button>
              <button
                type="button"
                onClick={() => {
                  setMeetingProvider("EXTERNAL");
                  if (form.meetingUrl.includes("meet/room")) {
                    setForm({ ...form, meetingUrl: "" });
                  }
                }}
                className={`py-2 px-3 rounded-md transition-all ${
                  meetingProvider === "EXTERNAL"
                    ? "bg-white text-slate-900 shadow-2xs font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Google Meet / Zoom
              </button>
            </div>

            {meetingProvider === "NEURAVOLT" ? (
              <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/60 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-700">Dedicated Room Link</span>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, meetingUrl: generateAutoRoom() })}
                    className="text-xs text-slate-500 hover:text-slate-900 underline"
                  >
                    Regenerate
                  </button>
                </div>
                <div className="bg-white px-2.5 py-1.5 rounded border border-slate-200 font-mono text-xs text-slate-700 truncate">
                  {form.meetingUrl}
                </div>
              </div>
            ) : (
              <FormField label="Meeting URL" required>
                <input
                  type="url"
                  placeholder="https://meet.google.com/... or https://zoom.us/j/..."
                  className={inputCls}
                  value={form.meetingUrl}
                  onChange={(e) => setForm({ ...form, meetingUrl: e.target.value })}
                />
              </FormField>
            )}
          </div>

          <FormField label="New 4-Digit Passcode (Optional)">
            <div className="flex items-center gap-2">
              <input
                type="text"
                maxLength={4}
                placeholder="Leave blank to keep current"
                className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono font-semibold tracking-widest text-slate-900 bg-white focus:border-slate-900 focus:outline-none transition-colors"
                value={form.pin}
                onChange={(e) =>
                  setForm({
                    ...form,
                    pin: e.target.value.replace(/\D/g, "").slice(0, 4),
                  })
                }
              />
              <button
                type="button"
                onClick={() => setForm({ ...form, pin: generateRandomPin() })}
                className="px-3 py-2 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors shrink-0"
              >
                Generate
              </button>
            </div>
          </FormField>

          <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setEditMeeting(null)}
              className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="inline-flex items-center px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
            >
              {updateMutation.isPending && (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              )}
              Save Changes
            </button>
          </div>
        </form>
      </Modal>

      {/* CANCEL CONFIRMATION DIALOG */}
      <Modal
        isOpen={!!cancelId}
        onClose={() => setCancelId(null)}
        title="Cancel Meeting"
        maxWidth="max-w-md"
      >
        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-600">
            Are you sure you want to cancel this meeting? This meeting link will
            no longer allow users to join.
          </p>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              onClick={() => setCancelId(null)}
              className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleConfirmCancel}
              disabled={cancelMutation.isPending}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              Confirm Cancel
            </button>
          </div>
        </div>
      </Modal>

      {/* DELETE CONFIRMATION DIALOG */}
      <Modal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Delete Meeting"
        maxWidth="max-w-md"
      >
        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-600">
            Are you sure you want to delete this meeting record? This action
            cannot be undone.
          </p>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              onClick={() => setDeleteId(null)}
              className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmDelete}
              disabled={deleteMutation.isPending}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      </Modal>
    </PageShell>
  );
}
