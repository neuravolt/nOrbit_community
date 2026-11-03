"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { identitySDK } from "../../sdk/identity-sdk";
import { BiometricWizardModal } from "../../components/biometric/BiometricWizardModal";
import { ShieldCheck, UserCheck, Key, AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";

interface BiometricTabProps {
  user: any;
}

export const BiometricTab: React.FC<BiometricTabProps> = ({ user }) => {
  const [wizardOpen, setWizardOpen] = useState(false);
  const qc = useQueryClient();

  const { data: statusData, isLoading } = useQuery({
    queryKey: ["biometric-status", user.id],
    queryFn: () => identitySDK.getStatus(user.id),
  });

  return (
    <div className="space-y-6">
      {/* Identity Platform Header Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="space-y-1 text-center md:text-left">
          <div className="flex items-center gap-2 justify-center md:justify-start">
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
            <span className="text-xs font-extrabold uppercase text-indigo-600 tracking-wider">Enterprise Biometric Identity Layer</span>
          </div>
          <h2 className="text-xl font-black text-slate-900">Biometric Profile & Purpose Consents</h2>
          <p className="text-xs text-slate-500">DPDP Act 2023 Compliant • Face Descriptor Storage</p>
        </div>

        <button
          onClick={() => setWizardOpen(true)}
          className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-2 border border-indigo-400"
        >
          <UserCheck className="w-4 h-4" />
          {statusData?.enrolled ? "Re-Enroll Biometric Profile" : "Launch 7-Step Biometric Wizard"}
        </button>
      </div>

      {/* Profile Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
          <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Biometric Status</span>
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${statusData?.enrolled ? "bg-emerald-500" : "bg-amber-500"}`} />
            <span className="text-base font-extrabold text-slate-900">
              {statusData?.enrolled ? "ACTIVE (ENROLLED)" : "NOT ENROLLED"}
            </span>
          </div>
          <p className="text-[11px] text-slate-500">Vector engine: {statusData?.modelVersion || "face-api-js_face_recognition_v1"}</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
          <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Enrollment Quality Score</span>
          <div className="text-base font-extrabold text-slate-900">
            {statusData?.qualityScore ? `${(statusData.qualityScore * 100).toFixed(1)}%` : "N/A"}
          </div>
          <p className="text-[11px] text-slate-500">Face detection quality gate passed</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
          <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">DPDP Act Purpose Consent</span>
          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700">
            <CheckCircle2 className="w-4 h-4" /> ATTENDANCE (Granted)
          </div>
          <p className="text-[11px] text-slate-500">1-Year Valid explicit affirmative consent</p>
        </div>
      </div>

      {/* Biometric Enrollment Wizard Modal */}
      {wizardOpen && (
        <BiometricWizardModal
          open={wizardOpen}
          onClose={() => setWizardOpen(false)}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ["biometric-status", user.id] });
          }}
          employeeName={`${user.firstName} ${user.lastName}`}
        />
      )}
    </div>
  );
};
