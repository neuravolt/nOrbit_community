"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/src/lib/api";
import { useAuthStore } from "@/src/store/auth";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Globe,
  Layers,
  Loader2,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";

export default function OnboardingPage() {
  const router = useRouter();
  const { user, setUser } = useAuthStore();
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please enter a valid organization or company name.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const { data } = await api.post("/organizations", {
        name: name.trim(),
        domain: domain.trim() || undefined,
      });

      // Update current user state with the new active organization
      if (user && data?.organization?.id) {
        setUser({
          ...user,
          activeOrganizationId: data.organization.id,
        } as any);
      }

      // Re-fetch current user profile to synchronize all active org attributes
      try {
        const meRes = await api.get("/auth/me");
        if (meRes.data) {
          setUser(meRes.data);
        }
      } catch {
        // Non-blocking fallback
      }

      router.push("/projects");
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          "Failed to initialize your organization workspace. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-slate-950 px-4 py-12 text-slate-100 relative">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(99,102,241,0.18),transparent_55%)] pointer-events-none" />

      <div className="w-full max-w-lg space-y-8 relative z-10">
        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
            <span className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-[11px]">
              ✓
            </span>
            Account Created
          </div>
          <div className="w-8 h-[1px] bg-slate-800" />
          <div className="flex items-center gap-2 text-xs font-semibold text-indigo-400">
            <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[11px] shadow-sm shadow-indigo-500">
              2
            </span>
            Create Workspace
          </div>
          <div className="w-8 h-[1px] bg-slate-800" />
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <span className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-[11px]">
              3
            </span>
            Collaborate
          </div>
        </div>

        <div className="text-center space-y-2">
          <Link href="/" className="inline-flex items-center gap-2 mb-1 group">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center font-black text-white text-xl shadow-lg shadow-indigo-600/30 group-hover:scale-105 transition">
              N
            </div>
            <span className="text-2xl font-black tracking-tight text-white font-[Space_Grotesk]">
              nORBIT
            </span>
          </Link>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Name your workspace
          </h1>
          <p className="text-sm text-slate-400">
            A dedicated sovereign tenant for your projects, teams, billing, and clients.
          </p>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur-xl">
          {error && (
            <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Organization / Company Name <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Building2 className="h-4 w-4 text-slate-500" />
                </div>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Acme Global Inc."
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950/60 border border-slate-700 rounded-xl text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                You can invite your teammates and collaborate once created.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Company Domain <span className="text-slate-500">(Optional)</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Globe className="h-4 w-4 text-slate-500" />
                </div>
                <input
                  type="text"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="acmeglobal.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950/60 border border-slate-700 rounded-xl text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                />
              </div>
            </div>

            {/* Feature preview cards */}
            <div className="pt-2 grid grid-cols-2 gap-2 text-xs text-slate-400">
              <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800/80 space-y-1">
                <div className="flex items-center gap-1.5 text-slate-300 font-semibold">
                  <Layers size={14} className="text-indigo-400" /> Dedicated Vault
                </div>
                <p className="text-[11px] text-slate-500 leading-snug">
                  Row-level tenancy with cryptographic partition isolation.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800/80 space-y-1">
                <div className="flex items-center gap-1.5 text-slate-300 font-semibold">
                  <Users size={14} className="text-indigo-400" /> Team RBAC
                </div>
                <p className="text-[11px] text-slate-500 leading-snug">
                  Owner, Admin, Member, and Viewer permissions built in.
                </p>
              </div>
            </div>

            <div className="pt-3">
              <button
                type="submit"
                disabled={loading || !name.trim()}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition shadow-lg shadow-indigo-600/30 disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Initializing Workspace...
                  </>
                ) : (
                  <>
                    Create Workspace & Launch <ArrowRight size={16} />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        <div className="text-center text-xs text-slate-500 flex items-center justify-center gap-1.5">
          <ShieldCheck size={14} className="text-slate-500" />
          <span>Sovereign Data Isolation • Indian Cloud Compliant</span>
        </div>
      </div>
    </div>
  );
}
