"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/src/lib/api";
import { useAuthStore } from "@/src/store/auth";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Loader2,
  LogIn,
  ShieldCheck,
  UserCheck,
  Users,
  XCircle,
} from "lucide-react";

interface InvitationData {
  valid: boolean;
  organizationId: string;
  organizationName: string;
  email: string;
  role: string;
  invitedBy: string;
}

function JoinInvitationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const { user, isAuthenticated, setUser } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("No invitation token found in the request URL.");
      setLoading(false);
      return;
    }

    let isSubscribed = true;
    api
      .get(`/organizations/invitations/${token}`)
      .then((res) => {
        if (!isSubscribed) return;
        setInvitation(res.data);
      })
      .catch((err) => {
        if (!isSubscribed) return;
        setError(
          err.response?.data?.message ||
            "This invitation link is invalid or has expired. Please ask your administrator to send a new invitation.",
        );
      })
      .finally(() => {
        if (isSubscribed) setLoading(false);
      });

    return () => {
      isSubscribed = false;
    };
  }, [token]);

  const handleAccept = async () => {
    if (!token) return;
    setAccepting(true);
    setError(null);

    try {
      await api.post(`/organizations/invitations/${token}/accept`);
      setSuccess(true);

      // Refresh current user in store
      try {
        const meRes = await api.get("/auth/me");
        if (meRes.data) {
          setUser(meRes.data);
        }
      } catch {
        // Fallback
      }

      setTimeout(() => {
        router.push("/projects");
      }, 1500);
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          "Failed to accept invitation. Please ensure you are logged into the correct account.",
      );
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="py-12 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto text-indigo-400">
          <Loader2 size={32} className="animate-spin" />
        </div>
        <h2 className="text-xl font-bold text-white">Validating Invitation</h2>
        <p className="text-slate-400 text-sm">Please hold while we verify your access token...</p>
      </div>
    );
  }

  if (error || !invitation) {
    return (
      <div className="text-center space-y-5 animate-in fade-in zoom-in-95">
        <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center mx-auto text-red-400">
          <XCircle size={32} />
        </div>
        <h2 className="text-xl font-bold text-white tracking-tight">
          Invalid or Expired Invitation
        </h2>
        <p className="text-slate-400 text-sm leading-relaxed">{error}</p>
        <div className="pt-3">
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm transition"
          >
            Return to Sign In
          </Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="text-center space-y-5 animate-in fade-in zoom-in-95">
        <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto text-emerald-400">
          <CheckCircle2 size={32} />
        </div>
        <h2 className="text-2xl font-bold text-white tracking-tight">
          Welcome to {invitation.organizationName}!
        </h2>
        <p className="text-slate-400 text-sm leading-relaxed">
          Your invitation has been successfully accepted. Launching your workspace...
        </p>
        <div className="pt-2 flex justify-center">
          <Loader2 size={24} className="animate-spin text-indigo-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="w-16 h-16 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex items-center justify-center mx-auto text-indigo-400 mb-3">
          <Building2 size={32} />
        </div>
        <h2 className="text-2xl font-bold text-white tracking-tight">
          Join {invitation.organizationName}
        </h2>
        <p className="text-slate-400 text-sm">
          <span className="font-semibold text-slate-200">{invitation.invitedBy}</span> has invited you to join their workspace on NORBIT.
        </p>
      </div>

      <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2.5 text-xs text-slate-300">
        <div className="flex items-center justify-between py-1 border-b border-slate-800/80">
          <span className="text-slate-500 font-medium">Invited Email</span>
          <span className="font-semibold text-indigo-400">{invitation.email}</span>
        </div>
        <div className="flex items-center justify-between py-1 border-b border-slate-800/80">
          <span className="text-slate-500 font-medium">Assigned Role</span>
          <span className="font-semibold uppercase tracking-wider text-emerald-400">
            {invitation.role}
          </span>
        </div>
        <div className="flex items-center justify-between py-1">
          <span className="text-slate-500 font-medium">Workspace</span>
          <span className="font-semibold text-white">{invitation.organizationName}</span>
        </div>
      </div>

      {!isAuthenticated ? (
        <div className="space-y-3 pt-2">
          <p className="text-xs text-center text-slate-400">
            Please sign in or register with <span className="text-slate-200 font-semibold">{invitation.email}</span> to accept this invitation.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Link
              href={`/login?redirect=/onboarding/join?token=${token}`}
              className="inline-flex items-center justify-center gap-1.5 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition shadow-lg shadow-indigo-600/30"
            >
              <LogIn size={14} /> Sign In First
            </Link>
            <Link
              href={`/register?email=${encodeURIComponent(invitation.email)}`}
              className="inline-flex items-center justify-center gap-1.5 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition"
            >
              <UserCheck size={14} /> Create Account
            </Link>
          </div>
        </div>
      ) : (
        <div className="pt-2">
          <button
            type="button"
            onClick={handleAccept}
            disabled={accepting}
            className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition shadow-lg shadow-indigo-600/30 disabled:opacity-50 cursor-pointer"
          >
            {accepting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Joining Workspace...
              </>
            ) : (
              <>
                Accept Invitation &amp; Enter Workspace <ArrowRight size={16} />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

export default function JoinPage() {
  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-slate-950 px-4 py-12 text-slate-100 relative">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(99,102,241,0.18),transparent_55%)] pointer-events-none" />

      <div className="w-full max-w-md space-y-8 relative z-10">
        <div className="text-center space-y-2">
          <Link href="/" className="inline-flex items-center gap-2 mb-1 group">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center font-black text-white text-xl shadow-lg shadow-indigo-600/30 group-hover:scale-105 transition">
              N
            </div>
            <span className="text-2xl font-black tracking-tight text-white font-[Space_Grotesk]">
              nORBIT
            </span>
          </Link>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur-xl">
          <Suspense
            fallback={
              <div className="flex items-center justify-center py-8 text-slate-400 gap-2">
                <Loader2 size={20} className="animate-spin" />
                <span>Reading invitation parameters...</span>
              </div>
            }
          >
            <JoinInvitationContent />
          </Suspense>
        </div>

        <div className="text-center text-xs text-slate-500 flex items-center justify-center gap-1.5">
          <ShieldCheck size={14} className="text-slate-500" />
          <span>NORBIT Cryptographic Workspace Onboarding</span>
        </div>
      </div>
    </div>
  );
}
