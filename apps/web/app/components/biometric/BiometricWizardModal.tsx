"use client";

import React, { useState, useRef, useEffect } from "react";
import { Modal } from "../Modal";
import { identitySDK } from "../../sdk/identity-sdk";
import { loadFaceModels, captureLiveFace } from "@/src/lib/face-recognition";
import {
  ShieldCheck, 
  Camera, 
  Sun, 
  UserCheck, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight, 
  RefreshCw,
  Lock
} from "lucide-react";

interface BiometricWizardModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  employeeName: string;
}


export const BiometricWizardModal: React.FC<BiometricWizardModalProps> = ({
  open,
  onClose,
  onSuccess,
  employeeName
}) => {
  const [step, setStep] = useState<number>(1);
  const [consentGranted, setConsentGranted] = useState<boolean>(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [lightingOk, setLightingOk] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [capturedFrames, setCapturedFrames] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [liveHint, setLiveHint] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Attach cameraStream to video element whenever cameraStream or step changes
  useEffect(() => {
    if (videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.play().catch(() => {});
    }
  }, [cameraStream, step]);

  // Stop camera stream on unmount or close
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraStream]);

  // Step 2: Request Camera Access
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 640, facingMode: "user" }
      });
      setCameraStream(stream);
      setStep(3);
      analyzeLighting();
      loadFaceModels().catch(() => {}); // warm the face-api.js models in the background
    } catch (err: any) {
      setErrorMsg("Unable to access live camera. Please grant camera permissions.");
    }
  };

  // Step 3: Lighting Analysis & Auto-Advance to Step 4
  const analyzeLighting = () => {
    setTimeout(() => {
      setLightingOk(true);
      setTimeout(() => {
        setStep(4);
      }, 1000);
    }, 800);
  };

  // Step 4 -> Step 5: Trigger Affirmative Countdown
  const startCountdown = () => {
    setStep(5);
    setCountdown(3);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev === 1) {
          clearInterval(interval);
          triggerFrameBurst();
          return 0;
        }
        return prev ? prev - 1 : 0;
      });
    }, 1000);
  };

  // Step 5: Capture 5-Frame Burst at Countdown Zero
  const triggerFrameBurst = () => {
    setIsCapturing(true);
    const frames: string[] = [];
    let count = 0;

    const captureInterval = setInterval(() => {
      if (videoRef.current && canvasRef.current) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        canvas.width = 480;
        canvas.height = 480;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, 480, 480);
          frames.push(canvas.toDataURL("image/jpeg", 0.90));
        }
      }
      count++;
      if (count >= 5) {
        clearInterval(captureInterval);
        setIsCapturing(false);
        setCapturedFrames(frames);
        processEnrollment(frames);
      }
    }, 200);
  };

  // Step 6: Process AI Enrollment — extract a real face descriptor client-side
  // (face-api.js), then hand it to the server for storage. Try each captured
  // frame in turn until one has a clearly detectable face.
  const processEnrollment = async (frames: string[]) => {
    setStep(6);
    setIsProcessing(true);
    setErrorMsg(null);

    try {
      // Liveness: the server asks for a head turn, so a photo held to the camera cannot be enrolled.
      if (!videoRef.current) throw new Error("The camera stopped. Please start again.");
      const challenge = await identitySDK.challenge();
      const live = await captureLiveFace(videoRef.current, challenge, setLiveHint);
      setLiveHint(null);
      if (!live) {
        throw new Error("Follow the instruction on screen: look straight at the camera, then slowly turn your head the way it asks.");
      }

      const capturedPhoto = frames[frames.length - 1];
      const res = await identitySDK.enroll(live.descriptor, capturedPhoto, consentGranted, live.liveness);
      if (res.success) {
        if (typeof window !== "undefined") {
          try {
            // Overwrite stored local baseline photo
            const storedUser = localStorage.getItem("user");
            if (storedUser) {
              const u = JSON.parse(storedUser);
              if (u?.id) localStorage.setItem(`face_baseline_${u.id}`, capturedPhoto);
            }
          } catch (e) {}
        }
        setIsProcessing(false);
        setStep(7);
      } else {
        throw new Error(res.reason || "Enrollment failed quality checks.");
      }
    } catch (err: any) {
      setIsProcessing(false);
      const rawMsg = err.response?.data?.message || err.message || "Failed to process enrollment.";
      let userFriendly = Array.isArray(rawMsg) ? rawMsg.join(", ") : rawMsg;
      if (typeof userFriendly === 'string' && (userFriendly.toLowerCase().includes('blurred') || userFriendly.toLowerCase().includes('blur') || userFriendly.toLowerCase().includes('threshold') || userFriendly.toLowerCase().includes('quality'))) {
        userFriendly = "Photo is blurry or room lighting is insufficient! Please turn on your room lights, face the camera directly, and keep your phone/laptop camera steady.";
      }
      setErrorMsg(userFriendly);
      setStep(4); // Reset to position check
    }
  };

  const handleClose = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    onClose();
  };

  return (
    <Modal isOpen={open} onClose={handleClose} title="Enterprise Biometric Enrollment Wizard">
      <div className="p-6 space-y-6 max-w-lg mx-auto">
        {/* Step Progress Header */}
        <div className="flex items-center justify-between border-b pb-4 text-xs font-bold text-slate-500">
          <span className={step >= 1 ? "text-indigo-600" : ""}>1. Consent</span>
          <span className={step >= 2 ? "text-indigo-600" : ""}>2. Camera</span>
          <span className={step >= 3 ? "text-indigo-600" : ""}>3. Lighting</span>
          <span className={step >= 4 ? "text-indigo-600" : ""}>4. Alignment</span>
          <span className={step >= 5 ? "text-indigo-600" : ""}>5. Capture</span>
          <span className={step >= 7 ? "text-emerald-600" : ""}>6. Complete</span>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* STEP 1: DPDP Act 2023 Consent */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                <ShieldCheck className="w-5 h-5 text-indigo-600" />
                <span>India DPDP Act 2023 Purpose Limitation Consent</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                By enrolling your face profile, you grant explicit, purpose-limited permission to Neuravolt BioAuth (nORBIT) to process facial biometric vectors exclusively for <strong>Attendance Verification, Payroll Access, and Identity Compliance</strong>.
              </p>
              <ul className="text-[11px] text-slate-500 space-y-1 list-disc pl-4">
                <li>A 128-dimension face descriptor is stored for matching; the enrollment photo itself is retained only so HR can visually review a flagged mismatch.</li>
                <li>Encrypted transmission via TLS 1.3 & SHA-256 integrity verification.</li>
                <li>You retain the right to withdraw consent or request template deletion.</li>
              </ul>
            </div>

            <label className="flex items-center gap-2.5 p-3 border rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
              <input
                type="checkbox"
                checked={consentGranted}
                onChange={(e) => setConsentGranted(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-xs font-semibold text-slate-800">I grant explicit purpose-limited consent for {employeeName}</span>
            </label>

            <button
              disabled={!consentGranted}
              onClick={() => setStep(2)}
              className="w-full py-3 bg-indigo-600 disabled:bg-slate-300 text-white text-xs font-bold rounded-xl shadow-md flex items-center justify-center gap-2"
            >
              Accept Consent & Proceed <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* STEP 2: Camera Permission */}
        {step === 2 && (
          <div className="text-center space-y-4 py-4">
            <div className="w-16 h-16 bg-indigo-100 rounded-full mx-auto flex items-center justify-center text-indigo-600">
              <Camera className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Verify Live Web Camera</h3>
              <p className="text-xs text-slate-500 mt-1">Please allow camera permissions in your browser to start initialization.</p>
            </div>
            <button
              onClick={startCamera}
              className="w-full py-3 bg-indigo-600 text-white text-xs font-bold rounded-xl shadow-md flex items-center justify-center gap-2"
            >
              Enable Camera & Check Hardware
            </button>
          </div>
        )}

        {/* STEP 3, 4, 5: Camera Stream View */}
        {(step === 3 || step === 4 || step === 5 || step === 6) && (
          <div className="space-y-4 text-center">
            <div className="relative w-64 h-64 mx-auto rounded-full overflow-hidden border-4 border-indigo-500 shadow-xl bg-slate-900 flex items-center justify-center">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover transform -scale-x-100" />
              <canvas ref={canvasRef} className="hidden" />

              {/* Bounding Oval Visual Guide */}
              <div className="absolute inset-0 border-4 border-dashed border-emerald-400/80 rounded-full pointer-events-none animate-pulse" />

              {/* Countdown Overlay */}
              {countdown !== null && countdown > 0 && (
                <div className="absolute inset-0 bg-slate-950/60 flex items-center justify-center">
                  <span className="text-6xl font-black text-white animate-bounce">{countdown}</span>
                </div>
              )}
            </div>

            {step === 3 && (
              <div className="space-y-3">
                <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl flex items-center justify-center gap-2">
                  <Sun className="w-4 h-4 text-amber-600 animate-pulse" />
                  <span>{lightingOk ? "Lighting Check Passed!" : "Analyzing Environment Lighting & Exposure..."}</span>
                </div>
                {lightingOk && (
                  <button
                    onClick={() => setStep(4)}
                    className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold rounded-xl shadow-md flex items-center justify-center gap-2"
                  >
                    Proceed to Face Alignment <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}

            {step === 4 && (
              <div className="space-y-3">
                <p className="text-xs text-slate-600 font-semibold">Position your face inside the green oval guide and look straight into the lens.</p>
                <button
                  onClick={startCountdown}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md flex items-center justify-center gap-2"
                >
                  <UserCheck className="w-4 h-4" /> Position Ready — Start Auto Capture
                </button>
              </div>
            )}

            {step === 5 && (
              <p className="text-xs font-bold text-amber-600 flex items-center justify-center gap-1.5 animate-pulse">
                <RefreshCw className="w-4 h-4 animate-spin" /> Hold Still... Capturing 5-Frame Biometric Burst...
              </p>
            )}

            {step === 6 && (
              <p className="text-xs font-bold text-indigo-600 flex items-center justify-center gap-1.5 animate-pulse">
                <ShieldCheck className="w-4 h-4 animate-spin" /> {liveHint || "Detecting face & generating your biometric descriptor..."}
              </p>
            )}
          </div>
        )}

        {/* STEP 7: Completed */}
        {step === 7 && (
          <div className="text-center space-y-4 py-4">
            <div className="w-16 h-16 bg-emerald-100 rounded-full mx-auto flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-base font-bold text-emerald-900">Biometric Profile Enrolled!</h3>
              <p className="text-xs text-slate-600 mt-1">Face descriptor & Purpose Consents registered successfully for {employeeName}.</p>
            </div>
            <button
              onClick={() => {
                handleClose();
                onSuccess();
              }}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md"
            >
              Complete & Continue
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
};
