"use client";

import { useEffect, useState, useRef } from "react";
import {
  Calendar,
  Clock,
  Lock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";
import { api } from "@/src/lib/api";

interface PublicMeeting {
  title: string;
  meetingDate: string;
  status: "ACTIVE" | "EXPIRED" | "CANCELLED";
}

export default function PublicMeetingClient({ slug }: { slug: string }) {
  const [meeting, setMeeting] = useState<PublicMeeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 4 discrete PIN digits
  const [pinDigits, setPinDigits] = useState<string[]>(["", "", "", ""]);
  const inputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  const [verifying, setVerifying] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [verifiedUrl, setVerifiedUrl] = useState<string | null>(null);

  useEffect(() => {
    async function loadPublicMeeting() {
      try {
        setLoading(true);
        const { data } = await api.get(`/meetings/public/${slug}`);
        setMeeting(data);
      } catch (err: any) {
        setError(
          err.response?.data?.message ||
            "Meeting not found or link has expired."
        );
      } finally {
        setLoading(false);
      }
    }
    loadPublicMeeting();
  }, [slug]);

  const handleDigitChange = (index: number, value: string) => {
    const numericVal = value.replace(/\D/g, "").slice(-1);
    const newDigits = [...pinDigits];
    newDigits[index] = numericVal;
    setPinDigits(newDigits);
    setPinError(null);

    // Auto-focus next input
    if (numericVal && index < 3) {
      inputRefs[index + 1].current?.focus();
    }
  };

  const handleKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "Backspace" && !pinDigits[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    }
  };

  const handleVerifyPin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const fullPin = pinDigits.join("");
    if (fullPin.length !== 4) {
      setPinError("Please enter all 4 digits of the PIN.");
      return;
    }

    try {
      setVerifying(true);
      setPinError(null);

      // Step 1: Verify PIN on server -> returns short-lived token
      const verifyRes = await api.post(`/meetings/public/${slug}/verify`, {
        pin: fullPin,
      });

      const { meetingToken } = verifyRes.data;

      // Step 2: Token Exchange -> returns destination Google Meet URL
      const joinRes = await api.post(`/meetings/public/${slug}/join`, {
        token: meetingToken,
      });

      const targetUrl = joinRes.data.meetingUrl;
      setVerifiedUrl(targetUrl);
      // Instant automatic redirect into Google Meet
      window.location.href = targetUrl;
    } catch (err: any) {
      if (err.response?.status === 429) {
        setPinError("Too many attempts. Please try again later.");
      } else {
        setPinError(
          err.response?.data?.message ||
            "Incorrect PIN. Please enter the correct 4-digit PIN."
        );
      }
      setPinDigits(["", "", "", ""]);
      inputRefs[0].current?.focus();
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
          <p className="text-sm font-medium text-slate-500">Loading meeting...</p>
        </div>
      </div>
    );
  }

  if (error || !meeting) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-lg border border-slate-100 text-center space-y-4">
          <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Meeting Not Found</h2>
          <p className="text-slate-500 text-sm">{error || "This meeting link is invalid or no longer exists."}</p>
        </div>
      </div>
    );
  }

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

  return (
    <div className="min-h-screen bg-[#fcfcfd] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-200/90 shadow-sm p-7 sm:p-8">
        {/* Brand Header */}
        <div className="text-center">
          <img
            src="/norbit-logo.png"
            alt="nORBIT"
            className="h-8 w-auto mx-auto object-contain mb-5"
          />
          <h1 className="text-lg font-semibold text-slate-900 tracking-tight">
            {meeting.title}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {formattedDate} • {formattedTime}
          </p>
        </div>

        <div className="my-6 border-t border-slate-100" />

        {/* Status Checks */}
        {meeting.status === "CANCELLED" ? (
          <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200/70 text-center space-y-1">
            <span className="text-xs font-semibold text-rose-700 block">
              Meeting Cancelled
            </span>
            <p className="text-[11px] text-rose-600">
              This meeting has been cancelled by the host.
            </p>
          </div>
        ) : meeting.status === "EXPIRED" ? (
          <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200/70 text-center space-y-1">
            <span className="text-xs font-semibold text-amber-800 block">
              Meeting Expired
            </span>
            <p className="text-[11px] text-amber-700">
              This meeting link is no longer active.
            </p>
          </div>
        ) : verifiedUrl ? (
          /* SUCCESS STATE */
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200/80 text-center space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-emerald-900">
                Verified
              </h3>
              <p className="text-xs text-emerald-700 mt-0.5 flex items-center justify-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Launching conference room...
              </p>
            </div>

            <a
              href={verifiedUrl}
              className="inline-flex items-center justify-center w-full py-2 px-4 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg transition-colors"
            >
              Click if not redirected automatically
            </a>
          </div>
        ) : (
          /* PIN ENTRY FORM */
          <form onSubmit={handleVerifyPin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 text-center mb-3">
                Enter 4-digit passcode
              </label>

              {/* 4 Box Digit Inputs */}
              <div className="flex items-center justify-center gap-2.5">
                {pinDigits.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={inputRefs[idx]}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleDigitChange(idx, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(idx, e)}
                    className="w-12 h-12 text-center text-xl font-mono font-semibold text-slate-900 bg-white border border-slate-300 rounded-lg focus:border-slate-900 focus:outline-none transition-all shadow-2xs"
                  />
                ))}
              </div>
            </div>

            {pinError && (
              <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200/80 text-xs font-medium text-rose-600 text-center">
                {pinError}
              </div>
            )}

            <button
              type="submit"
              disabled={verifying || pinDigits.join("").length !== 4}
              className="w-full mt-2 py-2.5 px-4 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {verifying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Connecting...
                </>
              ) : (
                "Join Conference"
              )}
            </button>
          </form>
        )}

        {/* Footer */}
        <p className="text-[11px] text-slate-400 text-center mt-6">
          Secured with end-to-end encryption by NeuraConnect
        </p>
      </div>
    </div>
  );
}
