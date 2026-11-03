"use client";

import { useState, use } from "react";
import {
  useMeetingDetails,
  useDelete,
  useCancelMeeting,
} from "@/src/hooks/queries";
import { useRouter } from "next/navigation";
import {
  Video,
  Calendar,
  Clock,
  Lock,
  Copy,
  Share2,
  Trash2,
  XCircle,
  ArrowLeft,
  Loader2,
  ExternalLink,
  CheckCircle2,
  UserCheck,
  ShieldCheck,
  Globe,
} from "lucide-react";
import { Modal } from "../../components/Modal";
import Link from "next/link";

export default function MeetingDetailsPage({
  params: paramsPromise,
}: {
  params: Promise<{ id: string }>;
}) {
  const params = use(paramsPromise);
  const router = useRouter();
  const { data: meeting, isLoading, isError } = useMeetingDetails(params.id);

  const [toast, setToast] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const cancelMutation = useCancelMeeting();
  const deleteMutation = useDelete("meetings", "meetings");

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

  const handleCopyLink = () => {
    if (!meeting) return;
    const publicUrl = getPublicUrl(meeting.slug);
    const pinPart = meeting.pin ? `\n🔑 4-Digit PIN: ${meeting.pin}` : "";
    const invitationText = `Meeting: ${meeting.title}\nJoin: ${publicUrl}${pinPart}`;
    navigator.clipboard.writeText(invitationText);
    showToast("Meeting link & PIN copied.");
  };

  const handleWhatsAppShare = () => {
    if (!meeting) return;
    const publicUrl = getPublicUrl(meeting.slug);
    const dateObj = new Date(meeting.meetingDate);
    const formattedDate = dateObj.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const formattedTime = dateObj.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const pinText = meeting.pin
      ? `🔑 *Meeting PIN:* ${meeting.pin}`
      : `🔒 *(4-Digit PIN required to join)*`;

    const shareText = `*${meeting.title}* - NeuraConnect Invitation\n\n📅 Date: ${formattedDate}\n⏰ Time: ${formattedTime}\n\n🔗 *Join Link:* ${publicUrl}\n${pinText}\n\n(Enter this 4-digit PIN on the link above to join)`;
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(
      shareText
    )}`;
    window.open(waUrl, "_blank");
  };

  const handleConfirmCancel = async () => {
    if (!meeting) return;
    try {
      await cancelMutation.mutateAsync(meeting.id);
      setCancelOpen(false);
      showToast("Meeting cancelled.");
    } catch (err: any) {
      showToast("Failed to cancel meeting.");
    }
  };

  const handleConfirmDelete = async () => {
    if (!meeting) return;
    try {
      await deleteMutation.mutateAsync(meeting.id);
      router.replace("/meetings");
    } catch (err: any) {
      showToast("Failed to delete meeting.");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  if (isError || !meeting) {
    return (
      <div className="p-8 max-w-4xl mx-auto text-center space-y-4">
        <h2 className="text-xl font-bold text-slate-900">Meeting Not Found</h2>
        <p className="text-slate-500 text-sm">
          The requested meeting record does not exist or was deleted.
        </p>
        <Link
          href="/meetings"
          className="inline-flex items-center text-sm font-semibold text-indigo-600 hover:underline"
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Meetings
        </Link>
      </div>
    );
  }

  const statusKey = meeting.computedStatus || meeting.status;
  const meetingDateObj = new Date(meeting.meetingDate);

  const STATUS_BADGES: Record<string, { label: string; cls: string }> = {
    ACTIVE: { label: "Active", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    EXPIRED: { label: "Expired", cls: "bg-amber-50 text-amber-700 border-amber-200" },
    CANCELLED: { label: "Cancelled", cls: "bg-rose-50 text-rose-700 border-rose-200" },
  };

  const badge = STATUS_BADGES[statusKey] || STATUS_BADGES.ACTIVE;

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-slate-900 text-white text-sm font-medium px-4 py-3 rounded-xl shadow-2xl animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          {toast}
        </div>
      )}

      {/* Back button */}
      <Link
        href="/meetings"
        className="inline-flex items-center text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors"
      >
        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Meetings
      </Link>

      {/* Main Details Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-semibold text-slate-900">{meeting.title}</h1>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${badge.cls}`}
              >
                {badge.label}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Code: <span className="font-mono font-medium text-slate-600">{meeting.slug}</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyLink}
              className="px-3.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-lg transition-colors"
            >
              Copy Invitation
            </button>
            <button
              onClick={handleWhatsAppShare}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg transition-colors"
            >
              Share WhatsApp
            </button>
          </div>
        </div>

        {/* Clean Structured Data List */}
        <div className="rounded-lg border border-slate-200 divide-y divide-slate-100 bg-slate-50/40">
          {/* Schedule */}
          <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Schedule</span>
            <span className="text-sm font-medium text-slate-900">
              {meetingDateObj.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })} at {meetingDateObj.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>

          {/* Access Passcode */}
          <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">Access Passcode</span>
              <span className="text-[11px] text-slate-400">Required by attendees to enter</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-base font-bold tracking-widest text-slate-900 bg-white px-2.5 py-0.5 rounded border border-slate-200 shadow-2xs">
                {meeting.pin || "••••"}
              </span>
              {meeting.pin && (
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(meeting.pin);
                    showToast("Passcode copied.");
                  }}
                  className="text-xs font-medium text-slate-600 hover:text-slate-900 px-2 py-0.5 border border-slate-200 rounded hover:bg-white transition-colors"
                >
                  Copy
                </button>
              )}
            </div>
          </div>

          {/* Public Link */}
          <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">Public Participant Link</span>
              <p className="font-mono text-xs text-slate-600 truncate mt-0.5">{getPublicUrl(meeting.slug)}</p>
            </div>
            <button
              onClick={handleCopyLink}
              className="text-xs font-medium text-slate-600 hover:text-slate-900 px-2.5 py-1 border border-slate-200 rounded hover:bg-white transition-colors shrink-0"
            >
              Copy
            </button>
          </div>

          {/* Room URL */}
          <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">Conference Room URL</span>
              <p className="font-mono text-xs text-slate-600 truncate mt-0.5">{meeting.meetingUrl}</p>
            </div>
            <a
              href={meeting.meetingUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-medium text-slate-700 hover:text-slate-900 px-2.5 py-1 border border-slate-200 rounded hover:bg-white transition-colors shrink-0"
            >
              Open Room ↗
            </a>
          </div>
        </div>

        {/* Footer Meta */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-1 text-xs text-slate-400 gap-2">
          <span>
            Created by {meeting.createdBy ? `${meeting.createdBy.firstName} ${meeting.createdBy.lastName}` : "System Admin"}
          </span>
          <div className="flex items-center gap-3">
            {statusKey === "ACTIVE" && (
              <button
                onClick={() => setCancelOpen(true)}
                className="text-xs text-amber-600 hover:text-amber-800 font-medium transition-colors"
              >
                Cancel Meeting
              </button>
            )}
            <button
              onClick={() => setDeleteOpen(true)}
              className="text-xs text-rose-600 hover:text-rose-800 font-medium transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      {/* CANCEL MODAL */}
      <Modal
        isOpen={cancelOpen}
        onClose={() => setCancelOpen(false)}
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
              onClick={() => setCancelOpen(false)}
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

      {/* DELETE MODAL */}
      <Modal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete Meeting"
        maxWidth="max-w-md"
      >
        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-600">
            Are you sure you want to delete this meeting record?
          </p>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              onClick={() => setDeleteOpen(false)}
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
    </div>
  );
}
