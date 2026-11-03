"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Loader2 } from "lucide-react";

export default function SecurityRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/");
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
      <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">
        <ShieldCheck className="w-6 h-6 animate-pulse" />
      </div>
      <h2 className="text-base font-bold text-slate-800">Redirecting to Guardian Security Center...</h2>
      <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        <span>Loading incident overview and telemetry...</span>
      </p>
    </div>
  );
}
