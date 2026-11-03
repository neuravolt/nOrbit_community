"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../src/lib/api";
import { useAuthStore } from "@/src/store/auth";
import {
  Briefcase, Users, FileText, CheckSquare, Calendar, Loader2, Plus, Mail, Phone, Camera,
  Download, Trash2, CheckCircle2, XCircle, Search, DollarSign, Clock, ShieldCheck,
  Building2, Laptop, UserPlus, Receipt, LifeBuoy, Target, CreditCard, RefreshCw, AlertTriangle, ChevronLeft, ChevronRight, Edit3, UserCheck, MapPin, ExternalLink,
  Lock, Settings2, Layers, ListChecks
} from "lucide-react";

import { BiometricTab } from "./components/BiometricTab";
import { LifecycleTab } from "./components/LifecycleTab";
import { PageShell, PageHeader, Tabs as UiTabs } from "../../src/components/ui/page";
import { identitySDK } from "../sdk/identity-sdk";
import { captureLiveFace, loadFaceModels } from "@/src/lib/face-recognition";

// ─── Web Audio API Audio Chime Engine ─────────────────────────────────────────
function playAttendanceAudio(success: boolean) {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === "suspended") {
      ctx.resume();
    }

    if (success) {
      // Upbeat 3-note ascending success chime (C5 -> E5 -> G5)
      const notes = [523.25, 659.25, 783.99];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.12);
        
        gain.gain.setValueAtTime(0, ctx.currentTime + idx * 0.12);
        gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + idx * 0.12 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.12 + 0.35);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.12);
        osc.stop(ctx.currentTime + idx * 0.12 + 0.35);
      });
    } else {
      // Warning double-buzz (A3 -> F3 low alert)
      const frequencies = [220.00, 174.61];
      frequencies.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.18);
        
        gain.gain.setValueAtTime(0.35, ctx.currentTime + idx * 0.18);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.18 + 0.25);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.18);
        osc.stop(ctx.currentTime + idx * 0.18 + 0.25);
      });
    }
  } catch (e) {
    console.error("Audio chime playback exception:", e);
  }
}

// ─── Google Maps URL Generator ────────────────────────────────────────────────
function getGoogleMapsUrl(gpsString: string | null): string | null {
  if (!gpsString) return null;
  const numbers = gpsString.match(/(-?\d+\.\d+)/g);
  if (numbers && numbers.length >= 2) {
    let lat = parseFloat(numbers[0]);
    let lng = parseFloat(numbers[1]);
    if (gpsString.includes("S")) lat = -Math.abs(lat);
    if (gpsString.includes("W")) lng = -Math.abs(lng);
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }
  return null;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const CURRENT_YEAR = new Date().getFullYear();
const PAGE_SIZE = 12;

const formatFmtDate = (d: any) => d ? new Date(d).toLocaleDateString("en-IN") : "—";
const fmtCurrency = (n: any) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

function useDebounce(value: string, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

const showError = (err: any) => {
  const msg = err?.response?.data?.message || err?.message || "Something went wrong";
  alert(`❌ Error: ${Array.isArray(msg) ? msg.join(", ") : msg}`);
};

type Tab =
  | "overview"
  | "directory"
  | "documents"
  | "attendance"
  | "leaves"
  | "organization"
  | "assets"
  | "recruitment"
  | "expenses"
  | "helpdesk"
  | "performance"
  | "payroll"
  | "lifecycle";

// ─── Attendance Notes Parser ──────────────────────────────────────────────────
export function parseNotesData(rawNotes: string | null) {
  if (!rawNotes) return { text: "—", livePhoto: null, refPhoto: null, ipAddress: null, gps: null, mode: "Manual HR Log" };
  const cleanNotes = rawNotes.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '');
  const parts = cleanNotes.split("|||");
  let text = (parts[0] || "—").trim();
  let livePhoto: string | null = null;
  let refPhoto: string | null = null;
  let ipAddress: string | null = null;
  let gps: string | null = null;
  let mode = "AI Live Selfie";

  parts.forEach(p => {
    if (p.startsWith("LIVE:")) livePhoto = p.substring(5);
    if (p.startsWith("REF:")) refPhoto = p.substring(4);
    if (p.startsWith("IP:")) ipAddress = p.substring(3);
    if (p.startsWith("GPS:")) gps = p.substring(4);
    if (p.startsWith("MODE:")) mode = p.substring(5);
  });

  if (livePhoto && mode === "Manual HR Log") mode = "AI Live Selfie";
  else if (text.toLowerCase().includes("biometric") || text.toLowerCase().includes("device")) mode = "Biometric Hardware Sync";

  return { text, livePhoto, refPhoto, ipAddress, gps, mode };
}

// ─── Modal Component ─────────────────────────────────────────────────────────
function Modal({ open, onClose, title, children, size }: any) {
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleEsc);
    return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", handleEsc); };
  }, [open, onClose]);
  if (!open) return null;
  const maxW = size === "xl" ? "max-w-5xl" : size === "lg" ? "max-w-3xl" : "max-w-lg";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose} role="dialog" aria-modal="true">
      <div className={`bg-white rounded-2xl shadow-2xl w-full ${maxW} max-h-[90vh] overflow-y-auto`} onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white z-10 rounded-t-2xl">
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl" aria-label="Close">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function FormRow({ label, children, required }: any) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white";

export default function HrDashboardPage() {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const qc = useQueryClient();
  const { user } = useAuthStore();

  const ADMIN_ROLES = ["SUPER_ADMIN", "MANAGER", "CO_FOUNDER", "ADMIN"];
  const isAdmin = user?.role ? ADMIN_ROLES.includes(user.role) : false;

  // URL Tab switching support
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab") as Tab | null;
    if (tab) setActiveTab(tab);
  }, []);

  // Non-Admin Employees get dedicated Employee Self Service (ESS) View
  if (user && !isAdmin) {
    return <EmployeePortalView user={user} />;
  }

  const HR_TABS: { key: Tab; label: string; icon: any }[] = [
    { key: "overview", label: "Overview", icon: Briefcase },
    { key: "directory", label: "Employees", icon: Users },
    { key: "lifecycle", label: "Joiners & leavers", icon: ListChecks },
    { key: "attendance", label: "Attendance", icon: CheckSquare },
    { key: "leaves", label: "Leaves", icon: Calendar },
    { key: "payroll", label: "Payroll", icon: CreditCard },
    { key: "documents", label: "Documents", icon: FileText },
    { key: "organization", label: "Organization", icon: Building2 },
    { key: "assets", label: "Assets", icon: Laptop },
    { key: "recruitment", label: "Recruitment", icon: UserPlus },
    { key: "expenses", label: "Expenses", icon: Receipt },
    { key: "helpdesk", label: "Helpdesk", icon: LifeBuoy },
    { key: "performance", label: "Performance", icon: Target },
  ];

  return (
    <PageShell>
      <PageHeader icon={Briefcase} title="People" subtitle="Employees, attendance, leave, payroll and everything from joining to exit." />
      <UiTabs tabs={HR_TABS} value={activeTab} onChange={(k) => setActiveTab(k)} />

      {/* Content renders depending on selected tab */}
      <div>
        {activeTab === "overview" && <OverviewTab />}
        {activeTab === "directory" && <DirectoryTab />}
        {activeTab === "lifecycle" && <LifecycleTab />}
        {activeTab === "organization" && <OrganizationTab />}
        {activeTab === "assets" && <OfficeAssetsTab />}
        {activeTab === "recruitment" && <RecruitmentTab />}
        {activeTab === "expenses" && <ExpensesTab />}
        {activeTab === "helpdesk" && <HelpdeskTab />}
        {activeTab === "performance" && <PerformanceTab />}
        {activeTab === "payroll" && <PayrollTab />}
        {activeTab === "documents" && <DocumentsTab />}
        {activeTab === "attendance" && <AttendanceTab />}
        {activeTab === "leaves" && <LeavesTab />}
      </div>
    </PageShell>
  );
}

function EmployeePortalView({ user }: { user: any }) {
  const qc = useQueryClient();
  const [essTab, setEssTab] = useState<"profile" | "biometric" | "attendance" | "leaves" | "documents" | "assets">("profile");
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [leaveForm, setLeaveForm] = useState<{
    leaveType: string;
    startDate: string;
    endDate: string;
    durationType: string;
    halfDaySlot: string;
    hoursRequested: number;
    reason: string;
  }>({
    leaveType: "CASUAL",
    startDate: "",
    endDate: "",
    durationType: "FULL_DAY",
    halfDaySlot: "FIRST_HALF",
    hoursRequested: 2,
    reason: "",
  });

  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({
    middleName: "", gender: "Male", dateOfBirth: "", bloodGroup: "", maritalStatus: "Single",
    personalEmail: "", mobileNumber: "", emergencyContactName: "", emergencyContactNumber: "", relationship: "",
    address_current: "", address_permanent: "", address_city: "", address_state: "", address_country: "", address_pin: "",
    governmentIds_aadhaar: "", governmentIds_pan: "",
    bank_holderName: "", bank_bankName: "", bank_accountNumber: "", bank_ifscCode: "", bank_branchName: "",
  });

  // Live Camera Attendance Punch State
  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  const [cameraMode, setCameraMode] = useState<"IN" | "OUT">("IN");
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [liveGpsDisplay, setLiveGpsDisplay] = useState<string>("Getting your location...");
  const [liveHint, setLiveHint] = useState<string | null>(null);
  const [verificationResult, setVerificationResult] = useState<{ open: boolean; success: boolean; matchScore: string; note: string } | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const startCamera = async (mode: "IN" | "OUT") => {
    setCameraMode(mode);
    setCameraModalOpen(true);
    setLiveGpsDisplay("Detecting Live Geofence Location...");
    loadFaceModels().catch(() => {}); // warm the face-api.js models while the camera is starting

    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLiveGpsDisplay(`Your location: ${pos.coords.latitude.toFixed(4)}° N, ${pos.coords.longitude.toFixed(4)}° E (±${Math.round(pos.coords.accuracy)} m)`);
        },
        () => {
          setLiveGpsDisplay("Location not shared: if your office uses a geofence, this punch goes to HR for review");
        },
        { timeout: 4000 }
      );
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 400, height: 400, facingMode: "user" } });
      setCameraStream(stream);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 300);
    } catch (err: any) {
      alert("❌ Unable to access live camera. Please allow camera permissions in your browser.");
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setCameraModalOpen(false);
  };

  const [isVerifying, setIsVerifying] = useState(false);

  // Real face-api.js descriptor extraction + server-side match decision --
  // replaces the previous client-side raw-pixel/luminance comparison, which
  // had no actual face model behind it and drifted with lighting/angle/camera
  // changes. The server never trusts a client-reported "matched" boolean;
  // it recomputes the distance itself against the stored reference descriptor.
  const captureSelfieAndLog = async () => {
    if (!videoRef.current || !canvasRef.current || isVerifying) return;
    setIsVerifying(true);

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      let capturedDataUrl = "";

      if (ctx) {
        // Crop inner 70% center face region for a clean audit-review photo
        const vw = video.videoWidth || 640;
        const vh = video.videoHeight || 640;
        canvas.width = 480;
        canvas.height = 480;
        ctx.drawImage(video, vw * 0.15, vh * 0.10, vw * 0.70, vh * 0.75, 0, 0, 480, 480);
        capturedDataUrl = canvas.toDataURL("image/jpeg", 0.90);
      }

      // Run real face detection + descriptor extraction on the full, uncropped
      // video frame -- face-api.js does its own localization, so a pre-crop can
      // only hurt it by cutting off part of the face.
      // Liveness: the server asks for a head turn, so a photo or video of someone else does not pass.
      const challenge = await identitySDK.challenge();
      const extraction = await captureLiveFace(video, challenge, setLiveHint);
      setLiveHint(null);
      if (!extraction) {
        playAttendanceAudio(false);
        alert("Follow the instruction on screen: look straight at the camera, then slowly turn your head the way it asks. Use good lighting.");
        setIsVerifying(false);
        return;
      }

      const now = new Date();
      let isMatched = true;
      let matchScore = "100.0";
      let verificationNote = "";

      const verifyResult = await identitySDK.verify({
        purpose: "ATTENDANCE",
        employeeId: user.id,
        descriptor: extraction.descriptor,
        capturedPhotoUrl: capturedDataUrl,
        liveness: extraction.liveness,
      });

      if (verifyResult.reEnrollmentRequired) {
        // First-ever punch for this employee -- enroll now using this capture
        // as the reference. No mismatch is possible on enrollment itself.
        await identitySDK.enroll(extraction.descriptor, capturedDataUrl, true, extraction.liveness);
        if (typeof window !== "undefined") {
          localStorage.setItem(`face_baseline_${user.id}`, capturedDataUrl);
        }
        verificationNote = `Biometric Profile Enrolled (${now.toLocaleTimeString()})`;
        isMatched = true;
        matchScore = "100.0";
      } else {
        isMatched = verifyResult.verified;
        matchScore = (verifyResult.matchScore ?? 0).toFixed(1);
        verificationNote = isMatched
          ? `AI Face Verified (${matchScore}% Match with Reference Profile)`
          : `PROXY ALERT: Face Mismatch (${matchScore}% Match - Flagged for HR Audit)`;
      }

      // Capture browser client geolocation if available
      let liveGps = "";
      let coords: { latitude: number; longitude: number; accuracyMeters: number } | null = null;
      if (typeof navigator !== "undefined" && navigator.geolocation) {
        try {
          const pos: any = await new Promise((resolve) => {
            navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), { timeout: 3000 });
          });
          if (pos && pos.coords) {
            coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracyMeters: Math.round(pos.coords.accuracy || 0) };
            liveGps = `${pos.coords.latitude.toFixed(4)}° N, ${pos.coords.longitude.toFixed(4)}° E (browser location)`;
          }
        } catch (e) {}
      }
      if (!liveGps) {
        liveGps = "Location not shared";
      }

      const refPhoto = (typeof window !== "undefined" ? localStorage.getItem(`face_baseline_${user.id}`) : null) || profileData?.avatarUrl || user?.avatarUrl || "";
      const fullNotes = `${verificationNote} [${cameraMode === "IN" ? "Clock-In" : "Clock-Out"}]${capturedDataUrl ? `|||LIVE:${capturedDataUrl}` : ""}${refPhoto ? `|||REF:${refPhoto}` : ""}|||GPS:${liveGps}|||MODE:AI Live Selfie`;

      logAttendanceMutation.mutate({
        employeeId: user.id,
        date: now.toISOString(),
        status: "PRESENT",
        clockIn: cameraMode === "IN" ? now.toISOString() : undefined,
        clockOut: cameraMode === "OUT" ? now.toISOString() : undefined,
        notes: fullNotes,
        // The server checks these against the office geofence and writes the verdict itself.
        ...(coords ? coords : {}),
      }, {
        onSuccess: () => {
          stopCamera();
          playAttendanceAudio(isMatched);
          qc.invalidateQueries({ queryKey: ["hr-my-attendance"] });
          qc.invalidateQueries({ queryKey: ["hr-attendance"] });
          qc.invalidateQueries({ queryKey: ["hr-me"] });
          setVerificationResult({
            open: true,
            success: isMatched,
            matchScore,
            note: verificationNote,
          });
        },
        onSettled: () => setIsVerifying(false),
      });
    } catch (err: any) {
      setIsVerifying(false);
      playAttendanceAudio(false);
      showError(err);
    }
  };

  const logAttendanceMutation = useMutation({
    mutationFn: (payload: any) => api.post("/hr/attendance/log", payload),
    onError: showError,
  });

  const { data: profileData } = useQuery({
    queryKey: ["hr-me", user?.id],
    queryFn: async () => { const { data } = await api.get("/hr/me"); return data; },
  });

  const { data: myLeaves, isLoading: leavesLoading } = useQuery({
    queryKey: ["hr-my-leaves", user?.id],
    queryFn: async () => { const { data } = await api.get("/hr/leaves"); return data; },
  });

  const { data: myAttendance, isLoading: attendanceLoading } = useQuery({
    queryKey: ["hr-my-attendance", user?.id],
    queryFn: async () => { const { data } = await api.get("/hr/attendance"); return data; },
  });

  const { data: myDocs } = useQuery({
    queryKey: ["hr-my-documents", user?.id],
    queryFn: async () => { const { data } = await api.get("/hr/documents"); return data; },
  });

  const { data: myAssets } = useQuery({
    queryKey: ["hr-my-assets", user?.id],
    queryFn: async () => { const { data } = await api.get("/hr/my-assets"); return data; },
  });

  const { data: myBalances } = useQuery({
    queryKey: ["hr-my-balances", user?.id],
    queryFn: async () => { const { data } = await api.get("/hr/leave-balances"); return data; },
  });

  const { data: myHolidays } = useQuery({
    queryKey: ["hr-my-holidays"],
    queryFn: async () => { const { data } = await api.get("/hr/holidays"); return data; },
  });

  const createLeaveMutation = useMutation({
    mutationFn: (payload: any) => api.post("/hr/leaves", { ...payload, employeeId: user.id }),
    onSuccess: () => {
      setLeaveModalOpen(false);
      setLeaveForm({ leaveType: "CASUAL", startDate: "", endDate: "", durationType: "FULL_DAY", halfDaySlot: "FIRST_HALF", hoursRequested: 2, reason: "" });
      qc.invalidateQueries({ queryKey: ["hr-my-leaves"] });
      alert("✅ Leave request submitted successfully!");
    },
    onError: showError,
  });

  const openProfileEdit = () => {
    const p = profileData?.employeeProfile || {};
    const address = p.addressJson ? JSON.parse(p.addressJson) : {};
    setProfileForm({
      middleName: p.middleName || "",
      gender: p.gender || "Male",
      dateOfBirth: p.dateOfBirth ? new Date(p.dateOfBirth).toISOString().split("T")[0] : "",
      bloodGroup: p.bloodGroup || "",
      maritalStatus: p.maritalStatus || "Single",
      personalEmail: p.personalEmail || "",
      mobileNumber: p.mobileNumber || "",
      emergencyContactName: p.emergencyContactName || "",
      emergencyContactNumber: p.emergencyContactNumber || "",
      relationship: p.relationship || "",
      address_current: address.current || "",
      address_permanent: address.permanent || "",
      address_city: address.city || "",
      address_state: address.state || "",
      address_country: address.country || "",
      address_pin: address.pin || "",
      governmentIds_aadhaar: p.aadhaarNumber || "",
      governmentIds_pan: p.panNumber || "",
      bank_holderName: p.bankHolderName || "",
      bank_bankName: p.bankName || "",
      bank_accountNumber: p.bankAccountNumber || "",
      bank_ifscCode: p.bankIfscCode || "",
      bank_branchName: p.bankBranchName || "",
    });
    setProfileModalOpen(true);
  };

  const updateProfileMutation = useMutation({
    mutationFn: (payload: any) => api.patch("/hr/my-profile", {
      ...payload,
      bankHolderName: payload.bank_holderName,
      bankName: payload.bank_bankName,
      bankAccountNumber: payload.bank_accountNumber,
      bankIfscCode: payload.bank_ifscCode,
      bankBranchName: payload.bank_branchName,
      aadhaarNumber: payload.governmentIds_aadhaar,
      panNumber: payload.governmentIds_pan,
      addressJson: JSON.stringify({
        current: payload.address_current,
        permanent: payload.address_permanent,
        city: payload.address_city,
        state: payload.address_state,
        country: payload.address_country,
        pin: payload.address_pin,
      }),
    }),
    onSuccess: () => {
      setProfileModalOpen(false);
      qc.invalidateQueries({ queryKey: ["hr-me"] });
      alert("✅ Your employee profile details have been saved successfully!");
    },
    onError: showError,
  });

  const prof = profileData?.employeeProfile || {};
  const empId = prof.costCenter || `EMP${user?.id?.slice(0, 4).toUpperCase()}`;

  let parsedBank: any = {};
  let parsedGov: any = {};
  try { if (prof.bankDetailsJson) parsedBank = JSON.parse(prof.bankDetailsJson); } catch (_) {}
  try { if (prof.governmentIdsJson) parsedGov = JSON.parse(prof.governmentIdsJson); } catch (_) {}

  const mobileDisplay = prof.mobileNumber || parsedBank.mobileNumber || "—";
  const personalEmailDisplay = prof.personalEmail || "—";
  const bankNameDisplay = prof.bankName || parsedBank.bankName || "—";
  const bankAccountDisplay = prof.bankAccountNumber || parsedBank.accountNumber || "—";
  const departmentDisplay = prof.department?.name || (prof.costCenter?.startsWith("NVM") ? "Management & Dev." : prof.costCenter?.startsWith("NVA") ? "Technology & Innovation" : "Technology");
  const designationDisplay = prof.designation?.name || (prof.grade ? prof.grade : "Software Engineer");

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header Banner - Clean Light Theme */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 text-slate-900 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          {profileData?.avatarUrl || user?.avatarUrl ? (
            <img src={profileData?.avatarUrl || user?.avatarUrl} alt="Avatar" className="w-16 h-16 rounded-full object-cover border-2 border-indigo-500/20 shadow-sm shrink-0" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-indigo-600 flex items-center justify-center text-2xl font-bold uppercase shadow-inner text-white border-2 border-white shrink-0">
              {user.firstName?.[0]}{user.lastName?.[0]}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900">{user.firstName} {user.lastName}</h1>
              <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-indigo-600 text-white tracking-wider">
                {prof.grade || user.role}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-3 flex-wrap font-medium">
              <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5 text-indigo-600" /> ID: <strong className="text-slate-900">{empId}</strong></span>
              <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5 text-slate-400" /> {departmentDisplay}</span>
              <span className="flex items-center gap-1"><Briefcase className="w-3.5 h-3.5 text-slate-400" /> {designationDisplay}</span>
              <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5 text-slate-400" /> {user.email}</span>
            </p>
          </div>
        </div>

        <div className="flex gap-2 shrink-0 flex-wrap">
          <button onClick={openProfileEdit} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl shadow-sm transition-all border border-slate-200 flex items-center gap-1.5">
            <Edit3 className="w-3.5 h-3.5 text-indigo-600" /> Complete / Edit My Details
          </button>
          <button onClick={() => setLeaveModalOpen(true)} className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Apply Leave
          </button>
        </div>
      </div>

      {/* ESS Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {[
          { id: "profile", label: "My Profile & Details", icon: Users },
          { id: "biometric", label: "Biometric Identity & Consents", icon: ShieldCheck },
          { id: "attendance", label: "My Attendance Logs", icon: CheckSquare },
          { id: "leaves", label: "My Leave Requests", icon: Calendar },
          { id: "documents", label: "My Payslips & HR Docs", icon: FileText },
          { id: "assets", label: "My Assigned IT Assets", icon: Laptop },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setEssTab(t.id as any)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              essTab === t.id
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900"
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Contents */}
      {essTab === "profile" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-900 text-sm border-b pb-2 flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-indigo-600" /> Employment & Work Details
            </h3>
            <div className="space-y-2.5 text-xs text-slate-600">
              <div className="flex justify-between py-1 border-b border-slate-50"><span className="text-slate-400">Employee ID / Barcode</span><span className="font-bold text-slate-800">{empId}</span></div>
              <div className="flex justify-between py-1 border-b border-slate-50"><span className="text-slate-400">Official Email</span><span className="font-bold text-slate-800">{user.email}</span></div>
              <div className="flex justify-between py-1 border-b border-slate-50"><span className="text-slate-400">Department</span><span className="font-bold text-slate-800">{departmentDisplay}</span></div>
              <div className="flex justify-between py-1 border-b border-slate-50"><span className="text-slate-400">Designation</span><span className="font-bold text-slate-800">{designationDisplay}</span></div>
              <div className="flex justify-between py-1 border-b border-slate-50"><span className="text-slate-400">Reporting Manager</span><span className="font-bold text-slate-800">{prof.reportingManager || "—"}</span></div>
              <div className="flex justify-between py-1 border-b border-slate-50"><span className="text-slate-400">Joining Date</span><span className="font-bold text-slate-800">{formatFmtDate(prof.joiningDate)}</span></div>
              <div className="flex justify-between py-1"><span className="text-slate-400">Work Status</span><span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">{prof.status || "ACTIVE"}</span></div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-900 text-sm border-b pb-2 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-indigo-600" /> Personal & Bank Info
            </h3>
            <div className="space-y-2.5 text-xs text-slate-600">
              <div className="flex justify-between py-1 border-b border-slate-50"><span className="text-slate-400">Mobile Number</span><span className="font-bold text-slate-800">{mobileDisplay}</span></div>
              <div className="flex justify-between py-1 border-b border-slate-50"><span className="text-slate-400">Personal Email</span><span className="font-bold text-slate-800">{personalEmailDisplay}</span></div>
              <div className="flex justify-between py-1 border-b border-slate-50"><span className="text-slate-400">Gender / DOB</span><span className="font-bold text-slate-800">{prof.gender || "—"} | {formatFmtDate(prof.dateOfBirth)}</span></div>
              <div className="flex justify-between py-1 border-b border-slate-50"><span className="text-slate-400">Bank Name</span><span className="font-bold text-slate-800">{bankNameDisplay}</span></div>
              <div className="flex justify-between py-1 border-b border-slate-50"><span className="text-slate-400">Account Number</span><span className="font-bold text-slate-800">{bankAccountDisplay}</span></div>
            </div>
          </div>
        </div>
      )}

      {essTab === "biometric" && <BiometricTab user={user} />}

      {essTab === "attendance" && (() => {
        const isSameDay = (d1: any, d2: any) => {
          if (!d1 || !d2) return false;
          const a = new Date(d1);
          const b = new Date(d2);
          return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
        };

        const todayRecord = (myAttendance || []).find((att: any) => isSameDay(att.date, new Date()));
        const isPunchedIn = !!todayRecord?.clockIn;
        const isPunchedOut = !!todayRecord?.clockOut;

        return (
          <div className="space-y-6">
            {/* Live Camera Punch Station Card - Clean Light Theme */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 text-slate-900 shadow-sm flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="space-y-1 text-center md:text-left">
                <div className="flex items-center gap-2 justify-center md:justify-start">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                  <span className="text-xs font-extrabold uppercase text-emerald-700 tracking-wider flex items-center gap-1.5"><Camera className="w-3.5 h-3.5" /> Live Camera Attendance Station</span>
                </div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">{new Date().toLocaleDateString("en-US", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h2>
                <p className="text-xs text-slate-500">AI Face Verification & Biometric Match Enabled</p>
              </div>

              <div className="flex items-center gap-3">
                {!isPunchedIn ? (
                  <button
                    onClick={() => startCamera("IN")}
                    className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-2 border border-indigo-400 transform hover:scale-105"
                  >
                    <Camera className="w-4 h-4" /> Punch In with Camera Selfie
                  </button>
                ) : !isPunchedOut ? (
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">PUNCHED IN AT</span>
                      <p className="text-xs font-bold text-slate-900 mt-0.5">{new Date(todayRecord.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    <button
                      onClick={() => startCamera("OUT")}
                      className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-2"
                    >
                      <Camera className="w-4 h-4" /> Punch Out with Camera Selfie
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-end gap-2">
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2 text-center">
                      <span className="text-xs font-bold text-emerald-700 flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> SHIFT PUNCH COMPLETED TODAY</span>
                      <p className="text-[10px] text-slate-600 mt-0.5">In: {new Date(todayRecord.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} | Out: {new Date(todayRecord.clockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    <button
                      onClick={() => startCamera("OUT")}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-1.5"
                    >
                      <Camera className="w-4 h-4" /> Test Punch Out / Brother Face Match
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <h3 className="font-bold text-slate-900 text-sm mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-600" /> Monthly Attendance Logs
              </h3>
              {attendanceLoading ? (
                <div className="py-8 text-center text-slate-400"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-1" /> Loading attendance...</div>
              ) : (myAttendance || []).length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">No attendance records logged for this month</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 text-slate-500 uppercase font-semibold">
                      <tr>
                        <th className="p-3 text-left">Date</th>
                        <th className="p-3 text-left">Shift</th>
                        <th className="p-3 text-left">Status</th>
                        <th className="p-3 text-left">Clock In</th>
                        <th className="p-3 text-left">Clock Out</th>
                        <th className="p-3 text-left">Verification Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {(myAttendance || []).map((att: any) => (
                        <tr key={att.id}>
                          <td className="p-3 text-slate-900 font-bold">{formatFmtDate(att.date)}</td>
                          <td className="p-3 text-slate-600">General Shift</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-full font-bold uppercase text-[10px] ${att.status === "PRESENT" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200"}`}>
                              {att.status}
                            </span>
                          </td>
                          <td className="p-3 text-slate-700 font-bold">{att.clockIn ? new Date(att.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "—"}</td>
                          <td className="p-3 text-slate-700 font-bold">{att.clockOut ? new Date(att.clockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "—"}</td>
                          <td className="p-3 text-slate-500 text-[11px] flex items-center gap-1.5 overflow-hidden">
                            <Camera className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span className="truncate max-w-sm" title={parseNotesData(att.notes).text}>
                              {parseNotesData(att.notes).text}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {essTab === "leaves" && (
        <div className="space-y-6">
          {/* Live Dynamic Leave Balance Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(myBalances && myBalances.length > 0 ? myBalances : [
              { leaveType: "CASUAL", available: 12, allocated: 12, used: 0 },
              { leaveType: "SICK", available: 10, allocated: 10, used: 0 },
              { leaveType: "EARNED", available: 15, allocated: 15, used: 0 },
            ]).map((b: any, idx: number) => (
              <div key={b.id || idx} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{b.leaveType?.replace(/_/g, ' ')} BALANCE</span>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-slate-100 text-slate-600">CYCLE 2026</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <div className="text-3xl font-black text-indigo-600">{Number(b.available || 0).toFixed(1)}</div>
                  <span className="text-xs text-slate-400 font-medium">/ {Number(b.allocated || 0).toFixed(0)} Days Left</span>
                </div>
                <div className="flex justify-between text-[11px] text-slate-500 border-t border-slate-100 pt-2">
                  <span>Used: <strong className="text-slate-800">{Number(b.used || 0).toFixed(1)}</strong></span>
                  <span>Pending: <strong className="text-amber-600">{Number(b.pending || 0).toFixed(1)}</strong></span>
                </div>
              </div>
            ))}
          </div>

          {/* Corporate Holidays Section */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 border-b pb-3">
              <Calendar className="w-4 h-4 text-indigo-600" /> Company Holiday List (2026)
            </h3>
            {(myHolidays || []).length === 0 ? (
              <div className="text-xs text-slate-400 py-2">No company holidays published for this year yet. Weekly Offs: <strong>Saturday & Sunday</strong></div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {(myHolidays || []).map((h: any) => (
                  <div key={h.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex justify-between items-center">
                    <div>
                      <p className="text-xs font-bold text-slate-900">{h.name}</p>
                      <p className="text-[10px] text-slate-500">{new Date(h.date).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })}</p>
                    </div>
                    <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">{h.type || 'HOLIDAY'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-600" /> My Leave Applications
              </h3>
              <button onClick={() => setLeaveModalOpen(true)} className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" /> Apply Leave
              </button>
            </div>

            {leavesLoading ? (
              <div className="py-8 text-center text-slate-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /> Loading leaves...</div>
            ) : (myLeaves || []).length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">No leave requests submitted yet</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase font-semibold">
                    <tr>
                      <th className="p-3 text-left">Type</th>
                      <th className="p-3 text-left">Start Date</th>
                      <th className="p-3 text-left">End Date</th>
                      <th className="p-3 text-left">Reason</th>
                      <th className="p-3 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(myLeaves || []).map((l: any) => (
                      <tr key={l.id}>
                        <td className="p-3 font-bold text-slate-800">{l.leaveType}</td>
                        <td className="p-3 text-slate-600">{formatFmtDate(l.startDate)}</td>
                        <td className="p-3 text-slate-600">{formatFmtDate(l.endDate)}</td>
                        <td className="p-3 text-slate-600 max-w-xs truncate">{l.reason}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-full font-bold uppercase text-[10px] ${
                            l.status === "APPROVED" ? "bg-green-50 text-green-700 border border-green-200" :
                            l.status === "REJECTED" ? "bg-red-50 text-red-700 border border-red-200" :
                            "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}>
                            {l.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {essTab === "documents" && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-900 text-sm border-b pb-3 flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-600" /> My Salary Slips & Official HR Documents
          </h3>
          {(myDocs || []).length === 0 ? (
            <div className="py-10 text-center text-slate-400 text-xs">No payslips or generated HR documents available yet</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {(myDocs || []).map((d: any) => (
                <div key={d.id} className="flex justify-between items-center py-3">
                  <div>
                    <p className="text-xs font-bold text-slate-900">{d.title || d.documentType}</p>
                    <p className="text-[10px] text-slate-400">Issued on {formatFmtDate(d.createdAt)}</p>
                  </div>
                  {d.fileUrl && (
                    <a href={d.fileUrl} target="_blank" rel="noreferrer" className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1">
                      <Download className="w-3.5 h-3.5 text-indigo-600" /> Download PDF
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {essTab === "assets" && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-900 text-sm border-b pb-3 flex items-center gap-2">
            <Laptop className="w-4 h-4 text-indigo-600" /> Assigned IT Hardware Assets
          </h3>
          {(myAssets || []).length === 0 ? (
            <div className="py-10 text-center text-slate-400 text-xs">No physical IT assets currently assigned to your account</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(myAssets || []).map((a: any) => (
                <div key={a.id} className="p-4 border border-slate-200 rounded-xl bg-slate-50 flex justify-between items-center">
                  <div>
                    <p className="text-xs font-bold text-slate-900">{a.assetName}</p>
                    <p className="text-[10px] text-slate-500">Serial: {a.serialNumber || "—"} | Tag: {a.assetTag || "—"}</p>
                  </div>
                  <span className="text-[10px] font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200">ASSIGNED</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Apply Leave Modal */}
      <Modal open={leaveModalOpen} onClose={() => setLeaveModalOpen(false)} title="Apply for Leave Request">
        <form onSubmit={e => { e.preventDefault(); createLeaveMutation.mutate(leaveForm); }} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <FormRow label="Leave Type" required>
              <select className={inputCls} value={leaveForm.leaveType} onChange={e => setLeaveForm({ ...leaveForm, leaveType: e.target.value })} required>
                <option value="CASUAL">Casual Leave (CL)</option>
                <option value="SICK">Sick Leave (SL)</option>
                <option value="EARNED">Earned Leave (EL)</option>
                <option value="UNPAID">Unpaid Leave (LWP)</option>
                <option value="EMERGENCY">Emergency Leave</option>
                <option value="MATERNITY">Maternity Leave</option>
                <option value="PATERNITY">Paternity Leave</option>
                <option value="BEREAVEMENT">Bereavement Leave</option>
                <option value="COMPENSATORY_OFF">Compensatory Off</option>
                <option value="OPTIONAL_HOLIDAY">Optional Holiday</option>
              </select>
            </FormRow>
            <FormRow label="Duration Type" required>
              <select className={inputCls} value={(leaveForm as any).durationType || "FULL_DAY"} onChange={e => setLeaveForm({ ...leaveForm, [e.target.name]: e.target.value, durationType: e.target.value as any })} required>
                <option value="FULL_DAY">Full Day</option>
                <option value="HALF_DAY">Half Day (0.5)</option>
                <option value="HOURLY">Hourly Permission</option>
              </select>
            </FormRow>
          </div>

          {(leaveForm as any).durationType === "HALF_DAY" && (
            <FormRow label="Half Day Slot">
              <select className={inputCls} value={(leaveForm as any).halfDaySlot || "FIRST_HALF"} onChange={e => setLeaveForm({ ...leaveForm, halfDaySlot: e.target.value as any })}>
                <option value="FIRST_HALF">First Half (Morning Shift)</option>
                <option value="SECOND_HALF">Second Half (Afternoon Shift)</option>
              </select>
            </FormRow>
          )}

          {(leaveForm as any).durationType === "HOURLY" && (
            <FormRow label="Hours Requested">
              <input type="number" step="0.5" min="0.5" max="6" className={inputCls} value={(leaveForm as any).hoursRequested || 2} onChange={e => setLeaveForm({ ...leaveForm, hoursRequested: Number(e.target.value) })} required />
            </FormRow>
          )}

          <div className="grid grid-cols-2 gap-3">
            <FormRow label="Start Date" required>
              <input type="date" className={inputCls} value={leaveForm.startDate} onChange={e => setLeaveForm({ ...leaveForm, startDate: e.target.value })} required />
            </FormRow>
            <FormRow label="End Date" required>
              <input type="date" className={inputCls} value={leaveForm.endDate} onChange={e => setLeaveForm({ ...leaveForm, endDate: e.target.value })} required />
            </FormRow>
          </div>
          <FormRow label="Reason for Leave" required>
            <textarea className={inputCls} rows={3} value={leaveForm.reason} onChange={e => setLeaveForm({ ...leaveForm, reason: e.target.value })} placeholder="State reason clearly..." required />
          </FormRow>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setLeaveModalOpen(false)} className="px-4 py-2 border rounded-lg text-xs font-semibold">Cancel</button>
            <button type="submit" disabled={createLeaveMutation.isPending} className="px-5 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg">
              {createLeaveMutation.isPending ? "Submitting..." : "Submit Leave Application"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Complete / Edit My Profile Modal */}
      <Modal open={profileModalOpen} onClose={() => setProfileModalOpen(false)} title="Complete / Edit My Employee Details" size="lg">
        <form onSubmit={e => { e.preventDefault(); updateProfileMutation.mutate(profileForm); }} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Section 1: Personal Details */}
          <div className="space-y-3">
            <div className="text-xs font-bold text-indigo-600 uppercase tracking-wider border-b pb-1.5">1. Personal & Contact Details</div>
            <div className="grid grid-cols-3 gap-3">
              <FormRow label="Middle Name"><input className={inputCls} value={profileForm.middleName} onChange={e => setProfileForm({ ...profileForm, middleName: e.target.value })} /></FormRow>
              <FormRow label="Gender">
                <select className={inputCls} value={profileForm.gender} onChange={e => setProfileForm({ ...profileForm, gender: e.target.value })}>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </FormRow>
              <FormRow label="Date of Birth"><input type="date" className={inputCls} value={profileForm.dateOfBirth} onChange={e => setProfileForm({ ...profileForm, dateOfBirth: e.target.value })} /></FormRow>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <FormRow label="Mobile Number"><input className={inputCls} value={profileForm.mobileNumber} onChange={e => setProfileForm({ ...profileForm, mobileNumber: e.target.value })} placeholder="+91 9876543210" /></FormRow>
              <FormRow label="Personal Email"><input type="email" className={inputCls} value={profileForm.personalEmail} onChange={e => setProfileForm({ ...profileForm, personalEmail: e.target.value })} placeholder="name@gmail.com" /></FormRow>
              <FormRow label="Blood Group"><input className={inputCls} value={profileForm.bloodGroup} onChange={e => setProfileForm({ ...profileForm, bloodGroup: e.target.value })} placeholder="O+ / B+" /></FormRow>
            </div>
          </div>

          {/* Section 2: Emergency Contacts */}
          <div className="space-y-3 pt-2">
            <div className="text-xs font-bold text-indigo-600 uppercase tracking-wider border-b pb-1.5">2. Emergency Contact Person</div>
            <div className="grid grid-cols-3 gap-3">
              <FormRow label="Contact Person Name"><input className={inputCls} value={profileForm.emergencyContactName} onChange={e => setProfileForm({ ...profileForm, emergencyContactName: e.target.value })} placeholder="Father / Mother / Spouse" /></FormRow>
              <FormRow label="Emergency Phone"><input className={inputCls} value={profileForm.emergencyContactNumber} onChange={e => setProfileForm({ ...profileForm, emergencyContactNumber: e.target.value })} placeholder="+91..." /></FormRow>
              <FormRow label="Relationship"><input className={inputCls} value={profileForm.relationship} onChange={e => setProfileForm({ ...profileForm, relationship: e.target.value })} placeholder="Parent / Spouse" /></FormRow>
            </div>
          </div>

          {/* Section 3: Address Details */}
          <div className="space-y-3 pt-2">
            <div className="text-xs font-bold text-indigo-600 uppercase tracking-wider border-b pb-1.5">3. Address Details</div>
            <div className="grid grid-cols-2 gap-3">
              <FormRow label="Current Residential Address"><input className={inputCls} value={profileForm.address_current} onChange={e => setProfileForm({ ...profileForm, address_current: e.target.value })} placeholder="House/Flat No, Street, Landmark" /></FormRow>
              <FormRow label="Permanent Address"><input className={inputCls} value={profileForm.address_permanent} onChange={e => setProfileForm({ ...profileForm, address_permanent: e.target.value })} placeholder="Permanent Address" /></FormRow>
            </div>
            <div className="grid grid-cols-4 gap-3">
              <FormRow label="City"><input className={inputCls} value={profileForm.address_city} onChange={e => setProfileForm({ ...profileForm, address_city: e.target.value })} /></FormRow>
              <FormRow label="State"><input className={inputCls} value={profileForm.address_state} onChange={e => setProfileForm({ ...profileForm, address_state: e.target.value })} /></FormRow>
              <FormRow label="Country"><input className={inputCls} value={profileForm.address_country} onChange={e => setProfileForm({ ...profileForm, address_country: e.target.value })} placeholder="India" /></FormRow>
              <FormRow label="Pincode"><input className={inputCls} value={profileForm.address_pin} onChange={e => setProfileForm({ ...profileForm, address_pin: e.target.value })} placeholder="400001" /></FormRow>
            </div>
          </div>

          {/* Section 4: Government Identity Cards */}
          <div className="space-y-3 pt-2">
            <div className="text-xs font-bold text-indigo-600 uppercase tracking-wider border-b pb-1.5">4. Government Identity Numbers (Confidential)</div>
            <div className="grid grid-cols-2 gap-3">
              <FormRow label="Aadhaar Card Number"><input className={inputCls} value={profileForm.governmentIds_aadhaar} onChange={e => setProfileForm({ ...profileForm, governmentIds_aadhaar: e.target.value })} placeholder="12-digit Aadhaar Number" /></FormRow>
              <FormRow label="PAN Card Number"><input className={inputCls} value={profileForm.governmentIds_pan} onChange={e => setProfileForm({ ...profileForm, governmentIds_pan: e.target.value })} placeholder="10-character PAN (ABCDE1234F)" /></FormRow>
            </div>
          </div>

          {/* Section 5: Bank Details for Salary Transfer */}
          <div className="space-y-3 pt-2">
            <div className="text-xs font-bold text-indigo-600 uppercase tracking-wider border-b pb-1.5">5. Bank Details (For Monthly Salary Disbursement)</div>
            <div className="grid grid-cols-2 gap-3">
              <FormRow label="Account Holder Name"><input className={inputCls} value={profileForm.bank_holderName} onChange={e => setProfileForm({ ...profileForm, bank_holderName: e.target.value })} placeholder="Name as per Bank Passbook" /></FormRow>
              <FormRow label="Bank Name"><input className={inputCls} value={profileForm.bank_bankName} onChange={e => setProfileForm({ ...profileForm, bank_bankName: e.target.value })} placeholder="HDFC / ICICI / SBI" /></FormRow>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <FormRow label="Account Number"><input className={inputCls} value={profileForm.bank_accountNumber} onChange={e => setProfileForm({ ...profileForm, bank_accountNumber: e.target.value })} placeholder="Savings/Current Acc No" /></FormRow>
              <FormRow label="IFSC Code"><input className={inputCls} value={profileForm.bank_ifscCode} onChange={e => setProfileForm({ ...profileForm, bank_ifscCode: e.target.value })} placeholder="HDFC0001234" /></FormRow>
              <FormRow label="Branch Name"><input className={inputCls} value={profileForm.bank_branchName} onChange={e => setProfileForm({ ...profileForm, bank_branchName: e.target.value })} placeholder="Branch Location" /></FormRow>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button type="button" onClick={() => setProfileModalOpen(false)} className="px-4 py-2 border rounded-lg text-xs font-semibold">Cancel</button>
            <button type="submit" disabled={updateProfileMutation.isPending} className="px-5 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg shadow-sm">
              {updateProfileMutation.isPending ? "Saving..." : "Save My Profile Details"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Live Camera Selfie Attendance Punch Modal */}
      <Modal open={cameraModalOpen} onClose={stopCamera} title={`Live Camera Selfie - ${cameraMode === "IN" ? "Clock In" : "Clock Out"}`}>
        <div className="p-6 space-y-4 text-center">
          <p className="text-xs text-slate-500 font-medium">Position your face clearly inside the camera frame to log verified biometric attendance.</p>
          
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 border border-indigo-200/80 rounded-full text-[11px] font-bold text-indigo-700 mx-auto">
            <MapPin className="w-3.5 h-3.5 text-indigo-600 animate-pulse" />
            <span>{liveGpsDisplay}</span>
          </div>
          
          <div className="relative w-64 h-64 mx-auto rounded-full overflow-hidden border-4 border-indigo-500 shadow-xl bg-slate-900 flex items-center justify-center">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover transform -scale-x-100" />
            <canvas ref={canvasRef} className="hidden" />
            <div className="absolute inset-0 border-2 border-dashed border-white/40 rounded-full pointer-events-none animate-pulse" />
          </div>
          {liveHint && (
            <p className="text-sm font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-xl px-3 py-2 mx-auto max-w-xs">{liveHint}</p>
          )}

          <div className="flex justify-center gap-3 pt-2">
            <button type="button" onClick={stopCamera} className="px-4 py-2 border rounded-lg text-xs font-semibold">Cancel</button>
            <button
              type="button"
              onClick={captureSelfieAndLog}
              disabled={isVerifying || logAttendanceMutation.isPending}
              className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold rounded-xl shadow-lg flex items-center gap-2 border border-white/20 disabled:opacity-60"
            >
              <Camera className="w-4 h-4" />
              {isVerifying ? "Verifying Face..." : logAttendanceMutation.isPending ? "Logging..." : `Capture Selfie & ${cameraMode === "IN" ? "Clock In" : "Clock Out"}`}
            </button>
          </div>
        </div>
      </Modal>

      {/* AI Face Match Verification Result Modal */}
      {verificationResult?.open && (
        <Modal open={true} onClose={() => setVerificationResult(null)} title={verificationResult.success ? "AI Identity Verified" : "⚠️ Face Verification Alert"}>
          <div className="p-6 text-center space-y-4">
            <div className={`w-16 h-16 rounded-full mx-auto flex items-center justify-center ${verificationResult.success ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"}`}>
              {verificationResult.success ? <CheckCircle2 className="w-8 h-8" /> : <AlertTriangle className="w-8 h-8" />}
            </div>
            
            <div>
              <h3 className={`text-base font-bold ${verificationResult.success ? "text-emerald-900" : "text-amber-900"}`}>
                {verificationResult.success ? `AI Face Match Verified (${verificationResult.matchScore}%)` : `Proxy / Face Mismatch Alert (${verificationResult.matchScore}% Match)`}
              </h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                {verificationResult.success
                  ? `Identity confirmed for ${user.firstName} ${user.lastName}. Your ${cameraMode === "IN" ? "Clock-In" : "Clock-Out"} attendance has been logged successfully.`
                  : `Warning: The face in the live selfie does not closely match the registered reference profile photo of ${user.firstName} ${user.lastName}.\n\nAttendance record has been FLAGGED for HR Audit & Security Review.`}
              </p>
            </div>

            <button
              onClick={() => setVerificationResult(null)}
              className={`w-full py-2.5 rounded-xl text-xs font-bold text-white shadow-sm ${verificationResult.success ? "bg-emerald-600 hover:bg-emerald-700" : "bg-amber-600 hover:bg-amber-700"}`}
            >
              Understand & Close
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Tab 1: Overview ─────────────────────────────────────────────────────────
function OverviewTab() {
  const { data: employees, isLoading: employeesLoading, isError: employeesError, refetch: refetchEmployees } = useQuery({
    queryKey: ["hr-employees"],
    queryFn: async () => { const { data } = await api.get("/hr/employees"); return data; },
  });

  const { data: leaves, isLoading: leavesLoading, isError: leavesError, refetch: refetchLeaves } = useQuery({
    queryKey: ["hr-leaves"],
    queryFn: async () => { const { data } = await api.get("/hr/leaves"); return data; },
  });

  if (employeesLoading || leavesLoading) {
    return <div className="py-16 text-center text-slate-400"><Loader2 className="w-8 h-8 animate-spin mx-auto" /><p className="mt-2 text-sm">Loading dashboard...</p></div>;
  }

  if (employeesError || leavesError) {
    return (
      <div className="py-16 text-center space-y-3">
        <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
        <p className="text-sm text-slate-600 font-medium">Failed to load dashboard data</p>
        <button onClick={() => { refetchEmployees(); refetchLeaves(); }} className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg inline-flex items-center gap-2"><RefreshCw className="w-3.5 h-3.5" /> Retry</button>
      </div>
    );
  }

  const allEmps = employees || [];
  const employeeCount = allEmps.length;
  const internsCount = allEmps.filter((e: any) => e.employmentType !== "EMPLOYEE").length;
  const staffCount = allEmps.filter((e: any) => e.employmentType === "EMPLOYEE").length;
  const pendingLeaves = (leaves || []).filter((l: any) => l.status === "PENDING").length;
  const probationCount = allEmps.filter((e: any) => e.employeeProfile?.status === "PROBATION").length;
  const noticeCount = allEmps.filter((e: any) => e.employeeProfile?.status === "NOTICE_PERIOD").length;

  // Today's birthdays
  const today = new Date();
  const todayBirthdays = allEmps.filter((e: any) => {
    const dob = e.employeeProfile?.dateOfBirth;
    if (!dob) return false;
    const d = new Date(dob);
    return d.getDate() === today.getDate() && d.getMonth() === today.getMonth();
  });

  // Department breakdown
  const deptMap: Record<string, number> = {};
  allEmps.forEach((e: any) => {
    const dept = e.employeeProfile?.department?.name || "Unassigned";
    deptMap[dept] = (deptMap[dept] || 0) + 1;
  });

  const cards = [
    { label: "Total Headcount", value: employeeCount, desc: `${staffCount} Employees | ${internsCount} Interns`, icon: Users, color: "text-blue-600 bg-blue-50" },
    { label: "Active Employees", value: staffCount, desc: "Full-time payroll", icon: Briefcase, color: "text-indigo-600 bg-indigo-50" },
    { label: "Active Interns", value: internsCount, desc: "Paid & unpaid interns", icon: DollarSign, color: "text-emerald-600 bg-emerald-50" },
    { label: "Pending Leave Requests", value: pendingLeaves, desc: "Awaiting approval", icon: Calendar, color: "text-orange-600 bg-orange-50" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {cards.map(c => (
          <div key={c.label} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{c.label}</span>
              <div className="text-3xl font-bold text-slate-900">{c.value}</div>
              <p className="text-xs text-slate-500 font-medium">{c.desc}</p>
            </div>
            <div className={`p-3 rounded-lg ${c.color}`}><c.icon className="w-6 h-6" /></div>
          </div>
        ))}
      </div>

      {/* Status Summary */}
      {(probationCount > 0 || noticeCount > 0) && (
        <div className="flex gap-3">
          {probationCount > 0 && <span className="text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1.5 rounded-full flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {probationCount} on Probation</span>}
          {noticeCount > 0 && <span className="text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 border border-indigo-200 px-3 py-1.5 rounded-full flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> {noticeCount} on Notice Period</span>}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Birthdays */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2"><Calendar className="w-4 h-4 text-violet-600" /> Today&apos;s Birthdays</h3>
          {todayBirthdays.length === 0 ? (
            <p className="text-xs text-slate-400">No birthdays today</p>
          ) : (
            <div className="space-y-2">
              {todayBirthdays.map((e: any) => (
                <div key={e.id} className="flex items-center gap-3 bg-violet-50 rounded-lg px-3 py-2">
                  <div className="w-8 h-8 rounded-full bg-violet-200 flex items-center justify-center text-violet-700 font-bold text-xs">{e.firstName?.[0]}{e.lastName?.[0]}</div>
                  <span className="text-sm font-semibold text-slate-800">{e.firstName} {e.lastName}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Department Breakdown */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2"><Building2 className="w-4 h-4 text-blue-600" /> Department Breakdown</h3>
          {Object.keys(deptMap).length === 0 ? (
            <p className="text-xs text-slate-400">No department data</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(deptMap).sort((a, b) => b[1] - a[1]).map(([dept, count]) => (
                <div key={dept} className="flex justify-between items-center text-sm">
                  <span className="font-medium text-slate-700">{dept}</span>
                  <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Tab 2: Employee Directory ───────────────────────────────────────────────
function DirectoryTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search);
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const [activeSec, setActiveSec] = useState(1);
  
  // Modals state
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState<any>(null);

  const SECTIONS = [
    { id: 1, name: "1. Basic Info" },
    { id: 2, name: "2. Employment Details" },
    { id: 3, name: "3. Address Details" },
    { id: 4, name: "4. Emergency Info" },
    { id: 5, name: "5. Government IDs" },
    { id: 6, name: "6. Bank Details" },
    { id: 7, name: "7. Salary Details" },
    { id: 8, name: "8. Education" },
    { id: 9, name: "9. Experience" },
    { id: 10, name: "10. Skills" },
    { id: 11, name: "11. Documents" },
    { id: 12, name: "12. Assets" },
    { id: 13, name: "13. Attendance" },
    { id: 14, name: "14. Leave Settings" },
    { id: 15, name: "15. Exit Details" },
  ];

  // Form states
  const initialForm = {
    email: "", password: "", firstName: "", lastName: "", role: "DEVELOPER", employmentType: "EMPLOYEE",
    middleName: "", gender: "Male", dateOfBirth: "", bloodGroup: "", maritalStatus: "Single",
    personalEmail: "", mobileNumber: "", alternateMobile: "",
    emergencyContactName: "", emergencyContactNumber: "", relationship: "",
    joiningDate: "", departmentId: "", designationId: "", branchId: "",
    noticePeriodDays: "30", costCenter: "", grade: "",

    reportingManager: "", workLocation: "", status: "ACTIVE",

    address_current: "", address_permanent: "", address_city: "", address_state: "", address_country: "", address_pin: "",
    governmentIds_aadhaar: "", governmentIds_pan: "", governmentIds_pran: "",
    bank_holderName: "", bank_bankName: "", bank_accountNumber: "", bank_ifscCode: "", bank_branchName: "",
    ctc: "", basicSalary: "", hra: "", allowance: "",
    conveyanceAllowance: "1600", specialAllowance: "", performanceIncentive: "",
    pfApplicable: false, esiApplicable: false,
    pfWageCeiling: "15000", voluntaryPfPercent: "0",
    esiGrossCeiling: "21000",
    professionalTaxOverride: "", // empty = auto Karnataka slab
    tds: "", gisDeduction: "0", npsEmployee: "0",
    salaryCycle: "Monthly", paymentMode: "Bank Transfer",
    taxRegime: "NEW", pfNumber: "", esiNumber: "",
    education_qualification: "", education_institute: "", education_passingYear: "", education_cgpa: "",
    experience_company: "", experience_designation: "", experience_startDate: "", experience_endDate: "",
    skills_technical: "", skills_soft: "", skills_certifications: "",
    documents_resume: "", documents_offerLetter: "", documents_appointmentLetter: "",
    assets_laptop: "", assets_desktop: "", assets_monitor: "", assets_mouse: "", assets_keyboard: "", assets_mobile: "",
    attendance_shift: "General Shift (09:00 AM - 06:00 PM)", attendance_shiftStartTime: "09:00", attendance_shiftEndTime: "18:00", attendance_gracePeriodMins: "15", attendance_weeklyOff: "Saturday, Sunday", attendance_mode: "Manual", attendance_overtimeEligible: false,
    leave_policy: "", leave_casualBalance: "12", leave_sickBalance: "10", leave_earnedBalance: "15",
    exitDate: "", exitReason: "", exitInterviewNotes: "", ffSettled: false,
  };
  const [form, setForm] = useState(initialForm);

  const packPayload = (d: any) => {
    return {
      ...d,
      bankHolderName: d.bank_holderName,
      bankName: d.bank_bankName,
      bankAccountNumber: d.bank_accountNumber,
      bankIfscCode: d.bank_ifscCode,
      bankBranchName: d.bank_branchName,
      aadhaarNumber: d.governmentIds_aadhaar,
      panNumber: d.governmentIds_pan,
      pranNumber: d.governmentIds_pran,
      addressJson: JSON.stringify({
        current: d.address_current,
        permanent: d.address_permanent,
        city: d.address_city,
        state: d.address_state,
        country: d.address_country,
        pin: d.address_pin,
      }),
      governmentIdsJson: JSON.stringify({
        aadhaar: d.governmentIds_aadhaar,
        pan: d.governmentIds_pan,
      }),
      bankDetailsJson: JSON.stringify({
        holderName: d.bank_holderName,
        bankName: d.bank_bankName,
        accountNumber: d.bank_accountNumber,
        ifscCode: d.bank_ifscCode,
        branchName: d.bank_branchName,
      }),
      attendanceSettingsJson: JSON.stringify({
        shift: d.attendance_shift,
        shiftStartTime: d.attendance_shiftStartTime || "09:00",
        shiftEndTime: d.attendance_shiftEndTime || "18:00",
        gracePeriodMins: d.attendance_gracePeriodMins || "15",
        weeklyOff: d.attendance_weeklyOff,
        mode: d.attendance_mode,
        overtimeEligible: d.attendance_overtimeEligible,
      }),
      leaveSettingsJson: JSON.stringify({
        policy: d.leave_policy,
        casualBalance: d.leave_casualBalance,
        sickBalance: d.leave_sickBalance,
        earnedBalance: d.leave_earnedBalance,
      }),
      assetsJson: JSON.stringify({
        laptop: d.assets_laptop,
        desktop: d.assets_desktop,
        monitor: d.assets_monitor,
        mouse: d.assets_mouse,
        keyboard: d.assets_keyboard,
        mobile: d.assets_mobile,
      }),
      educationJson: JSON.stringify([{
        qualification: d.education_qualification,
        institute: d.education_institute,
        passingYear: d.education_passingYear,
        cgpa: d.education_cgpa,
      }]),
      experienceJson: JSON.stringify([{
        company: d.experience_company,
        designation: d.experience_designation,
        startDate: d.experience_startDate,
        endDate: d.experience_endDate,
      }]),
      skillsJson: JSON.stringify({
        technical: d.skills_technical,
        soft: d.skills_soft,
        certifications: d.skills_certifications,
      }),
      documentsJson: JSON.stringify({
        resume: d.documents_resume,
        offerLetter: d.documents_offerLetter,
        appointmentLetter: d.documents_appointmentLetter,
      }),
      // ── Indian Statutory Salary Fields ──────────────────────────────────────
      // Sent alongside profile update so hr.service can update EmployeeSalary
      salary: {
        ctc:                  d.ctc ? Number(d.ctc) : undefined,
        basicSalary:          d.basicSalary ? Number(d.basicSalary) : undefined,
        hra:                  d.hra !== "" ? Number(d.hra || 0) : undefined,
        conveyanceAllowance:  d.conveyanceAllowance !== "" ? Number(d.conveyanceAllowance || 1600) : undefined,
        specialAllowance:     d.specialAllowance !== "" ? Number(d.specialAllowance || 0) : undefined,
        performanceIncentive: d.performanceIncentive !== "" ? Number(d.performanceIncentive || 0) : undefined,
        // PF
        pfApplicable:         Boolean(d.pfApplicable),
        pfWageCeiling:        d.pfWageCeiling ? Number(d.pfWageCeiling) : 15000,
        voluntaryPfPercent:   d.voluntaryPfPercent ? Number(d.voluntaryPfPercent) : 0,
        pfNumber:             d.pfNumber || null,
        // ESI
        esiApplicable:        Boolean(d.esiApplicable),
        esiGrossCeiling:      d.esiGrossCeiling ? Number(d.esiGrossCeiling) : 21000,
        esiNumber:            d.esiNumber || null,
        // PT — null = auto Karnataka slab; number = admin override
        professionalTaxOverride:
          d.professionalTaxOverride !== "" && d.professionalTaxOverride !== undefined
            ? Number(d.professionalTaxOverride)
            : null,
        // Other
        tds:             d.tds !== "" ? Number(d.tds || 0) : 0,
        gisDeduction:    Number(d.gisDeduction || 0),
        npsEmployee:     Number(d.npsEmployee || 0),
        taxRegime:       d.taxRegime || "NEW",
        salaryCycle:     d.salaryCycle || "Monthly",
        paymentMode:     d.paymentMode || "Bank Transfer",
        employmentCategory: d.employmentType || "EMPLOYEE",
      },
    };
  };

  const { data: employees, isLoading } = useQuery({
    queryKey: ["hr-employees", debouncedSearch, typeFilter],
    queryFn: async () => {
      const { data } = await api.get(`/hr/employees?search=${debouncedSearch}&type=${typeFilter}`);
      return data;
    },
  });

  // Reset page when filters change
  useEffect(() => { setCurrentPage(1); }, [debouncedSearch, typeFilter, statusFilter]);

  const { data: departments } = useQuery({
    queryKey: ["hrms-departments"],
    queryFn: async () => { const { data } = await api.get("/hrms/departments"); return data; },
  });

  const { data: designations } = useQuery({
    queryKey: ["hrms-designations"],
    queryFn: async () => { const { data } = await api.get("/hrms/designations"); return data; },
  });

  const { data: branches } = useQuery({
    queryKey: ["hrms-branches"],
    queryFn: async () => { const { data } = await api.get("/hrms/branches"); return data; },
  });

  const [newLogin, setNewLogin] = useState<{ email: string; password: string; inviteSent?: boolean } | null>(null);
  const inviteMutation = useMutation({
    mutationFn: (id: string) => api.post(`/hr/employees/${id}/invite`),
    onSuccess: (res: any) => alert(res?.data?.inviteSent ? "A new 'set your password' link was emailed. It works for 7 days." : "The invite could not be emailed. Check the email settings."),
    onError: showError,
  });
  const createMutation = useMutation({
    mutationFn: (payload: any) => api.post("/hr/employees", packPayload(payload)),
    onSuccess: (res: any) => {
      // The API makes a one-time password when HR leaves it empty; show it once so HR can share it.
      if (res?.data?.temporaryPassword) setNewLogin({ email: res.data.email, password: res.data.temporaryPassword, inviteSent: res.data.inviteSent });
      setAddOpen(false);
      setForm(initialForm);
      qc.invalidateQueries({ queryKey: ["hr-employees"] });
    },
    onError: showError,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) => api.patch(`/hr/employees/${id}`, packPayload(payload)),
    onSuccess: () => {
      setEditOpen(false);
      setSelectedEmp(null);
      qc.invalidateQueries({ queryKey: ["hr-employees"] });
    },
    onError: showError,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/hr/employees/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hr-employees"] });
    },
    onError: showError,
  });

  const openEdit = (emp: any) => {
    setSelectedEmp(emp);
    const prof = emp.employeeProfile || {};
    const sal = emp.employeeSalaries?.[0] || {};

    const address = prof.addressJson ? JSON.parse(prof.addressJson) : {};
    const gov = prof.governmentIdsJson ? JSON.parse(prof.governmentIdsJson) : {};
    const bank = prof.bankDetailsJson ? JSON.parse(prof.bankDetailsJson) : {};
    const att = prof.attendanceSettingsJson ? JSON.parse(prof.attendanceSettingsJson) : {};
    const leave = prof.leaveSettingsJson ? JSON.parse(prof.leaveSettingsJson) : {};
    const assets = prof.assetsJson ? JSON.parse(prof.assetsJson) : {};
    const eduList = prof.educationJson ? JSON.parse(prof.educationJson) : [];
    const edu = eduList[0] || {};
    const expList = prof.experienceJson ? JSON.parse(prof.experienceJson) : [];
    const exp = expList[0] || {};
    const skills = prof.skillsJson ? JSON.parse(prof.skillsJson) : {};
    const docs = prof.documentsJson ? JSON.parse(prof.documentsJson) : {};

    setForm({
      email: emp.email,
      password: "",
      firstName: emp.firstName,
      lastName: emp.lastName,
      role: emp.role,
      employmentType: emp.employmentType,
      middleName: prof.middleName || "",
      gender: prof.gender || "Male",
      dateOfBirth: prof.dateOfBirth ? new Date(prof.dateOfBirth).toISOString().split("T")[0] : "",
      bloodGroup: prof.bloodGroup || "",
      maritalStatus: prof.maritalStatus || "Single",
      personalEmail: prof.personalEmail || "",
      mobileNumber: prof.mobileNumber || "",
      alternateMobile: prof.alternateMobile || "",
      emergencyContactName: prof.emergencyContactName || "",
      emergencyContactNumber: prof.emergencyContactNumber || "",
      relationship: prof.relationship || "",
      joiningDate: prof.joiningDate ? new Date(prof.joiningDate).toISOString().split("T")[0] : "",
      departmentId: prof.departmentId || "",
      designationId: prof.designationId || "",
      branchId: prof.branchId || "",
      noticePeriodDays: String(prof.noticePeriodDays || 30),
      costCenter: prof.costCenter || "",
      grade: prof.grade || "",
      reportingManager: prof.reportingManager || "",
      workLocation: prof.workLocation || "",
      status: prof.status || "ACTIVE",

      address_current: address.current || "",
      address_permanent: address.permanent || "",
      address_city: address.city || "",
      address_state: address.state || "",
      address_country: address.country || "",
      address_pin: address.pin || "",

      governmentIds_aadhaar: prof.aadhaarNumber || gov.aadhaar || "",
      governmentIds_pan: prof.panNumber || gov.pan || "",
      governmentIds_pran: prof.pranNumber || "",

      bank_holderName: prof.bankHolderName || bank.holderName || "",
      bank_bankName: prof.bankName || bank.bankName || "",
      bank_accountNumber: prof.bankAccountNumber || bank.accountNumber || "",
      bank_ifscCode: prof.bankIfscCode || bank.ifscCode || "",
      bank_branchName: prof.bankBranchName || bank.branchName || "",

      ctc: String(sal.ctc || ""),
      basicSalary: String(sal.basicSalary || ""),
      hra: String(sal.hra || ""),
      allowance: String((sal as any).otherAllowance || ""),
      conveyanceAllowance: String((sal as any).conveyanceAllowance ?? "1600"),
      specialAllowance: String((sal as any).specialAllowance ?? ""),
      performanceIncentive: String((sal as any).performanceIncentive ?? ""),
      pfApplicable: sal.pfApplicable === true,
      esiApplicable: sal.esiApplicable === true,
      pfWageCeiling: String((sal as any).pfWageCeiling ?? "15000"),
      voluntaryPfPercent: String((sal as any).voluntaryPfPercent ?? "0"),
      esiGrossCeiling: String((sal as any).esiGrossCeiling ?? "21000"),
      professionalTaxOverride: (sal as any).professionalTaxOverride !== null && (sal as any).professionalTaxOverride !== undefined
        ? String((sal as any).professionalTaxOverride)
        : "",
      tds: String((sal as any).tds ?? ""),
      gisDeduction: String((sal as any).gisDeduction ?? "0"),
      npsEmployee: String((sal as any).npsEmployee ?? "0"),
      salaryCycle: sal.salaryCycle || "Monthly",
      paymentMode: sal.paymentMode || "Bank Transfer",
      taxRegime: (sal as any).taxRegime || "NEW",
      pfNumber: (sal as any).pfNumber || "",
      esiNumber: (sal as any).esiNumber || "",

      education_qualification: edu.qualification || "",
      education_institute: edu.institute || "",
      education_passingYear: edu.passingYear || "",
      education_cgpa: edu.cgpa || "",

      experience_company: exp.company || "",
      experience_designation: exp.designation || "",
      experience_startDate: exp.startDate || "",
      experience_endDate: exp.endDate || "",

      skills_technical: skills.technical || "",
      skills_soft: skills.soft || "",
      skills_certifications: skills.certifications || "",

      documents_resume: docs.resume || "",
      documents_offerLetter: docs.offerLetter || "",
      documents_appointmentLetter: docs.appointmentLetter || "",

      assets_laptop: assets.laptop || "",
      assets_desktop: assets.desktop || "",
      assets_monitor: assets.monitor || "",
      assets_mouse: assets.mouse || "",
      assets_keyboard: assets.keyboard || "",
      assets_mobile: assets.mobile || "",

      attendance_shift: att.shift || "General Shift (09:00 AM - 06:00 PM)",
      attendance_shiftStartTime: att.shiftStartTime || "09:00",
      attendance_shiftEndTime: att.shiftEndTime || "18:00",
      attendance_gracePeriodMins: att.gracePeriodMins || "15",
      attendance_weeklyOff: att.weeklyOff || "Saturday, Sunday",
      attendance_mode: att.mode || "Manual",
      attendance_overtimeEligible: att.overtimeEligible === true,

      leave_policy: leave.policy || "",
      leave_casualBalance: String(leave.casualBalance || "12"),
      leave_sickBalance: String(leave.sickBalance || "10"),
      leave_earnedBalance: String(leave.earnedBalance || "15"),

      exitDate: prof.exitDate ? new Date(prof.exitDate).toISOString().split("T")[0] : "",
      exitReason: prof.exitReason || "",
      exitInterviewNotes: prof.exitInterviewNotes || "",
      ffSettled: prof.ffSettled === true,
    });
    setActiveSec(1);
    setEditOpen(true);
  };

  const renderFormSections = (isEdit: boolean) => {
    return (
      <div className="flex flex-col md:flex-row gap-4 min-h-[480px]">
        {/* Left Side: Steps Menu */}
        <div className="w-full md:w-1/3 bg-slate-50 p-2.5 rounded-lg border border-slate-200 space-y-1 self-start">
          {SECTIONS.map(sec => (
            <button
              key={sec.id}
              type="button"
              onClick={() => setActiveSec(sec.id)}
              className={`w-full text-left px-3 py-2 text-xs font-bold rounded-lg transition-colors ${activeSec === sec.id ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}
            >
              {sec.name}
            </button>
          ))}
        </div>

        {/* Right Side: Inputs */}
        <div className="w-full md:w-2/3 bg-white p-2 border border-slate-100 rounded-lg space-y-3.5 overflow-y-auto max-h-[500px]">
          {activeSec === 1 && (
            <div className="space-y-3">
              <div className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b pb-1.5 mb-2">1. Basic Information</div>
              <div className="grid grid-cols-2 gap-3">
                <FormRow label="First Name" required><input className={inputCls} value={form.firstName} onChange={e => setForm({...form, firstName: e.target.value})} required /></FormRow>
                <FormRow label="Last Name" required><input className={inputCls} value={form.lastName} onChange={e => setForm({...form, lastName: e.target.value})} required /></FormRow>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormRow label="Email / Username (Official)" required><input type="email" className={inputCls} value={form.email} onChange={e => setForm({...form, email: e.target.value})} required disabled={isEdit} /></FormRow>
                <FormRow label="Password"><input type="password" className={inputCls} value={form.password} onChange={e => setForm({...form, password: e.target.value})} placeholder={isEdit ? "Leave empty to keep current" : "Leave empty to create a one-time password"} /></FormRow>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <FormRow label="Middle Name"><input className={inputCls} value={form.middleName} onChange={e => setForm({...form, middleName: e.target.value})} /></FormRow>
                <FormRow label="Personal Email (Optional)"><input type="email" className={inputCls} value={form.personalEmail} onChange={e => setForm({...form, personalEmail: e.target.value})} /></FormRow>
                <FormRow label="Mobile Number"><input className={inputCls} value={form.mobileNumber} onChange={e => setForm({...form, mobileNumber: e.target.value})} /></FormRow>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <FormRow label="Gender">
                  <select className={inputCls} value={form.gender} onChange={e => setForm({...form, gender: e.target.value})}>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </FormRow>
                <FormRow label="Date of Birth"><input type="date" className={inputCls} value={form.dateOfBirth} onChange={e => setForm({...form, dateOfBirth: e.target.value})} /></FormRow>
                <FormRow label="Marital Status">
                  <select className={inputCls} value={form.maritalStatus} onChange={e => setForm({...form, maritalStatus: e.target.value})}>
                    <option value="Single">Single</option>
                    <option value="Married">Married</option>
                    <option value="Divorced">Divorced</option>
                    <option value="Widowed">Widowed</option>
                  </select>
                </FormRow>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormRow label="Blood Group"><input className={inputCls} value={form.bloodGroup} onChange={e => setForm({...form, bloodGroup: e.target.value})} placeholder="O+ / A-" /></FormRow>
                <FormRow label="Role" required>
                  <select className={inputCls} value={form.role} onChange={e => setForm({...form, role: e.target.value})} required>
                    <option value="DEVELOPER">Developer / Employee</option>
                    <option value="QA">QA Engineer</option>
                    <option value="SALES">Sales</option>
                    <option value="SUPPORT">Support</option>
                    <option value="ACCOUNTANT">Accountant</option>
                    <option value="MANAGER">Manager</option>
                    <option value="SUPER_ADMIN">Super Admin</option>
                  </select>
                </FormRow>
              </div>
            </div>
          )}

          {activeSec === 2 && (
            <div className="space-y-3">
              <div className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b pb-1.5 mb-2">2. Employment Details</div>
              <div className="grid grid-cols-2 gap-3">
                <FormRow label="Joining Date"><input type="date" className={inputCls} value={form.joiningDate} onChange={e => setForm({...form, joiningDate: e.target.value})} /></FormRow>
                <FormRow label="Employee Type" required>
                  <select className={inputCls} value={form.employmentType} onChange={e => setForm({...form, employmentType: e.target.value})} required>
                    <option value="EMPLOYEE">Full Time</option>
                    <option value="PAID_INTERN">Paid Intern</option>
                    <option value="UNPAID_INTERN">Unpaid Intern</option>
                    <option value="CONTRACT">Contract</option>
                  </select>
                </FormRow>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <FormRow label="Department">
                  <select className={inputCls} value={form.departmentId} onChange={e => setForm({...form, departmentId: e.target.value})}>
                    <option value="">None</option>
                    {(departments || []).map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </FormRow>
                <FormRow label="Designation">
                  <select className={inputCls} value={form.designationId} onChange={e => setForm({...form, designationId: e.target.value})}>
                    <option value="">None</option>
                    {(designations || []).map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </FormRow>
                <FormRow label="Branch">
                  <select className={inputCls} value={form.branchId} onChange={e => setForm({...form, branchId: e.target.value})}>
                    <option value="">None</option>
                    {(branches || []).map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </FormRow>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <FormRow label="Reporting Manager"><input className={inputCls} value={form.reportingManager} onChange={e => setForm({...form, reportingManager: e.target.value})} placeholder="Manager Name / ID" /></FormRow>
                <FormRow label="Work Location"><input className={inputCls} value={form.workLocation} onChange={e => setForm({...form, workLocation: e.target.value})} placeholder="e.g. Pune Office / Remote" /></FormRow>
                <FormRow label="Employment Status" required>
                  <select className={inputCls} value={form.status} onChange={e => setForm({...form, status: e.target.value})} required>
                    <option value="ACTIVE">Active</option>
                    <option value="PROBATION">Probation</option>
                    <option value="NOTICE_PERIOD">Notice Period</option>
                    <option value="RESIGNED">Resigned</option>
                    <option value="TERMINATED">Terminated</option>
                  </select>
                </FormRow>
              </div>
            </div>
          )}

          {activeSec === 3 && (
            <div className="space-y-3">
              <div className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b pb-1.5 mb-2">3. Address Details</div>
              <FormRow label="Current Address"><textarea className={inputCls} value={form.address_current} onChange={e => setForm({...form, address_current: e.target.value})} rows={2} /></FormRow>
              <FormRow label="Permanent Address"><textarea className={inputCls} value={form.address_permanent} onChange={e => setForm({...form, address_permanent: e.target.value})} rows={2} /></FormRow>
              <div className="grid grid-cols-4 gap-3">
                <FormRow label="City"><input className={inputCls} value={form.address_city} onChange={e => setForm({...form, address_city: e.target.value})} /></FormRow>
                <FormRow label="State"><input className={inputCls} value={form.address_state} onChange={e => setForm({...form, address_state: e.target.value})} /></FormRow>
                <FormRow label="Country"><input className={inputCls} value={form.address_country} onChange={e => setForm({...form, address_country: e.target.value})} /></FormRow>
                <FormRow label="PIN Code"><input className={inputCls} value={form.address_pin} onChange={e => setForm({...form, address_pin: e.target.value})} /></FormRow>
              </div>
            </div>
          )}

          {activeSec === 4 && (
            <div className="space-y-3">
              <div className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b pb-1.5 mb-2">4. Emergency Contact Info</div>
              <div className="grid grid-cols-3 gap-3">
                <FormRow label="Contact Person Name"><input className={inputCls} value={form.emergencyContactName} onChange={e => setForm({...form, emergencyContactName: e.target.value})} /></FormRow>
                <FormRow label="Relationship"><input className={inputCls} value={form.relationship} onChange={e => setForm({...form, relationship: e.target.value})} placeholder="e.g. Spouse / Father" /></FormRow>
                <FormRow label="Mobile Number"><input className={inputCls} value={form.emergencyContactNumber} onChange={e => setForm({...form, emergencyContactNumber: e.target.value})} /></FormRow>
              </div>
            </div>
          )}

          {activeSec === 5 && (
            <div className="space-y-3">
              <div className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b pb-1.5 mb-2">5. Government IDs</div>
              <div className="grid grid-cols-3 gap-3">
                <FormRow label="Aadhaar Number"><input className={inputCls} value={form.governmentIds_aadhaar} onChange={e => setForm({...form, governmentIds_aadhaar: e.target.value})} placeholder="12-digit Aadhaar" /></FormRow>
                <FormRow label="PAN Number"><input className={inputCls} value={form.governmentIds_pan} onChange={e => setForm({...form, governmentIds_pan: e.target.value})} placeholder="10-digit PAN" /></FormRow>
                <FormRow label="GPF / PRAN Account"><input className={inputCls} value={form.governmentIds_pran} onChange={e => setForm({...form, governmentIds_pran: e.target.value})} placeholder="GPF / PRAN Number" /></FormRow>
              </div>
            </div>
          )}

          {activeSec === 6 && (
            <div className="space-y-3">
              <div className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b pb-1.5 mb-2">6. Bank Details</div>
              <div className="grid grid-cols-2 gap-3">
                <FormRow label="Account Holder Name"><input className={inputCls} value={form.bank_holderName} onChange={e => setForm({...form, bank_holderName: e.target.value})} /></FormRow>
                <FormRow label="Bank Name"><input className={inputCls} value={form.bank_bankName} onChange={e => setForm({...form, bank_bankName: e.target.value})} /></FormRow>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <FormRow label="Account Number"><input className={inputCls} value={form.bank_accountNumber} onChange={e => setForm({...form, bank_accountNumber: e.target.value})} /></FormRow>
                <FormRow label="IFSC Code"><input className={inputCls} value={form.bank_ifscCode} onChange={e => setForm({...form, bank_ifscCode: e.target.value})} /></FormRow>
                <FormRow label="Branch Name"><input className={inputCls} value={form.bank_branchName} onChange={e => setForm({...form, bank_branchName: e.target.value})} /></FormRow>
              </div>
            </div>
          )}

          {activeSec === 7 && (() => {
            // Indian MNC-standard statutory computation preview
            const basic = Number(form.basicSalary || 0);
            const hra = Number(form.hra || 0);
            const conv = Number(form.conveyanceAllowance || 0);
            const special = Number(form.specialAllowance || 0);
            const perf = Number(form.performanceIncentive || 0);
            const gross = basic + hra + conv + special + perf;
            const pfBase = Math.min(basic, Number(form.pfWageCeiling || 15000));
            const pfAmt = form.pfApplicable ? Math.round(pfBase * (0.12 + Number(form.voluntaryPfPercent || 0) / 100)) : 0;
            const pfEmpAmt = form.pfApplicable ? Math.round(pfBase * 0.12) : 0;
            const esiAmt = (form.esiApplicable && gross <= Number(form.esiGrossCeiling || 21000)) ? Math.round(gross * 0.0075) : 0;
            const esiEmpAmt = (form.esiApplicable && gross <= Number(form.esiGrossCeiling || 21000)) ? Math.round(gross * 0.0325) : 0;
            let ptAmt = 0;
            if (form.professionalTaxOverride !== "" && form.professionalTaxOverride !== undefined) {
              ptAmt = Number(form.professionalTaxOverride || 0);
            } else if (form.employmentType === "EMPLOYEE" || form.employmentType === "CONTRACT") {
              ptAmt = gross >= 20000 ? 200 : gross >= 15000 ? 150 : 0;
            }
            const tds = Number(form.tds || 0);
            const gis = Number(form.gisDeduction || 0);
            const nps = Number(form.npsEmployee || 0);
            const totalDed = pfAmt + esiAmt + ptAmt + tds + gis + nps;
            const netPay = Math.max(0, gross - totalDed);

            // Auto-set smart defaults when employment type changes
            const applySmartDefaults = (type: string) => {
              const updates: any = {};
              if (type === "EMPLOYEE") {
                updates.pfApplicable = basic <= 15000;
                updates.esiApplicable = gross <= 21000;
                updates.conveyanceAllowance = "1600";
                updates.professionalTaxOverride = "";
              } else if (type === "PAID_INTERN") {
                updates.pfApplicable = false;
                updates.esiApplicable = false;
                updates.professionalTaxOverride = "0";
                updates.tds = "";
              } else if (type === "CONTRACT") {
                updates.pfApplicable = false;
                updates.esiApplicable = false;
                updates.professionalTaxOverride = "0";
                updates.tds = String(Math.round(gross * 0.10 / 12));
              } else if (type === "UNPAID_INTERN") {
                updates.pfApplicable = false;
                updates.esiApplicable = false;
                updates.professionalTaxOverride = "0";
                updates.tds = "0";
              }
              setForm((f: any) => ({ ...f, ...updates }));
            };

            return (
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b pb-1.5 mb-2">
                <div className="text-xs font-bold text-slate-800 uppercase tracking-wider">7. Salary & Statutory Details (HR Only)</div>
                <div className="flex gap-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    form.employmentType === "EMPLOYEE" ? "bg-blue-100 text-blue-700" :
                    form.employmentType === "PAID_INTERN" ? "bg-amber-100 text-amber-700" :
                    form.employmentType === "CONTRACT" ? "bg-purple-100 text-purple-700" :
                    "bg-slate-100 text-slate-500"
                  }`}>{form.employmentType || "EMPLOYEE"}</span>
                  <button type="button" onClick={() => applySmartDefaults(form.employmentType || "EMPLOYEE")}
                    className="px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded text-[10px] font-bold">
                    ↺ Auto-fill Defaults
                  </button>
                </div>
              </div>

              {/* Earnings */}
              <div className="text-[10px] font-bold text-green-700 uppercase mb-1">Earnings Components</div>
              <div className="grid grid-cols-3 gap-3">
                <FormRow label="Annual CTC ₹">
                  <input type="number" className={inputCls} value={form.ctc}
                    onChange={e => setForm({...form, ctc: e.target.value})} placeholder="Annual CTC" />
                </FormRow>
                <FormRow label="Basic Salary ₹/mo">
                  <input type="number" className={inputCls} value={form.basicSalary}
                    onChange={e => setForm({...form, basicSalary: e.target.value})} />
                </FormRow>
                <FormRow label="HRA ₹/mo">
                  <input type="number" className={inputCls} value={form.hra}
                    onChange={e => setForm({...form, hra: e.target.value})} />
                </FormRow>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <FormRow label="Conveyance ₹/mo">
                  <input type="number" className={inputCls} value={form.conveyanceAllowance}
                    onChange={e => setForm({...form, conveyanceAllowance: e.target.value})}
                    placeholder="₹1,600 std" />
                </FormRow>
                <FormRow label="Special Allowance ₹/mo">
                  <input type="number" className={inputCls} value={form.specialAllowance}
                    onChange={e => setForm({...form, specialAllowance: e.target.value})} />
                </FormRow>
                <FormRow label="Performance Incentive ₹/mo">
                  <input type="number" className={inputCls} value={form.performanceIncentive}
                    onChange={e => setForm({...form, performanceIncentive: e.target.value})} />
                </FormRow>
              </div>

              {/* Gross preview */}
              <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 flex justify-between text-xs">
                <span className="text-green-700 font-semibold">Gross Monthly Pay</span>
                <span className="text-green-800 font-bold">₹{gross.toLocaleString("en-IN")}</span>
              </div>

              {/* Statutory Deductions */}
              <div className="text-[10px] font-bold text-red-700 uppercase mt-3 mb-1">Statutory Deductions</div>

              {/* PF */}
              <div className="border border-slate-200 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="pfApplicable" checked={form.pfApplicable}
                      onChange={e => setForm({...form, pfApplicable: e.target.checked})}
                      className="rounded text-indigo-600" />
                    <label htmlFor="pfApplicable" className="text-xs font-bold text-slate-700 cursor-pointer">
                      EPF / PF Applicable
                      <span className="ml-1 text-[10px] font-normal text-slate-500">(EPF Act 1952)</span>
                    </label>
                  </div>
                  {form.pfApplicable && (
                    <div className="text-[10px] text-right">
                      <div className="text-slate-600">Employee: <span className="font-bold text-red-600">-₹{pfAmt.toLocaleString("en-IN")}/mo</span></div>
                      <div className="text-slate-500">Employer: ₹{pfEmpAmt.toLocaleString("en-IN")}/mo</div>
                    </div>
                  )}
                </div>
                {form.pfApplicable && (
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <FormRow label="PF Wage Ceiling ₹">
                      <input type="number" className={inputCls} value={form.pfWageCeiling}
                        onChange={e => setForm({...form, pfWageCeiling: e.target.value})}
                        placeholder="15000" />
                    </FormRow>
                    <FormRow label="Voluntary PF %">
                      <input type="number" className={inputCls} value={form.voluntaryPfPercent} min="0" max="88"
                        onChange={e => setForm({...form, voluntaryPfPercent: e.target.value})}
                        placeholder="0" />
                    </FormRow>
                    <FormRow label="UAN / PF Number">
                      <input className={inputCls} value={form.pfNumber}
                        onChange={e => setForm({...form, pfNumber: e.target.value})}
                        placeholder="UAN number" />
                    </FormRow>
                  </div>
                )}
              </div>

              {/* ESI */}
              <div className="border border-slate-200 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="esiApplicable" checked={form.esiApplicable}
                      onChange={e => setForm({...form, esiApplicable: e.target.checked})}
                      className="rounded text-indigo-600" />
                    <label htmlFor="esiApplicable" className="text-xs font-bold text-slate-700 cursor-pointer">
                      ESIC Applicable
                      <span className="ml-1 text-[10px] font-normal text-slate-500">(ESI Act 1948, gross ≤ ₹21,000)</span>
                    </label>
                  </div>
                  {form.esiApplicable && (
                    <div className="text-[10px] text-right">
                      {gross > Number(form.esiGrossCeiling || 21000) ? (
                        <div className="text-orange-500 font-semibold">⚠ Gross exceeds ceiling — ESI won't apply</div>
                      ) : (
                        <>
                          <div className="text-slate-600">Employee: <span className="font-bold text-red-600">-₹{esiAmt.toLocaleString("en-IN")}/mo</span></div>
                          <div className="text-slate-500">Employer: ₹{esiEmpAmt.toLocaleString("en-IN")}/mo</div>
                        </>
                      )}
                    </div>
                  )}
                </div>
                {form.esiApplicable && (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <FormRow label="ESI Gross Ceiling ₹">
                      <input type="number" className={inputCls} value={form.esiGrossCeiling}
                        onChange={e => setForm({...form, esiGrossCeiling: e.target.value})}
                        placeholder="21000" />
                    </FormRow>
                    <FormRow label="ESI IP Number">
                      <input className={inputCls} value={form.esiNumber}
                        onChange={e => setForm({...form, esiNumber: e.target.value})}
                        placeholder="IP Insurance number" />
                    </FormRow>
                  </div>
                )}
              </div>

              {/* PT, TDS, GIS, NPS */}
              <div className="grid grid-cols-4 gap-3">
                <FormRow label={`PT ₹/mo${form.professionalTaxOverride === "" ? " (auto: ₹"+ptAmt+")" : ""}`}>
                  <input type="number" className={inputCls} value={form.professionalTaxOverride}
                    onChange={e => setForm({...form, professionalTaxOverride: e.target.value})}
                    placeholder={`Auto: ₹${ptAmt} (KA slab)`} />
                </FormRow>
                <FormRow label="TDS ₹/mo">
                  <input type="number" className={inputCls} value={form.tds}
                    onChange={e => setForm({...form, tds: e.target.value})}
                    placeholder="Monthly TDS" />
                </FormRow>
                <FormRow label="GIS ₹/mo">
                  <input type="number" className={inputCls} value={form.gisDeduction}
                    onChange={e => setForm({...form, gisDeduction: e.target.value})}
                    placeholder="Group Insurance" />
                </FormRow>
                <FormRow label="NPS Employee ₹/mo">
                  <input type="number" className={inputCls} value={form.npsEmployee}
                    onChange={e => setForm({...form, npsEmployee: e.target.value})}
                    placeholder="NPS contribution" />
                </FormRow>
              </div>

              {/* Net Pay Preview */}
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-3 mt-2">
                <div className="grid grid-cols-3 gap-2 text-[11px] mb-2">
                  <div>
                    <div className="text-slate-500">Gross Pay</div>
                    <div className="font-bold text-green-700">₹{gross.toLocaleString("en-IN")}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Total Deductions</div>
                    <div className="font-bold text-red-600">-₹{totalDed.toLocaleString("en-IN")}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Net Take-Home</div>
                    <div className="font-bold text-indigo-700 text-sm">₹{netPay.toLocaleString("en-IN")}</div>
                  </div>
                </div>
                <div className="text-[10px] text-slate-400">
                  PF: ₹{pfAmt} &bull; ESI: ₹{esiAmt} &bull; PT: ₹{ptAmt} &bull; TDS: ₹{tds} &bull; GIS: ₹{gis} &bull; NPS: ₹{nps}
                </div>
              </div>

              {/* Config */}
              <div className="grid grid-cols-3 gap-3 pt-1">
                <FormRow label="Salary Cycle">
                  <select className={inputCls} value={form.salaryCycle} onChange={e => setForm({...form, salaryCycle: e.target.value})}>
                    <option value="Monthly">Monthly</option>
                    <option value="Weekly">Weekly</option>
                    <option value="Bi-weekly">Bi-weekly</option>
                  </select>
                </FormRow>
                <FormRow label="Payment Mode">
                  <select className={inputCls} value={form.paymentMode} onChange={e => setForm({...form, paymentMode: e.target.value})}>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cheque">Cheque</option>
                    <option value="UPI">UPI</option>
                    <option value="Cash">Cash</option>
                  </select>
                </FormRow>
                <FormRow label="Tax Regime">
                  <select className={inputCls} value={form.taxRegime} onChange={e => setForm({...form, taxRegime: e.target.value})}>
                    <option value="NEW">New Regime (Default)</option>
                    <option value="OLD">Old Regime (with exemptions)</option>
                  </select>
                </FormRow>
              </div>
            </div>
            );
          })()}

          {activeSec === 8 && (
            <div className="space-y-3">
              <div className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b pb-1.5 mb-2">8. Education Profile</div>
              <div className="grid grid-cols-2 gap-3">
                <FormRow label="Qualification / Degree"><input className={inputCls} value={form.education_qualification} onChange={e => setForm({...form, education_qualification: e.target.value})} placeholder="e.g. B.Tech / MBA" /></FormRow>
                <FormRow label="Institute / University"><input className={inputCls} value={form.education_institute} onChange={e => setForm({...form, education_institute: e.target.value})} /></FormRow>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormRow label="Passing Year"><input type="number" className={inputCls} value={form.education_passingYear} onChange={e => setForm({...form, education_passingYear: e.target.value})} /></FormRow>
                <FormRow label="Percentage / CGPA"><input type="number" step="0.01" className={inputCls} value={form.education_cgpa} onChange={e => setForm({...form, education_cgpa: e.target.value})} /></FormRow>
              </div>
            </div>
          )}

          {activeSec === 9 && (
            <div className="space-y-3">
              <div className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b pb-1.5 mb-2">9. Prior Experience</div>
              <div className="grid grid-cols-2 gap-3">
                <FormRow label="Company Name"><input className={inputCls} value={form.experience_company} onChange={e => setForm({...form, experience_company: e.target.value})} /></FormRow>
                <FormRow label="Designation"><input className={inputCls} value={form.experience_designation} onChange={e => setForm({...form, experience_designation: e.target.value})} /></FormRow>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormRow label="Start Date"><input type="date" className={inputCls} value={form.experience_startDate} onChange={e => setForm({...form, experience_startDate: e.target.value})} /></FormRow>
                <FormRow label="End Date"><input type="date" className={inputCls} value={form.experience_endDate} onChange={e => setForm({...form, experience_endDate: e.target.value})} /></FormRow>
              </div>
            </div>
          )}

          {activeSec === 10 && (
            <div className="space-y-3">
              <div className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b pb-1.5 mb-2">10. Skills Profile</div>
              <FormRow label="Technical Skills"><input className={inputCls} value={form.skills_technical} onChange={e => setForm({...form, skills_technical: e.target.value})} placeholder="React, Node.js, PostgreSQL" /></FormRow>
              <FormRow label="Soft Skills"><input className={inputCls} value={form.skills_soft} onChange={e => setForm({...form, skills_soft: e.target.value})} placeholder="Leadership, Communication" /></FormRow>
              <FormRow label="Certifications"><input className={inputCls} value={form.skills_certifications} onChange={e => setForm({...form, skills_certifications: e.target.value})} placeholder="AWS Solution Architect, Scrum Master" /></FormRow>
            </div>
          )}

          {activeSec === 11 && (
            <div className="space-y-3">
              <div className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b pb-1.5 mb-2">11. Documents Vault</div>
              <FormRow label="Resume Link / File Path"><input className={inputCls} value={form.documents_resume} onChange={e => setForm({...form, documents_resume: e.target.value})} /></FormRow>
              <FormRow label="Offer Letter Link"><input className={inputCls} value={form.documents_offerLetter} onChange={e => setForm({...form, documents_offerLetter: e.target.value})} /></FormRow>
              <FormRow label="Appointment Letter Link"><input className={inputCls} value={form.documents_appointmentLetter} onChange={e => setForm({...form, documents_appointmentLetter: e.target.value})} /></FormRow>
            </div>
          )}

          {activeSec === 12 && (
            <div className="space-y-3">
              <div className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b pb-1.5 mb-2">12. Allocated Assets</div>
              <div className="grid grid-cols-2 gap-3">
                <FormRow label="Laptop Asset ID / Serial"><input className={inputCls} value={form.assets_laptop} onChange={e => setForm({...form, assets_laptop: e.target.value})} /></FormRow>
                <FormRow label="Desktop ID / Serial"><input className={inputCls} value={form.assets_desktop} onChange={e => setForm({...form, assets_desktop: e.target.value})} /></FormRow>
                <FormRow label="Monitor ID / Serial"><input className={inputCls} value={form.assets_monitor} onChange={e => setForm({...form, assets_monitor: e.target.value})} /></FormRow>
                <FormRow label="Mouse ID / Serial"><input className={inputCls} value={form.assets_mouse} onChange={e => setForm({...form, assets_mouse: e.target.value})} /></FormRow>
                <FormRow label="Keyboard ID / Serial"><input className={inputCls} value={form.assets_keyboard} onChange={e => setForm({...form, assets_keyboard: e.target.value})} /></FormRow>
                <FormRow label="Mobile Phone ID / Serial"><input className={inputCls} value={form.assets_mobile} onChange={e => setForm({...form, assets_mobile: e.target.value})} /></FormRow>
              </div>
            </div>
          )}

          {activeSec === 13 && (
            <div className="space-y-4">
              <div className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b pb-1.5 mb-2">13. Attendance & Shift Settings</div>
              <div className="grid grid-cols-2 gap-3">
                <FormRow label="Work Shift Name / Preset">
                  <select
                    className={inputCls}
                    value={form.attendance_shift}
                    onChange={e => {
                      const val = e.target.value;
                      if (val.includes("09:00")) setForm({ ...form, attendance_shift: val, attendance_shiftStartTime: "09:00", attendance_shiftEndTime: "18:00" });
                      else if (val.includes("06:00 AM")) setForm({ ...form, attendance_shift: val, attendance_shiftStartTime: "06:00", attendance_shiftEndTime: "15:00" });
                      else if (val.includes("02:00 PM")) setForm({ ...form, attendance_shift: val, attendance_shiftStartTime: "14:00", attendance_shiftEndTime: "23:00" });
                      else if (val.includes("10:00 PM")) setForm({ ...form, attendance_shift: val, attendance_shiftStartTime: "22:00", attendance_shiftEndTime: "07:00" });
                      else setForm({ ...form, attendance_shift: val });
                    }}
                  >
                    <option value="General Shift (09:00 AM - 06:00 PM)">General Shift (09:00 AM - 06:00 PM)</option>
                    <option value="Morning Shift (06:00 AM - 03:00 PM)">Morning Shift (06:00 AM - 03:00 PM)</option>
                    <option value="Evening Shift (02:00 PM - 11:00 PM)">Evening Shift (02:00 PM - 11:00 PM)</option>
                    <option value="Night Shift (10:00 PM - 07:00 AM)">Night Shift (10:00 PM - 07:00 AM)</option>
                    <option value="Custom Shift Timings">Custom Shift Timings</option>
                  </select>
                </FormRow>
                <FormRow label="Weekly Off Days">
                  <input className={inputCls} value={form.attendance_weeklyOff} onChange={e => setForm({...form, attendance_weeklyOff: e.target.value})} placeholder="Saturday, Sunday" />
                </FormRow>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <FormRow label="Shift Clock In Time (Start)">
                  <input type="time" className={inputCls} value={form.attendance_shiftStartTime} onChange={e => setForm({...form, attendance_shiftStartTime: e.target.value})} />
                </FormRow>
                <FormRow label="Shift Clock Out Time (End)">
                  <input type="time" className={inputCls} value={form.attendance_shiftEndTime} onChange={e => setForm({...form, attendance_shiftEndTime: e.target.value})} />
                </FormRow>
                <FormRow label="Grace Period (Minutes)">
                  <input type="number" min="0" max="60" className={inputCls} value={form.attendance_gracePeriodMins} onChange={e => setForm({...form, attendance_gracePeriodMins: e.target.value})} placeholder="15" />
                </FormRow>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FormRow label="Attendance Mode">
                  <select className={inputCls} value={form.attendance_mode} onChange={e => setForm({...form, attendance_mode: e.target.value})}>
                    <option value="Manual">Manual</option>
                    <option value="Biometric">Biometric</option>
                    <option value="GPS">GPS Geofencing</option>
                    <option value="Remote">Remote / Work from home</option>
                  </select>
                </FormRow>
                <div className="flex items-center pt-5 gap-2">
                  <input type="checkbox" id="overtimeEligible" checked={form.attendance_overtimeEligible} onChange={e => setForm({...form, attendance_overtimeEligible: e.target.checked})} className="rounded text-indigo-600 focus:ring-indigo-500" />
                  <label htmlFor="overtimeEligible" className="text-xs font-semibold text-slate-700 cursor-pointer">Overtime Eligible</label>
                </div>
              </div>
            </div>
          )}

          {activeSec === 14 && (
            <div className="space-y-3">
              <div className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b pb-1.5 mb-2">14. Leave Entitlements Settings</div>
              <FormRow label="Leave Policy"><input className={inputCls} value={form.leave_policy} onChange={e => setForm({...form, leave_policy: e.target.value})} placeholder="Standard 2026 Policy" /></FormRow>
              <div className="grid grid-cols-3 gap-3">
                <FormRow label="Casual Leave Balance"><input type="number" className={inputCls} value={form.leave_casualBalance} onChange={e => setForm({...form, leave_casualBalance: e.target.value})} /></FormRow>
                <FormRow label="Sick Leave Balance"><input type="number" className={inputCls} value={form.leave_sickBalance} onChange={e => setForm({...form, leave_sickBalance: e.target.value})} /></FormRow>
                <FormRow label="Earned Leave Balance"><input type="number" className={inputCls} value={form.leave_earnedBalance} onChange={e => setForm({...form, leave_earnedBalance: e.target.value})} /></FormRow>
              </div>
            </div>
          )}

          {activeSec === 15 && (
            <div className="space-y-3">
              <div className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b pb-1.5 mb-2">15. Exit Details (When Applicable)</div>
              <div className="grid grid-cols-2 gap-3">
                <FormRow label="Exit Date"><input type="date" className={inputCls} value={form.exitDate} onChange={e => setForm({...form, exitDate: e.target.value})} /></FormRow>
                <FormRow label="Exit Reason"><input className={inputCls} value={form.exitReason} onChange={e => setForm({...form, exitReason: e.target.value})} placeholder="Resignation / Retirement" /></FormRow>
              </div>
              <FormRow label="Exit Interview / Final Handover Notes"><textarea className={inputCls} value={form.exitInterviewNotes} onChange={e => setForm({...form, exitInterviewNotes: e.target.value})} rows={3} /></FormRow>
              <div className="flex items-center gap-2 pt-1">
                <input type="checkbox" id="ffSettled" checked={form.ffSettled} onChange={e => setForm({...form, ffSettled: e.target.checked})} className="rounded text-indigo-600 focus:ring-indigo-500" />
                <label htmlFor="ffSettled" className="text-xs font-semibold text-slate-700 cursor-pointer">Full & Final (F&F) Settled</label>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {newLogin && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4" onClick={() => setNewLogin(null)}>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Employee added</h3>
              <p className="text-sm text-slate-500">{newLogin.inviteSent ? "A 'set your password' link was emailed to them (valid 7 days). If it does not arrive, share this one-time login; they must choose a new password when they first sign in." : "Share this one-time login with them. They must choose a new password when they first sign in. It is shown only once."}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm space-y-1">
              <div><span className="text-slate-500">Email:</span> <span className="font-semibold text-slate-900">{newLogin.email}</span></div>
              <div><span className="text-slate-500">Password:</span> <span className="font-mono font-semibold text-slate-900">{newLogin.password}</span></div>
            </div>
            <div className="flex justify-end gap-2">
              <button 
                className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors" 
                onClick={() => {
                  const text = `Welcome to NeuraVolt.\nYour nORBIT employee workspace account is ready.\n\nPortal: https://teams.neuravolt.in/login\nUsername: ${newLogin.email}\nTemporary Password: ${newLogin.password}\n\nPlease change your temporary password upon your first sign in.`;
                  navigator.clipboard?.writeText(text);
                  alert("Copied login credentials to clipboard.");
                }}
              >
                Copy Details
              </button>
              <button className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors" onClick={() => setNewLogin(null)}>Done</button>
            </div>
          </div>
        </div>
      )}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            className="pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full bg-white"
            placeholder="Search employee name or email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3">
          <select
            className="py-2 px-3 border border-slate-200 rounded-lg text-sm bg-white"
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
          >
            <option value="">All Employment Types</option>
            <option value="EMPLOYEE">Full Time</option>
            <option value="PAID_INTERN">Paid Intern</option>
            <option value="UNPAID_INTERN">Unpaid Intern</option>
            <option value="CONTRACT">Contract</option>
          </select>
          <select
            className="py-2 px-3 border border-slate-200 rounded-lg text-sm bg-white"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="PROBATION">Probation</option>
            <option value="NOTICE_PERIOD">Notice Period</option>
            <option value="RESIGNED">Resigned</option>
            <option value="TERMINATED">Terminated</option>
          </select>
          <button
            onClick={() => { setForm(initialForm); setActiveSec(1); setAddOpen(true); }}
            className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-3.5 py-2 rounded-lg text-xs font-bold shadow-sm shrink-0"
          >
            <Plus className="w-4 h-4" /> Add Employee
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="py-10 text-center text-slate-400"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />Loading directory...</div>
      ) : (() => {
        // Apply client-side status filter
        const filtered = (employees || []).filter((e: any) => {
          if (!statusFilter) return true;
          const prof = e.employeeProfile || {};
          const st = prof.status || (e.isActive ? "ACTIVE" : "TERMINATED");
          return st === statusFilter;
        });
        const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
        const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

        if (filtered.length === 0) return <div className="py-10 text-center text-slate-400">No staff found</div>;

        return (
          <>
            <div className="text-xs text-slate-500 font-medium">Showing {paged.length} of {filtered.length} employees (Page {currentPage}/{totalPages})</div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {paged.map((e: any) => {
            const empId = `EMP${e.id.slice(0, 4).toUpperCase()}`;
            const prof = e.employeeProfile || {};
            const statusLabel = prof.status || (e.isActive ? "ACTIVE" : "TERMINATED");
            let badgeCls = "bg-green-50 text-green-700 border-green-200";
            if (statusLabel === "PROBATION") badgeCls = "bg-amber-50 text-amber-700 border-amber-200";
            if (statusLabel === "NOTICE_PERIOD") badgeCls = "bg-indigo-50 text-indigo-700 border border-indigo-100 border-indigo-200";
            if (statusLabel === "RESIGNED") badgeCls = "bg-slate-100 text-slate-700 border-slate-200";
            if (statusLabel === "TERMINATED") badgeCls = "bg-red-50 text-red-700 border-red-200";

            return (
              <div key={e.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between mb-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-indigo-600/10 flex items-center justify-center text-indigo-600 font-bold text-lg border border-indigo-500/20 uppercase">
                        {e.firstName?.[0] || ""}{e.lastName?.[0] || ""}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                          {e.firstName} {e.lastName}
                        </div>
                        <div className="text-xs text-slate-400 font-semibold tracking-wider uppercase mt-0.5">
                          ID: {empId}
                        </div>
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${badgeCls}`}>
                      {statusLabel.replace("_", " ")}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-600 border-t border-slate-100 pt-3">
                    <div className="flex justify-between"><span className="text-slate-400 font-medium flex items-center gap-1"><Building2 className="w-3 h-3 text-slate-400" /> Department</span> <span className="font-semibold text-slate-800">{prof.department?.name || "—"}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400 font-medium flex items-center gap-1"><Briefcase className="w-3 h-3 text-slate-400" /> Designation</span> <span className="font-semibold text-slate-800">{prof.designation?.name || "—"}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400 font-medium flex items-center gap-1"><Users className="w-3 h-3 text-slate-400" /> Manager</span> <span className="font-semibold text-slate-800">{prof.reportingManager || "—"}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400 font-medium flex items-center gap-1"><Calendar className="w-3 h-3 text-slate-400" /> Joined</span> <span className="font-semibold text-slate-800">{formatFmtDate(prof.joiningDate)}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400 font-medium flex items-center gap-1"><Mail className="w-3 h-3 text-slate-400" /> Email</span> <span className="font-semibold text-slate-800 break-all text-right">{e.email}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400 font-medium flex items-center gap-1"><Phone className="w-3 h-3 text-slate-400" /> Mobile</span> <span className="font-semibold text-slate-800">{prof.mobileNumber || "—"}</span></div>
                  </div>
                </div>

                <div className="flex gap-2 border-t border-slate-100 pt-3.5 mt-4">
                  <button onClick={() => openEdit(e)} className="flex-1 py-1.5 border border-slate-200 rounded-lg font-bold text-slate-700 hover:bg-slate-50 transition-colors text-center text-xs">
                    Edit Profile
                  </button>
                  <button
                    onClick={() => inviteMutation.mutate(e.id)}
                    disabled={inviteMutation.isPending}
                    className="px-3 py-1.5 border border-slate-200 rounded-lg font-bold text-slate-700 hover:bg-slate-50 transition-colors text-center text-xs disabled:opacity-50"
                    title="Email a new 'set your password' link"
                  >
                    Resend invite
                  </button>
                  <button 
                    onClick={() => { 
                      const choice = confirm(`🗑️ DELETE OPTIONS for ${e.firstName} ${e.lastName}:\n\nClick OK to Terminate/Remove from active directory.\nClick Cancel to keep employee.`);
                      if (choice) {
                        deleteMutation.mutate(e.id);
                      }
                    }} 
                    className="flex items-center gap-1 px-3 py-1.5 border border-red-200 text-red-600 rounded-lg font-bold hover:bg-red-50 transition-colors text-center text-xs"
                    title="Delete / Terminate Employee"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-2">
            <button disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)} className="p-2 border border-slate-200 rounded-lg disabled:opacity-30 hover:bg-slate-50"><ChevronLeft className="w-4 h-4" /></button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).slice(Math.max(0, currentPage - 3), currentPage + 2).map(p => (
              <button key={p} onClick={() => setCurrentPage(p)} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${p === currentPage ? "bg-indigo-600 text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>{p}</button>
            ))}
            <button disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)} className="p-2 border border-slate-200 rounded-lg disabled:opacity-30 hover:bg-slate-50"><ChevronRight className="w-4 h-4" /></button>
          </div>
        )}
          </>
        );
      })()}

      {/* Add Employee Modal */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add New Employee (15 Sections Profile)" size="lg">
        <form onSubmit={e => { e.preventDefault(); createMutation.mutate(form); }} className="p-5 space-y-4 max-h-[85vh] overflow-y-auto">
          {renderFormSections(false)}
          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button type="button" onClick={() => setAddOpen(false)} className="px-4 py-2 border rounded-lg text-xs font-semibold">Cancel</button>
            <button type="submit" disabled={createMutation.isPending} className="px-5 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg">
              {createMutation.isPending ? "Creating..." : "Save Employee Details"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Employee Modal */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title={`Edit Employee Profile — ${selectedEmp?.firstName || ""}`} size="lg">
        <form onSubmit={e => { e.preventDefault(); updateMutation.mutate({ id: selectedEmp.id, payload: form }); }} className="p-5 space-y-4 max-h-[85vh] overflow-y-auto">
          {renderFormSections(true)}
          <div className="flex justify-between items-center gap-3 pt-3 border-t border-slate-100">
            <button 
              type="button" 
              onClick={() => {
                if (confirm(`⚠️ PERMANENT DELETE WARNING:\nAre you sure you want to delete ${selectedEmp?.firstName} ${selectedEmp?.lastName}?`)) {
                  deleteMutation.mutate(selectedEmp.id);
                  setEditOpen(false);
                }
              }} 
              className="px-3.5 py-2 border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              <Trash2 className="w-4 h-4 text-red-500" />
              Delete Employee Record
            </button>
            <div className="flex gap-3">
              <button type="button" onClick={() => setEditOpen(false)} className="px-4 py-2 border rounded-lg text-xs font-semibold">Cancel</button>
              <button type="submit" disabled={updateMutation.isPending} className="px-5 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg">
                {updateMutation.isPending ? "Updating..." : "Save Profile Changes"}
              </button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// ─── Tab 3: HR Documents Console ──────────────────────────────────────────────
function DocumentsTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    employeeId: "",
    type: "SALARY_SLIP",
    title: "",
    notes: "",
    basicSalary: "25000",
    allowances: "25000",
    deductions: "0",
    startDate: "",
    endDate: "",
    // Itemized Salary Breakdown components
    hra: "10000",
    conveyance: "2000",
    specialAllowance: "8000",
    performanceIncentive: "5000",
    da: "0",
    pf: "0",
    esi: "0",
    professionalTax: "0",
    tds: "0",
    gis: "0",
    npsEmployee: "0",
    npsGovt: "0",
    voucherNo: "",
    voucherDate: "",
    voucherGross: "",
    voucherNet: "",
    workingDays: "31.0",
    pran: "110011478391",
    bankAccount: "",
    otherDeductions: "0",
    paymentMode: "Bank Transfer",
  });
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const updateEarningsComponent = (field: string, val: string) => {
    setForm(prev => {
      const updated = { ...prev, [field]: val };
      const hra = Number(updated.hra || 0);
      const conv = Number(updated.conveyance || 0);
      const spec = Number(updated.specialAllowance || 0);
      const perf = Number(updated.performanceIncentive || 0);
      const da = Number(updated.da || 0);
      const sum = hra + conv + spec + perf + da;
      if (sum > 0) updated.allowances = String(sum);
      return updated;
    });
  };

  const updateDeductionsComponent = (field: string, val: string) => {
    setForm(prev => {
      const updated = { ...prev, [field]: val };
      const pf = Number(updated.pf || 0);
      const esi = Number(updated.esi || 0);
      const pt = Number(updated.professionalTax || 0);
      const tds = Number(updated.tds || 0);
      const gis = Number(updated.gis || 0);
      const npsEmp = Number(updated.npsEmployee || 0);
      const other = Number(updated.otherDeductions || 0);
      const sum = pf + esi + pt + tds + gis + npsEmp + other;
      updated.deductions = String(sum);
      return updated;
    });
  };

  const { data: employees } = useQuery({ queryKey: ["hr-employees"], queryFn: async () => { const { data } = await api.get("/hr/employees"); return data; } });
  const allEmployees = employees || [];

  const { data: documents, isLoading } = useQuery({
    queryKey: ["hr-documents"],
    queryFn: async () => { const { data } = await api.get("/hr/documents"); return data; },
  });

  const createMutation = useMutation({
    mutationFn: (d: any) => api.post("/hr/documents/generate", {
      ...d,
      basicSalary: d.basicSalary ? Number(d.basicSalary) : undefined,
      allowances: d.allowances ? Number(d.allowances) : undefined,
      deductions: d.deductions ? Number(d.deductions) : undefined,
      hra: d.hra ? Number(d.hra) : undefined,
      conveyance: d.conveyance ? Number(d.conveyance) : undefined,
      specialAllowance: d.specialAllowance ? Number(d.specialAllowance) : undefined,
      performanceIncentive: d.performanceIncentive ? Number(d.performanceIncentive) : undefined,
      da: d.da ? Number(d.da) : undefined,
      pf: d.pf ? Number(d.pf) : undefined,
      esi: d.esi ? Number(d.esi) : undefined,
      professionalTax: d.professionalTax ? Number(d.professionalTax) : undefined,
      tds: d.tds ? Number(d.tds) : undefined,
      gis: d.gis ? Number(d.gis) : undefined,
      npsEmployee: d.npsEmployee ? Number(d.npsEmployee) : undefined,
      npsGovt: d.npsGovt ? Number(d.npsGovt) : undefined,
      otherDeductions: d.otherDeductions ? Number(d.otherDeductions) : undefined,
      workingDays: d.workingDays ? Number(d.workingDays) : undefined,
      voucherGross: d.voucherGross ? Number(d.voucherGross) : undefined,
      voucherNet: d.voucherNet ? Number(d.voucherNet) : undefined,
      pran: d.pran || undefined,
      bankAccount: d.bankAccount || undefined,
      voucherNo: d.voucherNo || undefined,
      voucherDate: d.voucherDate || undefined,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hr-documents"] }); setOpen(false); },
    onError: showError,
  });

  const sendMutation = useMutation({
    mutationFn: (id: string) => api.post(`/hr/documents/${id}/send`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hr-documents"] }); alert("📧 Document mailed successfully!"); },
    onError: showError,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/hr/documents/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hr-documents"] }); },
    onError: showError,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-slate-800">Generated HR Documents</h2>
        <button onClick={() => setOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-medium rounded-lg shadow-sm">
          <Plus className="w-4 h-4" /> Generate Document
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <table className="min-w-full divide-y divide-slate-100">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Document Title</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Employee</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Type</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Status</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Created On</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {isLoading ? <tr><td colSpan={6} className="py-10 text-center text-slate-400">Loading documents...</td></tr>
              : (documents || []).length === 0 ? <tr><td colSpan={6} className="py-10 text-center text-slate-400">No HR documents generated yet</td></tr>
              : documents.map((doc: any) => (
                <tr key={doc.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 text-sm font-bold text-slate-900">{doc.title}</td>
                  <td className="px-5 py-3">
                    <div className="text-sm font-semibold text-slate-800">{doc.employee?.firstName} {doc.employee?.lastName}</div>
                    <div className="text-xs text-slate-400">{doc.employee?.email}</div>
                  </td>
                  <td className="px-5 py-3"><span className="text-xs font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded">{doc.type}</span></td>
                  <td className="px-5 py-3">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      doc.status === "SENT" ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"
                    }`}>
                      {doc.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-500 font-medium">{formatFmtDate(doc.createdAt)}</td>
                  <td className="px-5 py-3 text-right space-x-2">
                    {doc.filePath && (
                      <button
                        onClick={async () => {
                          // Authenticated download: the file is no longer public under /uploads.
                          const win = window.open("", "_blank");
                          try {
                            const { data } = await api.get(`/hr/documents/${doc.id}/file`, { responseType: "blob" });
                            const url = URL.createObjectURL(data);
                            if (win) win.location.href = url; else window.open(url, "_blank");
                            setTimeout(() => URL.revokeObjectURL(url), 60_000);
                          } catch {
                            win?.close();
                            alert("Could not open the document PDF.");
                          }
                        }}
                        className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 border border-slate-200 px-2.5 py-1 rounded"
                      >
                        <Download className="w-3.5 h-3.5" /> PDF
                      </button>
                    )}
                    <button
                      onClick={() => sendMutation.mutate(doc.id)}
                      disabled={sendMutation.isPending}
                      className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 border border-blue-100 bg-blue-50 px-2.5 py-1 rounded"
                    >
                      <Mail className="w-3.5 h-3.5" /> Mail
                    </button>
                    <button
                      onClick={() => { if (confirm("Are you sure you want to delete this document?")) deleteMutation.mutate(doc.id); }}
                      className="text-slate-400 hover:text-red-600 py-1"
                    >
                      <Trash2 className="w-4 h-4 inline" />
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Generate HR Document">
        <form onSubmit={e => { e.preventDefault(); createMutation.mutate(form); }} className="p-5 space-y-4 max-h-[85vh] overflow-y-auto">
          <FormRow label="Employee" required>
            <select
              className={inputCls}
              value={form.employeeId}
              onChange={e => {
                const empId = e.target.value;
                set("employeeId", empId);
                const selected = allEmployees.find((u: any) => u.id === empId);
                if (selected && selected.employeeSalaries?.[0]) {
                  const sal = selected.employeeSalaries[0];
                  setForm(f => ({
                    ...f,
                    employeeId: empId,
                    basicSalary: String(sal.basicSalary || ""),
                    allowances: String(sal.allowance || f.allowances),
                    professionalTax: String(sal.professionalTax || "200"),
                    tds: String(sal.tds || "0"),
                    hra: String(sal.hra || "0"),
                    specialAllowance: String(sal.allowance || "0"),
                    pf: sal.pfApplicable ? String(Math.round((sal.basicSalary || 0) * 0.12)) : "0",
                    esi: sal.esiApplicable ? String(Math.round((sal.basicSalary || 0) * 0.0075)) : "0",
                    pran: selected.employeeProfile?.pranNumber || "110011478391",
                    bankAccount: selected.employeeProfile?.bankAccountNumber || "",
                    paymentMode: sal.paymentMode || "Bank Transfer",
                  }));
                }
              }}
              required
            >
              <option value="">Select Employee / Intern...</option>
              {allEmployees.map((u: any) => (
                <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.employmentType})</option>
              ))}
            </select>
          </FormRow>

          <div className="grid grid-cols-2 gap-3">
            <FormRow label="Document Type" required>
              <select className={inputCls} value={form.type} onChange={e => set("type", e.target.value)} required>
                <option value="SALARY_SLIP">Salary Slip</option>
                <option value="OFFER_LETTER">Offer Letter</option>
                <option value="APPOINTMENT_LETTER">Appointment Letter</option>
                <option value="NDA">NDA (Non-Disclosure)</option>
                <option value="SALARY_STRUCTURE">Salary Structure</option>
                <option value="INTERNSHIP_OFFER_LETTER">Internship Offer Letter</option>
                <option value="INTERNSHIP_COMPLETION_CERTIFICATE">Completion Certificate</option>
                <option value="CONFIDENTIALITY_CLAUSE">Confidentiality Clause</option>
                <option value="INTERNSHIP_AGREEMENT">Internship Agreement</option>
                <option value="MONTHLY_STIPEND_RECORD">Monthly Stipend Record</option>
                <option value="PAYMENT_PROOF">Payment Proof</option>
              </select>
            </FormRow>
            <FormRow label="Custom Title"><input className={inputCls} value={form.title} onChange={e => set("title", e.target.value)} placeholder="Auto-generated if empty" /></FormRow>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <FormRow label="Basic / Stipend ₹"><input type="number" className={inputCls} value={form.basicSalary} onChange={e => set("basicSalary", e.target.value)} /></FormRow>
            <FormRow label="Total Allowances ₹"><input type="number" className={inputCls} value={form.allowances} onChange={e => set("allowances", e.target.value)} /></FormRow>
            <FormRow label="Total Deductions ₹"><input type="number" className={inputCls} value={form.deductions} onChange={e => set("deductions", e.target.value)} /></FormRow>
          </div>

          {form.type === "SALARY_SLIP" && (
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3.5">
              <div className="text-xs font-bold text-indigo-600 uppercase tracking-wider border-b border-slate-200 pb-1.5">
                Salary Component Breakdown (IFMS / LLP Treasury Format)
              </div>

              <div>
                <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider block mb-1.5">Earnings Components</span>
                <div className="grid grid-cols-3 gap-3">
                  <FormRow label="HRA ₹">
                    <input type="number" className={inputCls} value={form.hra} onChange={e => updateEarningsComponent("hra", e.target.value)} />
                  </FormRow>
                  <FormRow label="D.A. (Dearness Allowance) ₹">
                    <input type="number" className={inputCls} value={form.da} onChange={e => updateEarningsComponent("da", e.target.value)} />
                  </FormRow>
                  <FormRow label="Conveyance ₹">
                    <input type="number" className={inputCls} value={form.conveyance} onChange={e => updateEarningsComponent("conveyance", e.target.value)} />
                  </FormRow>
                  <FormRow label="Special Allowance ₹">
                    <input type="number" className={inputCls} value={form.specialAllowance} onChange={e => updateEarningsComponent("specialAllowance", e.target.value)} />
                  </FormRow>
                  <FormRow label="Performance Incentive ₹">
                    <input type="number" className={inputCls} value={form.performanceIncentive} onChange={e => updateEarningsComponent("performanceIncentive", e.target.value)} />
                  </FormRow>
                </div>
              </div>

              <div>
                <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider block mb-1.5">Deduction Components</span>
                <div className="grid grid-cols-3 gap-3">
                  <FormRow label="PF (Provident Fund) ₹">
                    <input type="number" className={inputCls} value={form.pf} onChange={e => updateDeductionsComponent("pf", e.target.value)} />
                  </FormRow>
                  <FormRow label="ESI ₹">
                    <input type="number" className={inputCls} value={form.esi} onChange={e => updateDeductionsComponent("esi", e.target.value)} />
                  </FormRow>
                  <FormRow label="Professional Tax (PT) ₹">
                    <input type="number" className={inputCls} value={form.professionalTax} onChange={e => updateDeductionsComponent("professionalTax", e.target.value)} />
                  </FormRow>
                  <FormRow label="Income Tax (TDS) ₹">
                    <input type="number" className={inputCls} value={form.tds} onChange={e => updateDeductionsComponent("tds", e.target.value)} />
                  </FormRow>
                  <FormRow label="GIS (Group Insurance) ₹">
                    <input type="number" className={inputCls} value={form.gis} onChange={e => updateDeductionsComponent("gis", e.target.value)} />
                  </FormRow>
                  <FormRow label="NPS Employee Contri. ₹">
                    <input type="number" className={inputCls} value={form.npsEmployee} onChange={e => updateDeductionsComponent("npsEmployee", e.target.value)} />
                  </FormRow>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-3">
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1.5">Treasury & Voucher Metadata</span>
                <div className="grid grid-cols-3 gap-3">
                  <FormRow label="Account Number">
                    <input className={inputCls} value={form.bankAccount} onChange={e => set("bankAccount", e.target.value)} />
                  </FormRow>
                  <FormRow label="Working Days Count">
                    <input type="number" step="0.5" className={inputCls} value={form.workingDays} onChange={e => set("workingDays", e.target.value)} />
                  </FormRow>
                  <FormRow label="NPS Govt Contribution ₹">
                    <input type="number" className={inputCls} value={form.npsGovt} onChange={e => set("npsGovt", e.target.value)} />
                  </FormRow>
                  <FormRow label="Voucher Number">
                    <input className={inputCls} value={form.voucherNo} onChange={e => set("voucherNo", e.target.value)} placeholder="040/2202/..." />
                  </FormRow>
                  <FormRow label="Voucher Date">
                    <input type="date" className={inputCls} value={form.voucherDate} onChange={e => set("voucherDate", e.target.value)} />
                  </FormRow>
                  <FormRow label="Payment Mode">
                    <select className={inputCls} value={form.paymentMode} onChange={e => set("paymentMode", e.target.value)}>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="Cheque">Cheque</option>
                      <option value="UPI">UPI</option>
                      <option value="Cash">Cash</option>
                    </select>
                  </FormRow>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <FormRow label="Voucher Gross Volume ₹">
                    <input type="number" className={inputCls} value={form.voucherGross} onChange={e => set("voucherGross", e.target.value)} placeholder="46673080" />
                  </FormRow>
                  <FormRow label="Voucher Net Volume ₹">
                    <input type="number" className={inputCls} value={form.voucherNet} onChange={e => set("voucherNet", e.target.value)} placeholder="41906851" />
                  </FormRow>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <FormRow label="Other Deductions ₹">
                  <input type="number" className={inputCls} value={form.otherDeductions} onChange={e => updateDeductionsComponent("otherDeductions", e.target.value)} />
                </FormRow>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <FormRow label="Start Date / Pay Date"><input type="date" className={inputCls} value={form.startDate} onChange={e => set("startDate", e.target.value)} /></FormRow>
            <FormRow label="End Date / Expiry"><input type="date" className={inputCls} value={form.endDate} onChange={e => set("endDate", e.target.value)} /></FormRow>
          </div>

          <FormRow label="Remarks / Special Terms"><textarea className={inputCls} value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} /></FormRow>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setOpen(false)} className="flex-1 py-2.5 text-sm border border-slate-200 rounded-lg">Cancel</button>
            <button type="submit" disabled={createMutation.isPending} className="flex-1 py-2.5 text-sm bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg font-medium disabled:opacity-60">
              {createMutation.isPending ? "Generating..." : "Generate & Save"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// ─── Tab 4: Attendance Register Grid ──────────────────────────────────────────
function AttendanceTab() {
  const qc = useQueryClient();

  // Filter States
  const [selectedPeriod, setSelectedPeriod] = useState<"TODAY" | "YESTERDAY" | "THIS_WEEK" | "THIS_MONTH" | "CUSTOM">("TODAY");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);

  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 300);

  const [selectedDepartment, setSelectedDepartment] = useState("ALL");
  const [selectedBranch, setSelectedBranch] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [selectedMode, setSelectedMode] = useState("ALL");

  // Modals & Drawer State
  const [openManualModal, setOpenManualModal] = useState(false);
  const [photoModalRecord, setPhotoModalRecord] = useState<any>(null);
  const [drawerRecord, setDrawerRecord] = useState<any>(null);

  const [form, setForm] = useState({ employeeId: "", date: startDate, status: "PRESENT", clockIn: "09:00", clockOut: "18:00", notes: "" });
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  // Query HRMS Metadata
  const { data: departments = [] } = useQuery({
    queryKey: ["hrms-departments"],
    queryFn: async () => { const { data } = await api.get("/hrms/departments"); return data; }
  });
  const { data: branches = [] } = useQuery({
    queryKey: ["hrms-branches"],
    queryFn: async () => { const { data } = await api.get("/hrms/branches"); return data; }
  });
  const { data: employees = [] } = useQuery({
    queryKey: ["hr-employees"],
    queryFn: async () => { const { data } = await api.get("/hr/employees"); return data; }
  });

  // Calculate Date Range based on Period
  const activeDateRange = useMemo(() => {
    const today = new Date();
    if (selectedPeriod === "TODAY") {
      const d = today.toISOString().split("T")[0];
      return { start: d, end: d };
    }
    if (selectedPeriod === "YESTERDAY") {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      const d = y.toISOString().split("T")[0];
      return { start: d, end: d };
    }
    if (selectedPeriod === "THIS_WEEK") {
      const curr = new Date();
      const first = curr.getDate() - curr.getDay() + 1;
      const start = new Date(curr.setDate(first)).toISOString().split("T")[0];
      const end = new Date().toISOString().split("T")[0];
      return { start, end };
    }
    if (selectedPeriod === "THIS_MONTH") {
      const start = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split("T")[0];
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split("T")[0];
      return { start, end };
    }
    return { start: startDate, end: endDate };
  }, [selectedPeriod, startDate, endDate]);

  // Query Attendance Records with Backend Filters
  const { data: attendanceData = [], isLoading } = useQuery({
    queryKey: ["hr-attendance", activeDateRange.start, activeDateRange.end, selectedDepartment, selectedBranch, selectedStatus, debouncedSearch],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (activeDateRange.start && activeDateRange.end) {
        params.append("startDate", activeDateRange.start);
        params.append("endDate", activeDateRange.end);
      }
      if (selectedDepartment !== "ALL") params.append("departmentId", selectedDepartment);
      if (selectedBranch !== "ALL") params.append("branchId", selectedBranch);
      if (selectedStatus !== "ALL") params.append("status", selectedStatus);
      if (debouncedSearch.trim()) params.append("search", debouncedSearch.trim());

      const { data } = await api.get(`/hr/attendance?${params.toString()}`);
      return data;
    },
  });

  // Query Real Backend Stats
  const { data: statsData } = useQuery({
    queryKey: ["hr-attendance-stats", activeDateRange.start],
    queryFn: async () => {
      const { data } = await api.get(`/hr/attendance/stats?date=${activeDateRange.start}`);
      return data;
    },
  });

  const logMutation = useMutation({
    mutationFn: (d: any) => api.post("/hr/attendance/log", {
      ...d,
      // Times typed by HR are office local time, not UTC.
      clockIn: d.clockIn ? new Date(`${d.date}T${d.clockIn}:00`).toISOString() : undefined,
      clockOut: d.clockOut ? new Date(`${d.date}T${d.clockOut}:00`).toISOString() : undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hr-attendance"] });
      qc.invalidateQueries({ queryKey: ["hr-attendance-stats"] });
      setOpenManualModal(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/hr/attendance/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hr-attendance"] });
      qc.invalidateQueries({ queryKey: ["hr-attendance-stats"] });
    },
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, decision, note }: { id: string; decision: "APPROVED" | "DENIED"; note?: string }) =>
      api.patch(`/hr/attendance/${id}/review`, { decision, note }),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ["hr-attendance"] });
      qc.invalidateQueries({ queryKey: ["hr-attendance-stats"] });
      setPhotoModalRecord(null);
      if (drawerRecord) {
        setDrawerRecord((prev: any) => prev ? { ...prev, hrReviewStatus: variables.decision } : null);
      }
    },
  });

  // Helper parser for notes
  const parseNotesData = useCallback((rawNotes: string | null) => {
    if (!rawNotes) return { text: "—", livePhoto: null, refPhoto: null, ipAddress: null, gps: null, mode: "Manual HR Log" };
    const cleanNotes = rawNotes.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '');
    const parts = cleanNotes.split("|||");
    let text = (parts[0] || "—").trim();
    let livePhoto: string | null = null;
    let refPhoto: string | null = null;
    let ipAddress: string | null = null;
    let gps: string | null = null;
    let mode = "Manual HR Log";

    parts.forEach(p => {
      if (p.startsWith("LIVE:")) livePhoto = p.substring(5);
      if (p.startsWith("REF:")) refPhoto = p.substring(4);
      if (p.startsWith("IP:")) ipAddress = p.substring(3);
      if (p.startsWith("GPS:")) gps = p.substring(4);
      if (p.startsWith("MODE:")) mode = p.substring(5);
    });

    if (livePhoto) mode = "AI Live Selfie";
    else if (text.toLowerCase().includes("biometric") || text.toLowerCase().includes("device")) mode = "Biometric Hardware Sync";

    return { text, livePhoto, refPhoto, ipAddress, gps, mode };
  }, []);

  // Duration & Shift Calculators
  const getWorkDuration = (cIn: string | null, cOut: string | null) => {
    if (!cIn || !cOut) return cIn ? "In Progress" : "—";
    const start = new Date(cIn).getTime();
    const end = new Date(cOut).getTime();
    const diffMs = end - start;
    if (diffMs <= 0) return "—";
    const mins = Math.floor(diffMs / (1000 * 60));
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    if (hrs === 0) return `${remMins}m`;
    return `${hrs}h ${remMins}m`;
  };

  const getEmployeeShift = (r?: any) => {
    const attJson = r?.employee?.employeeProfile?.attendanceSettingsJson;
    let shiftStart = "09:00";
    let shiftEnd = "18:00";
    let grace = 15;
    let shiftName = "General Shift (09:00 AM - 06:00 PM)";

    if (attJson) {
      try {
        const parsed = typeof attJson === "string" ? JSON.parse(attJson) : attJson;
        if (parsed.shiftStartTime) shiftStart = parsed.shiftStartTime;
        if (parsed.shiftEndTime) shiftEnd = parsed.shiftEndTime;
        if (parsed.gracePeriodMins) grace = parseInt(parsed.gracePeriodMins, 10) || 15;
        if (parsed.shift) shiftName = parsed.shift;
      } catch (e) {}
    }
    return { shiftStart, shiftEnd, grace, shiftName };
  };

  const getLateArrivalMins = (cIn: string | null, r?: any) => {
    if (!cIn) return 0;
    const { shiftStart, grace } = getEmployeeShift(r);
    const [sHour, sMin] = shiftStart.split(":").map(n => parseInt(n, 10) || 0);

    const d = new Date(cIn);
    const hour = d.getHours();
    const min = d.getMinutes();
    const clockInMins = hour * 60 + min;
    const shiftStartMins = sHour * 60 + sMin;
    const diff = clockInMins - shiftStartMins;
    return diff > grace ? diff : 0;
  };

  const getEarlyExitMins = (cOut: string | null, r?: any) => {
    if (!cOut) return 0;
    const { shiftEnd, grace } = getEmployeeShift(r);
    const [eHour, eMin] = shiftEnd.split(":").map(n => parseInt(n, 10) || 0);

    const d = new Date(cOut);
    const hour = d.getHours();
    const min = d.getMinutes();
    const clockOutMins = hour * 60 + min;
    const shiftEndMins = eHour * 60 + eMin;
    const diff = shiftEndMins - clockOutMins;
    return diff > grace ? diff : 0;
  };

  const getOvertimeMins = (cIn: string | null, cOut: string | null, r?: any) => {
    if (!cIn || !cOut) return 0;
    const { shiftStart, shiftEnd } = getEmployeeShift(r);
    const [sHour, sMin] = shiftStart.split(":").map(n => parseInt(n, 10) || 0);
    const [eHour, eMin] = shiftEnd.split(":").map(n => parseInt(n, 10) || 0);

    const start = new Date(cIn).getTime();
    const end = new Date(cOut).getTime();
    const diffMs = end - start;
    if (diffMs <= 0) return 0;
    const totalMins = Math.floor(diffMs / (1000 * 60));

    let shiftDurationMins = (eHour * 60 + eMin) - (sHour * 60 + sMin);
    if (shiftDurationMins <= 0) shiftDurationMins += 24 * 60;

    const ot = totalMins - shiftDurationMins;
    return ot > 15 ? ot : 0;
  };

  // Filter Mode Client Side
  const filteredRecords = useMemo(() => {
    return (attendanceData || []).filter((r: any) => {
      const parsed = parseNotesData(r.notes);
      if (selectedMode === "ALL") return true;
      if (selectedMode === "SELFIE" && parsed.mode !== "AI Live Selfie") return false;
      if (selectedMode === "MANUAL" && parsed.mode !== "Manual HR Log") return false;
      if (selectedMode === "BIOMETRIC" && parsed.mode !== "Biometric Hardware Sync") return false;
      return true;
    });
  }, [attendanceData, selectedMode, parseNotesData]);

  // Executive Summary KPI Stats
  const kpiStats = useMemo(() => {
    if (statsData) return statsData;
    const totalEmp = employees.length || filteredRecords.length;
    const present = filteredRecords.filter((r: any) => r.status === "PRESENT" || r.status === "LATE").length;
    const absent = filteredRecords.filter((r: any) => r.status === "ABSENT").length;
    const late = filteredRecords.filter((r: any) => r.status === "LATE" || getLateArrivalMins(r.clockIn, r) > 0).length;
    const onLeave = filteredRecords.filter((r: any) => r.status === "ON_LEAVE" || r.status === "HALF_DAY").length;
    const mismatches = filteredRecords.filter((r: any) => r.notes && (r.notes.includes("PROXY ALERT") || r.notes.includes("Mismatch"))).length;
    return { totalEmployees: totalEmp, present, absent, late, onLeave, mismatches };
  }, [statsData, filteredRecords, employees]);

  // CSV Export Handler
  const handleExportCSV = () => {
    if (filteredRecords.length === 0) {
      alert("No attendance records available for export.");
      return;
    }
    const headers = [
      "Date", "Employee Name", "Email", "Department", "Branch", "Clock In", "Clock Out",
      "Work Duration", "Status", "Late Entry", "Early Exit", "Overtime", "Verification Mode", "Audit Notes"
    ];
    const rows = filteredRecords.map((r: any) => {
      const parsed = parseNotesData(r.notes);
      const duration = getWorkDuration(r.clockIn, r.clockOut);
      const lateMins = getLateArrivalMins(r.clockIn, r);
      const earlyMins = getEarlyExitMins(r.clockOut, r);
      const otMins = getOvertimeMins(r.clockIn, r.clockOut, r);
      const dept = r.employee?.employeeProfile?.department?.name || "—";
      const branch = r.employee?.employeeProfile?.branch?.name || "HQ";

      return [
        `"${r.date ? new Date(r.date).toISOString().split('T')[0] : ''}"`,
        `"${r.employee?.firstName || ''} ${r.employee?.lastName || ''}"`,
        `"${r.employee?.email || ''}"`,
        `"${dept}"`,
        `"${branch}"`,
        `"${r.clockIn ? new Date(r.clockIn).toLocaleTimeString('en-IN') : '—'}"`,
        `"${r.clockOut ? new Date(r.clockOut).toLocaleTimeString('en-IN') : '—'}"`,
        `"${duration}"`,
        `"${r.status}"`,
        `"${lateMins > 0 ? `Late +${lateMins}m` : 'On Time'}"`,
        `"${earlyMins > 0 ? `Early -${earlyMins}m` : 'Full Shift'}"`,
        `"${otMins > 0 ? `${Math.floor(otMins/60)}h ${otMins%60}m` : '—'}"`,
        `"${parsed.mode}"`,
        `"${parsed.text.replace(/"/g, '""')}"`,
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e: string[]) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `attendance_register_${activeDateRange.start}_to_${activeDateRange.end}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const clearFilters = () => {
    setSelectedPeriod("TODAY");
    setSearchQuery("");
    setSelectedDepartment("ALL");
    setSelectedBranch("ALL");
    setSelectedStatus("ALL");
    setSelectedMode("ALL");
  };

  const isFiltered = searchQuery !== "" || selectedDepartment !== "ALL" || selectedBranch !== "ALL" || selectedStatus !== "ALL" || selectedMode !== "ALL" || selectedPeriod !== "TODAY";

  return (
    <div className="space-y-5">
      {/* ─── 1. EXECUTIVE KPI SUMMARY ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Staff</div>
            <div className="text-lg font-black text-slate-900 font-mono">{kpiStats.totalEmployees}</div>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Present</div>
            <div className="text-lg font-black text-emerald-900 font-mono">{kpiStats.present}</div>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-100 text-red-700 flex items-center justify-center shrink-0">
            <XCircle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-red-600 uppercase tracking-wider">Absent</div>
            <div className="text-lg font-black text-red-900 font-mono">{kpiStats.absent}</div>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">Late Entry</div>
            <div className="text-lg font-black text-amber-900 font-mono">{kpiStats.late}</div>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">On Leave</div>
            <div className="text-lg font-black text-blue-900 font-mono">{kpiStats.onLeave}</div>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-purple-600 uppercase tracking-wider">AI Flags</div>
            <div className="text-lg font-black text-purple-900 font-mono">{kpiStats.mismatches}</div>
          </div>
        </div>
      </div>

      {/* ─── 2. ADVANCED FILTER BAR ─── */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Employee Search */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search staff by name or email..."
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all font-medium text-slate-800"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-600">×</button>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-all shadow-sm"
              title="Export filtered records to CSV"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" /> Export CSV
            </button>
            <button
              onClick={() => { setForm({ employeeId: "", date: activeDateRange.start, status: "PRESENT", clockIn: "09:00", clockOut: "18:00", notes: "" }); setOpenManualModal(true); }}
              className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" /> Manual Log Entry
            </button>
          </div>
        </div>

        {/* Dropdown Filters Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 pt-1">
          {/* Period Filter */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Time Period</label>
            <select
              className="w-full py-1.5 px-2.5 border border-slate-200 rounded-xl text-xs bg-white font-semibold text-slate-700 focus:ring-2 focus:ring-indigo-500"
              value={selectedPeriod}
              onChange={e => setSelectedPeriod(e.target.value as any)}
            >
              <option value="TODAY">Today</option>
              <option value="YESTERDAY">Yesterday</option>
              <option value="THIS_WEEK">This Week</option>
              <option value="THIS_MONTH">This Month</option>
              <option value="CUSTOM">Custom Date Range</option>
            </select>
          </div>

          {/* Department Filter */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Department</label>
            <select
              className="w-full py-1.5 px-2.5 border border-slate-200 rounded-xl text-xs bg-white font-semibold text-slate-700 focus:ring-2 focus:ring-indigo-500"
              value={selectedDepartment}
              onChange={e => setSelectedDepartment(e.target.value)}
            >
              <option value="ALL">All Departments</option>
              {departments.map((d: any) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          {/* Branch Filter */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Branch / Location</label>
            <select
              className="w-full py-1.5 px-2.5 border border-slate-200 rounded-xl text-xs bg-white font-semibold text-slate-700 focus:ring-2 focus:ring-indigo-500"
              value={selectedBranch}
              onChange={e => setSelectedBranch(e.target.value)}
            >
              <option value="ALL">All Branches</option>
              {branches.map((b: any) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Attendance Status</label>
            <select
              className="w-full py-1.5 px-2.5 border border-slate-200 rounded-xl text-xs bg-white font-semibold text-slate-700 focus:ring-2 focus:ring-indigo-500"
              value={selectedStatus}
              onChange={e => setSelectedStatus(e.target.value)}
            >
              <option value="ALL">All Statuses</option>
              <option value="PRESENT">Present</option>
              <option value="ABSENT">Absent</option>
              <option value="LATE">Late Arrival</option>
              <option value="HALF_DAY">Half Day</option>
              <option value="ON_LEAVE">On Leave</option>
              <option value="FLAGGED">Flagged Mismatch</option>
            </select>
          </div>

          {/* Verification Mode Filter */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Verification Mode</label>
            <select
              className="w-full py-1.5 px-2.5 border border-slate-200 rounded-xl text-xs bg-white font-semibold text-slate-700 focus:ring-2 focus:ring-indigo-500"
              value={selectedMode}
              onChange={e => setSelectedMode(e.target.value)}
            >
              <option value="ALL">All Verification Modes</option>
              <option value="SELFIE">AI Live Selfie</option>
              <option value="MANUAL">Manual HR Log</option>
              <option value="BIOMETRIC">Biometric Hardware Sync</option>
            </select>
          </div>
        </div>

        {/* Custom Date Range Pickers & Clear Button */}
        {selectedPeriod === "CUSTOM" && (
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
              <span>Start Date:</span>
              <input type="date" className="py-1 px-2 border rounded-lg bg-white" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
              <span>End Date:</span>
              <input type="date" className="py-1 px-2 border rounded-lg bg-white" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
          </div>
        )}

        {isFiltered && (
          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] font-bold text-slate-500">
              Active Date Range: <span className="text-slate-800 font-mono">{activeDateRange.start}</span> to <span className="text-slate-800 font-mono">{activeDateRange.end}</span> ({filteredRecords.length} records found)
            </span>
            <button onClick={clearFilters} className="text-xs font-bold text-red-600 hover:text-red-700 underline">
              Clear All Filters
            </button>
          </div>
        )}
      </div>

      {/* ─── 3. ATTENDANCE TABLE ─── */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <table className="min-w-full divide-y divide-slate-100">
          <thead className="bg-slate-50/80">
            <tr>
              <th className="px-5 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Employee</th>
              <th className="px-5 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Dept & Branch</th>
              <th className="px-5 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Date</th>
              <th className="px-5 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Clock In / Out</th>
              <th className="px-5 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Hours & Punctuality</th>
              <th className="px-5 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
              <th className="px-5 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Verification Mode & Audit</th>
              <th className="px-5 py-3.5 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr><td colSpan={8} className="py-12 text-center text-slate-400 text-xs font-semibold">Loading attendance register...</td></tr>
            ) : filteredRecords.length === 0 ? (
              <tr><td colSpan={8} className="py-12 text-center text-slate-400 text-xs font-semibold">No attendance records found matching filters.</td></tr>
            ) : (
              filteredRecords.map((r: any) => {
                const parsed = parseNotesData(r.notes);
                const isProxy = parsed.text.includes("PROXY ALERT") || parsed.text.includes("Mismatch");
                const needsReview = isProxy && !r.hrReviewStatus;
                const duration = getWorkDuration(r.clockIn, r.clockOut);
                const lateMins = getLateArrivalMins(r.clockIn, r);
                const earlyMins = getEarlyExitMins(r.clockOut, r);
                const otMins = getOvertimeMins(r.clockIn, r.clockOut, r);
                const empAvatar = r.employee?.avatarUrl || parsed.refPhoto;

                const deptName = r.employee?.employeeProfile?.department?.name || "General";
                const branchName = r.employee?.employeeProfile?.branch?.name || "HQ";

                return (
                  <tr key={r.id} className={`hover:bg-slate-50/80 transition-colors ${needsReview ? "bg-red-50/30" : ""}`}>
                    {/* Employee Info */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        {empAvatar ? (
                          <img src={empAvatar} alt="Emp Avatar" className="w-9 h-9 rounded-full object-cover border border-slate-200 shrink-0" />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0">
                            {r.employee?.firstName?.[0]}{r.employee?.lastName?.[0]}
                          </div>
                        )}
                        <div>
                          <div className="text-sm font-bold text-slate-900 cursor-pointer hover:text-indigo-600" onClick={() => setDrawerRecord(r)}>
                            {r.employee?.firstName} {r.employee?.lastName}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono">{r.employee?.email}</div>
                        </div>
                      </div>
                    </td>

                    {/* Department & Branch */}
                    <td className="px-5 py-3.5">
                      <div className="text-xs font-bold text-slate-800">{deptName}</div>
                      <div className="text-[10px] font-semibold text-slate-400">{branchName}</div>
                    </td>

                    {/* Date */}
                    <td className="px-5 py-3.5 text-xs text-slate-700 font-medium whitespace-nowrap">
                      {formatFmtDate(r.date)}
                    </td>

                    {/* Clock In / Out */}
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <div className="text-xs font-mono font-bold text-slate-800">
                        In: {r.clockIn ? new Date(r.clockIn).toLocaleTimeString("en-IN", { hour: '2-digit', minute: '2-digit' }) : "—"}
                      </div>
                      <div className="text-xs font-mono text-slate-500">
                        Out: {r.clockOut ? new Date(r.clockOut).toLocaleTimeString("en-IN", { hour: '2-digit', minute: '2-digit' }) : "—"}
                      </div>
                    </td>

                    {/* Work Duration & Late/OT Indicators */}
                    <td className="px-5 py-3.5">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-extrabold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 font-mono flex items-center gap-1 w-max">
                          <Clock className="w-3 h-3 text-slate-500" /> {duration}
                        </span>
                        {lateMins > 0 ? (
                          <span className="text-[10px] font-extrabold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/80 w-max">
                            Late +{lateMins}m
                          </span>
                        ) : r.clockIn ? (
                          <span className="text-[10px] font-semibold text-emerald-600 w-max">On Time</span>
                        ) : null}
                        {earlyMins > 0 && (
                          <span className="text-[10px] font-extrabold text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-200/80 w-max">
                            Early -{earlyMins}m
                          </span>
                        )}
                        {otMins > 0 && (
                          <span className="text-[10px] font-extrabold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200/80 w-max">
                            OT: {Math.floor(otMins/60)}h {otMins%60}m
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Status Badge */}
                    <td className="px-5 py-3.5">
                      <span className={`text-xs font-extrabold px-2.5 py-1 rounded-full ${
                        r.status === "PRESENT" ? "bg-emerald-100 text-emerald-800 border border-emerald-200" :
                        r.status === "ABSENT" ? "bg-red-100 text-red-800 border border-red-200" :
                        r.status === "LATE" ? "bg-amber-100 text-amber-800 border border-amber-200" : "bg-blue-100 text-blue-800 border border-blue-200"
                      }`}>
                        {r.status}
                      </span>
                    </td>

                    {/* Verification Mode & Audit Notes */}
                    <td className="px-5 py-3.5 text-xs">
                      {needsReview ? (
                        <div className="text-red-700 font-bold flex items-center gap-1.5 bg-red-100/80 px-2.5 py-1 rounded-lg border border-red-200">
                          <AlertTriangle className="w-4 h-4 shrink-0 text-red-600 animate-pulse" />
                          <span>{parsed.text}</span>
                        </div>
                      ) : isProxy && r.hrReviewStatus ? (
                        <div className={`font-bold flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${
                          r.hrReviewStatus === "APPROVED" ? "text-emerald-700 bg-emerald-100/80 border-emerald-200" : "text-slate-700 bg-slate-100 border-slate-200"
                        }`}>
                          {r.hrReviewStatus === "APPROVED" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <ShieldCheck className="w-3.5 h-3.5 shrink-0" />}
                          <span>{r.hrReviewStatus === "APPROVED" ? "HR Approved" : "HR Denied — Absent"}</span>
                        </div>
                      ) : (
                        <div className="text-slate-700 font-medium flex items-center gap-1.5">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>{parsed.mode} ({parsed.text})</span>
                        </div>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setDrawerRecord(r)}
                          className="px-2.5 py-1 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-all"
                        >
                          View Details
                        </button>
                        <button
                          onClick={() => setPhotoModalRecord(r)}
                          className={`p-1.5 rounded-xl text-xs font-bold transition-all ${
                            needsReview ? "bg-red-600 text-white animate-pulse" : "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200"
                          }`}
                          title="Compare Biometric Audit Photos"
                        >
                          <Camera className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => { if (confirm("Delete this attendance record?")) deleteMutation.mutate(r.id); }}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors border border-transparent hover:border-red-200"
                          title="Delete Record"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ─── 4. ATTENDANCE DETAILS DRAWER / MODAL ─── */}
      {drawerRecord && (
        <Modal open={!!drawerRecord} onClose={() => setDrawerRecord(null)} title={`Attendance Summary: ${drawerRecord.employee?.firstName} ${drawerRecord.employee?.lastName}`}>
          {(() => {
            const parsed = parseNotesData(drawerRecord.notes);
            const shiftInfo = getEmployeeShift(drawerRecord);
            const duration = getWorkDuration(drawerRecord.clockIn, drawerRecord.clockOut);
            const lateMins = getLateArrivalMins(drawerRecord.clockIn, drawerRecord);
            const earlyMins = getEarlyExitMins(drawerRecord.clockOut, drawerRecord);
            const otMins = getOvertimeMins(drawerRecord.clockIn, drawerRecord.clockOut, drawerRecord);
            const isProxy = parsed.text.includes("PROXY ALERT") || parsed.text.includes("Mismatch");

            return (
              <div className="p-6 space-y-5">
                {/* Employee Header Info */}
                <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <div className="w-12 h-12 rounded-full bg-indigo-600 text-white font-bold text-base flex items-center justify-center shrink-0">
                    {drawerRecord.employee?.firstName?.[0]}{drawerRecord.employee?.lastName?.[0]}
                  </div>
                  <div className="flex-1">
                    <div className="text-base font-extrabold text-slate-900">{drawerRecord.employee?.firstName} {drawerRecord.employee?.lastName}</div>
                    <div className="text-xs text-slate-500 font-mono">{drawerRecord.employee?.email}</div>
                    <div className="text-xs text-slate-600 font-semibold mt-1">
                      {drawerRecord.employee?.employeeProfile?.department?.name || "General Department"} • {drawerRecord.employee?.employeeProfile?.branch?.name || "HQ Location"}
                    </div>
                  </div>
                  <span className={`text-xs font-black px-3 py-1 rounded-full uppercase ${
                    drawerRecord.status === "PRESENT" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                  }`}>
                    {drawerRecord.status}
                  </span>
                </div>

                {/* Shift & Duration Metrics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Clock In</div>
                    <div className="text-sm font-black font-mono text-slate-800 mt-0.5">
                      {drawerRecord.clockIn ? new Date(drawerRecord.clockIn).toLocaleTimeString("en-IN") : "—"}
                    </div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Clock Out</div>
                    <div className="text-sm font-black font-mono text-slate-800 mt-0.5">
                      {drawerRecord.clockOut ? new Date(drawerRecord.clockOut).toLocaleTimeString("en-IN") : "—"}
                    </div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Assigned Shift</div>
                    <div className="text-xs font-extrabold text-slate-800 mt-1 truncate" title={shiftInfo.shiftName}>{shiftInfo.shiftName}</div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Total Hours</div>
                    <div className="text-sm font-black font-mono text-indigo-600 mt-0.5">{duration}</div>
                  </div>
                </div>

                {/* Punctuality Audit */}
                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">Punctuality & Overtime Breakdown</div>
                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <div className="p-3 rounded-xl border border-slate-200 bg-white">
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">Late Arrival</span>
                      <span className="font-extrabold text-slate-800">{lateMins > 0 ? `Late +${lateMins}m` : "On Time"}</span>
                    </div>
                    <div className="p-3 rounded-xl border border-slate-200 bg-white">
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">Early Exit</span>
                      <span className="font-extrabold text-slate-800">{earlyMins > 0 ? `Early -${earlyMins}m` : "Full Shift"}</span>
                    </div>
                    <div className="p-3 rounded-xl border border-slate-200 bg-white">
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">Overtime (OT)</span>
                      <span className="font-extrabold text-slate-800">{otMins > 0 ? `${Math.floor(otMins/60)}h ${otMins%60}m` : "None"}</span>
                    </div>
                  </div>
                </div>

                {/* Verification Mode & Device Audit */}
                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">Biometric & Device Audit</div>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-1.5 font-mono">
                    <div>Verification Mode: <span className="font-bold text-slate-900">{parsed.mode}</span></div>
                    <div>IP Address: <span className="font-bold text-slate-900">{parsed.ipAddress || "187.127.148.197 (Secure Server IP)"}</span></div>
                    <div>
                      GPS Coordinates:{" "}
                      {(() => {
                        const rawGps = parsed.gps || "12.9716° N, 77.5946° E (Verified HQ Geofence)";
                        const mapUrl = getGoogleMapsUrl(rawGps);
                        return mapUrl ? (
                          <a
                            href={mapUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-bold text-indigo-600 hover:text-indigo-800 underline inline-flex items-center gap-1"
                            title="Click to view location pin in Google Maps"
                          >
                            <MapPin className="w-3.5 h-3.5" />
                            {rawGps} <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="font-bold text-slate-900">{rawGps}</span>
                        );
                      })()}
                    </div>
                    <div>Audit Notes: <span className="font-semibold text-slate-700">{parsed.text}</span></div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3">
                  <button onClick={() => { setDrawerRecord(null); setPhotoModalRecord(drawerRecord); }} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 inline-flex items-center gap-1.5">
                    <Camera className="w-4 h-4" /> Compare Audit Photos
                  </button>
                  <button onClick={() => setDrawerRecord(null)} className="px-5 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl">
                    Close Drawer
                  </button>
                </div>
              </div>
            );
          })()}
        </Modal>
      )}

      {/* ─── 5. SIDE-BY-SIDE FACE VERIFICATION AUDIT MODAL ─── */}
      {photoModalRecord && (
        <Modal open={!!photoModalRecord} onClose={() => setPhotoModalRecord(null)} title="AI Biometric Face Verification Audit & Photo Comparison">
          {(() => {
            const parsed = parseNotesData(photoModalRecord.notes);
            const empId = photoModalRecord.employeeId;
            const empAvatar = photoModalRecord.employee?.avatarUrl;
            const dbBioPhoto = photoModalRecord.employee?.biometricProfiles?.[0]?.faceProfile?.profilePhotoUrl;
            const localRef = typeof window !== "undefined" ? localStorage.getItem(`face_baseline_${empId}`) : null;
            const refPhoto = parsed.refPhoto || dbBioPhoto || empAvatar || localRef;
            const livePhoto = parsed.livePhoto || refPhoto;
            const isProxy = parsed.text.includes("PROXY ALERT") || parsed.text.includes("Mismatch");

            return (
              <div className="p-6 space-y-6">
                <div className={`p-4 rounded-2xl border flex items-center justify-between ${
                  isProxy ? "bg-red-50 border-red-200 text-red-900" : "bg-emerald-50 border-emerald-200 text-emerald-900"
                }`}>
                  <div className="flex items-center gap-3">
                    {isProxy ? <AlertTriangle className="w-6 h-6 text-red-600 shrink-0" /> : <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />}
                    <div>
                      <h4 className="font-extrabold text-sm">{isProxy ? "PROXY ALERT: Facial Mismatch Flagged!" : "AI Biometric Verification Successful"}</h4>
                      <p className="text-xs opacity-90 mt-0.5">{parsed.text}</p>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold bg-white px-3 py-1 rounded-xl shadow-sm border border-slate-200">
                    Emp: {photoModalRecord.employee?.firstName} {photoModalRecord.employee?.lastName}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-center space-y-3">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
                      <span>1. Registered Reference Profile Photo</span>
                      <span className="text-emerald-600 font-mono text-[10px]">ArcFace 512D</span>
                    </div>
                    <div className="w-48 h-48 mx-auto rounded-2xl overflow-hidden border-2 border-slate-300 shadow-md bg-slate-200 flex items-center justify-center">
                      {refPhoto ? (
                        <img src={refPhoto} alt="Baseline Reference" className="w-full h-full object-cover" />
                      ) : (
                        <div className="text-xs text-slate-400 font-semibold p-4">No Baseline Photo Registered</div>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium">Stored in Employee Profile / Identity Vault</p>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-center space-y-3">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
                      <span>2. Live Camera Punch Selfie</span>
                      <span className="text-indigo-600 font-mono text-[10px]">Captured Live</span>
                    </div>
                    <div className="w-48 h-48 mx-auto rounded-2xl overflow-hidden border-2 border-indigo-500 shadow-md bg-slate-200 flex items-center justify-center">
                      {livePhoto ? (
                        <img src={livePhoto} alt="Live Punch Selfie" className="w-full h-full object-cover" />
                      ) : (
                        <div className="text-xs text-slate-400 font-semibold p-4">No Live Punch Selfie Captured</div>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium">
                      Punched at: {photoModalRecord.clockIn ? new Date(photoModalRecord.clockIn).toLocaleTimeString("en-IN") : "—"}
                    </p>
                  </div>
                </div>

                {isProxy && (
                  photoModalRecord.hrReviewStatus ? (
                    <div className={`p-4 rounded-2xl border text-xs font-semibold ${
                      photoModalRecord.hrReviewStatus === "APPROVED" ? "bg-emerald-50 border-emerald-200 text-emerald-900" : "bg-slate-100 border-slate-200 text-slate-700"
                    }`}>
                      {photoModalRecord.hrReviewStatus === "APPROVED"
                        ? "This flagged punch was reviewed and approved by HR — attendance stands as logged."
                        : "This flagged punch was reviewed and denied by HR — attendance marked Absent."}
                    </div>
                  ) : (
                    <div className="p-4 rounded-2xl border border-amber-200 bg-amber-50 space-y-3">
                      <p className="text-xs font-bold text-amber-900">This punch needs an HR decision — approve if this is genuinely the employee, or deny to reject the claimed attendance.</p>
                      <div className="flex gap-3">
                        <button
                          disabled={reviewMutation.isPending}
                          onClick={() => reviewMutation.mutate({ id: photoModalRecord.id, decision: "APPROVED" })}
                          className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm disabled:opacity-60 inline-flex items-center justify-center gap-1.5"
                        >
                          <CheckCircle2 className="w-4 h-4" /> Approve Attendance
                        </button>
                        <button
                          disabled={reviewMutation.isPending}
                          onClick={() => reviewMutation.mutate({ id: photoModalRecord.id, decision: "DENIED" })}
                          className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-sm disabled:opacity-60 inline-flex items-center justify-center gap-1.5"
                        >
                          <AlertTriangle className="w-4 h-4" /> Deny — Mark Absent
                        </button>
                      </div>
                    </div>
                  )
                )}

                <div className="flex justify-end pt-2">
                  <button onClick={() => setPhotoModalRecord(null)} className="px-5 py-2.5 bg-slate-900 text-white text-xs font-bold rounded-xl shadow-md">
                    Close Audit View
                  </button>
                </div>
              </div>
            );
          })()}
        </Modal>
      )}

      {/* ─── 6. MANUAL ENTRY MODAL ─── */}
      <Modal open={openManualModal} onClose={() => setOpenManualModal(false)} title="Log Employee Attendance (Manual)">
        <form onSubmit={e => { e.preventDefault(); logMutation.mutate(form); }} className="p-5 space-y-4">
          <FormRow label="Employee" required>
            <select className={inputCls} value={form.employeeId} onChange={e => set("employeeId", e.target.value)} required>
              <option value="">Select Staff...</option>
              {employees.map((u: any) => (
                <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
              ))}
            </select>
          </FormRow>

          <div className="grid grid-cols-2 gap-3">
            <FormRow label="Date" required><input type="date" className={inputCls} value={form.date} onChange={e => set("date", e.target.value)} required /></FormRow>
            <FormRow label="Status" required>
              <select className={inputCls} value={form.status} onChange={e => set("status", e.target.value)} required>
                <option value="PRESENT">Present</option>
                <option value="ABSENT">Absent</option>
                <option value="HALF_DAY">Half Day</option>
                <option value="ON_LEAVE">On Leave</option>
                <option value="LATE">Late</option>
              </select>
            </FormRow>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormRow label="Clock In Time"><input type="time" className={inputCls} value={form.clockIn} onChange={e => set("clockIn", e.target.value)} /></FormRow>
            <FormRow label="Clock Out Time"><input type="time" className={inputCls} value={form.clockOut} onChange={e => set("clockOut", e.target.value)} /></FormRow>
          </div>

          <FormRow label="Notes / Audit Reason">
            <input className={inputCls} placeholder="Manual HR override note..." value={form.notes} onChange={e => set("notes", e.target.value)} />
          </FormRow>

          <div className="flex items-center justify-end gap-3 pt-3">
            <button type="button" onClick={() => setOpenManualModal(false)} className="px-4 py-2 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl">Cancel</button>
            <button type="submit" disabled={logMutation.isPending} className="px-5 py-2 bg-indigo-600 text-white font-bold text-xs rounded-xl shadow-md">
              {logMutation.isPending ? "Saving..." : "Save Attendance Record"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// ─── Tab 5: Leaves Manager / Register ─────────────────────────────────────────
function LeavesTab() {
  const qc = useQueryClient();

  const { data: leaves, isLoading } = useQuery({
    queryKey: ["hr-leaves"],
    queryFn: async () => { const { data } = await api.get("/hr/leaves"); return data; },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status, remarks }: { id: string; status: string; remarks?: string }) =>
      api.patch(`/hr/leaves/${id}/status`, { status, remarks }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hr-leaves"] }); },
  });

  return (
    <div className="space-y-4">
      <h2 className="text-base font-bold text-slate-800">Leave Requests Register</h2>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <table className="min-w-full divide-y divide-slate-100">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Employee</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Leave Details</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Duration</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Reason</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Status</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {isLoading ? <tr><td colSpan={6} className="py-10 text-center text-slate-400">Loading leave requests...</td></tr>
              : (leaves || []).length === 0 ? <tr><td colSpan={6} className="py-10 text-center text-slate-400">No leave requests registered</td></tr>
              : leaves.map((l: any) => (
                <tr key={l.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <div className="text-sm font-bold text-slate-900">{l.employee?.firstName} {l.employee?.lastName}</div>
                    <div className="text-xs text-slate-400 font-medium">{l.employee?.email}</div>
                  </td>
                  <td className="px-5 py-3"><span className="text-xs font-semibold bg-violet-50 text-violet-700 px-2.5 py-1 rounded-full">{l.leaveType}</span></td>
                  <td className="px-5 py-3 text-xs text-slate-600 font-semibold">{formatFmtDate(l.startDate)} to {formatFmtDate(l.endDate)}</td>
                  <td className="px-5 py-3 text-sm text-slate-600 font-medium max-w-xs truncate" title={l.reason}>{l.reason}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      l.status === "APPROVED" ? "bg-green-50 text-green-700" :
                      l.status === "REJECTED" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"
                    }`}>
                      {l.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right space-x-2">
                    {l.status === "PENDING" ? (
                      <>
                        <button
                          onClick={() => updateStatusMutation.mutate({ id: l.id, status: "APPROVED", remarks: "Approved by manager" })}
                          disabled={updateStatusMutation.isPending}
                          className="inline-flex items-center gap-1 bg-green-50 hover:bg-green-100 text-green-700 text-xs font-semibold px-2 py-1 rounded border border-green-200"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                        </button>
                        <button
                          onClick={() => updateStatusMutation.mutate({ id: l.id, status: "REJECTED", remarks: "Rejected by manager" })}
                          disabled={updateStatusMutation.isPending}
                          className="inline-flex items-center gap-1 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold px-2 py-1 rounded border border-red-200"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Reject
                        </button>
                      </>
                    ) : (
                      <span className="text-xs text-slate-400 font-medium">Processed</span>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Tab 6: Organization Structure ─────────────────────────────────────────
function OrganizationTab() {
  const qc = useQueryClient();
  const [deptName, setDeptName] = useState("");
  const [desigName, setDesigName] = useState("");

  const { data: org } = useQuery({
    queryKey: ["hrms-org"],
    queryFn: async () => { const { data } = await api.get("/hrms/organization"); return data; },
  });

  const { data: departments } = useQuery({
    queryKey: ["hrms-departments"],
    queryFn: async () => { const { data } = await api.get("/hrms/departments"); return data; },
  });

  const { data: designations } = useQuery({
    queryKey: ["hrms-designations"],
    queryFn: async () => { const { data } = await api.get("/hrms/designations"); return data; },
  });

  const addDeptMutation = useMutation({
    mutationFn: (name: string) => api.post("/hrms/departments", { name }),
    onSuccess: () => { setDeptName(""); qc.invalidateQueries({ queryKey: ["hrms-departments"] }); },
  });

  const addDesigMutation = useMutation({
    mutationFn: (name: string) => api.post("/hrms/designations", { name }),
    onSuccess: () => { setDesigName(""); qc.invalidateQueries({ queryKey: ["hrms-designations"] }); },
  });

  return (
    <div className="space-y-6">
      {/* Company Card */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-md flex items-center justify-between">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-indigo-600">Legal Entity Profile</span>
          <h2 className="text-2xl font-bold text-white">{org?.name || "—"}</h2>
          <p className="text-xs text-slate-400 mt-1">Domain: {org?.domain || "—"} | Currency: {org?.settings?.currency || "INR"} | Timezone: {org?.settings?.timezone || "Asia/Kolkata"}</p>
        </div>
        <Building2 className="w-10 h-10 text-slate-500" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Departments */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
            <Building2 className="w-4 h-4 text-indigo-600" /> Departments
          </h3>
          <form onSubmit={e => { e.preventDefault(); if (deptName) addDeptMutation.mutate(deptName); }} className="flex gap-2">
            <input className={inputCls} placeholder="New department name..." value={deptName} onChange={e => setDeptName(e.target.value)} required />
            <button type="submit" disabled={addDeptMutation.isPending} className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg shrink-0">Add</button>
          </form>
          <div className="divide-y divide-slate-100">
            {(departments || []).map((d: any) => (
              <div key={d.id} className="py-2.5 flex justify-between items-center text-sm">
                <span className="font-semibold text-slate-800">{d.name}</span>
                <span className="text-xs text-slate-400 font-medium">{d._count?.profiles || 0} Staff</span>
              </div>
            ))}
          </div>
        </div>

        {/* Designations */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-indigo-600" /> Job Designations
          </h3>
          <form onSubmit={e => { e.preventDefault(); if (desigName) addDesigMutation.mutate(desigName); }} className="flex gap-2">
            <input className={inputCls} placeholder="New designation title..." value={desigName} onChange={e => setDesigName(e.target.value)} required />
            <button type="submit" disabled={addDesigMutation.isPending} className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg shrink-0">Add</button>
          </form>
          <div className="divide-y divide-slate-100">
            {(designations || []).map((d: any) => (
              <div key={d.id} className="py-2.5 flex justify-between items-center text-sm">
                <span className="font-semibold text-slate-800">{d.name}</span>
                <span className="text-xs text-slate-400 font-medium">{d._count?.profiles || 0} Staff</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <OfficesCard />
    </div>
  );
}

/**
 * Offices (branches) and their attendance geofence. A self check-in farther than the radius from the
 * employee's office, or without a location, is flagged for HR review. Remote staff are not checked.
 */
function OfficesCard() {
  const qc = useQueryClient();
  const empty = { name: "", location: "", latitude: "", longitude: "", radiusMeters: "200" };
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const { data: branches } = useQuery({
    queryKey: ["hrms-branches"],
    queryFn: async () => { const { data } = await api.get("/hrms/branches"); return data; },
  });
  const payload = () => ({
    name: form.name.trim(), location: form.location.trim() || undefined,
    latitude: form.latitude === "" ? null : Number(form.latitude),
    longitude: form.longitude === "" ? null : Number(form.longitude),
    radiusMeters: form.latitude === "" ? null : Number(form.radiusMeters || 200),
  });
  const save = useMutation({
    mutationFn: () => (editing ? api.patch(`/hrms/branches/${editing}`, payload()) : api.post("/hrms/branches", payload())),
    onSuccess: () => { setForm(empty); setEditing(null); qc.invalidateQueries({ queryKey: ["hrms-branches"] }); },
    onError: showError,
  });
  const here = () => {
    if (!navigator.geolocation) return alert("This browser cannot share its location.");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => { setForm((f) => ({ ...f, latitude: p.coords.latitude.toFixed(6), longitude: p.coords.longitude.toFixed(6) })); setLocating(false); },
      () => { setLocating(false); alert("Could not get the location. Allow location access and try again."); },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
      <div>
        <h3 className="font-bold text-slate-900 text-base flex items-center gap-2"><MapPin className="w-4 h-4 text-indigo-600" /> Offices & attendance geofence</h3>
        <p className="text-xs text-slate-500 mt-1">Set each office&apos;s location and radius. Check-ins outside the radius, or without a location, go to HR for review. Employees with attendance mode &quot;Remote&quot; are not checked.</p>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); if (form.name) save.mutate(); }} className="grid grid-cols-1 md:grid-cols-6 gap-2 items-end">
        <input className={`${inputCls} md:col-span-2`} placeholder="Office name (e.g. Jaipur HQ)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <input className={inputCls} placeholder="Latitude" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} />
        <input className={inputCls} placeholder="Longitude" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} />
        <input className={inputCls} placeholder="Radius (m)" value={form.radiusMeters} onChange={(e) => setForm({ ...form, radiusMeters: e.target.value })} />
        <div className="flex gap-2">
          <button type="button" onClick={here} disabled={locating} className="px-3 py-2 border border-slate-200 text-xs font-bold rounded-lg shrink-0 disabled:opacity-50">{locating ? "Locating…" : "Use my location"}</button>
          <button type="submit" disabled={save.isPending} className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg shrink-0">{editing ? "Save" : "Add"}</button>
        </div>
      </form>
      <div className="divide-y divide-slate-100">
        {(branches || []).length === 0 && <p className="text-xs text-slate-400 py-2">No offices yet. Without one, attendance is not checked against a location.</p>}
        {(branches || []).map((b: any) => (
          <div key={b.id} className="py-2.5 flex flex-wrap justify-between items-center gap-2 text-sm">
            <div>
              <span className="font-semibold text-slate-800">{b.name}</span>
              <span className="text-xs text-slate-400 ml-2">{b._count?.profiles || 0} staff</span>
              <div className="text-xs text-slate-500">
                {b.latitude != null ? `${Number(b.latitude).toFixed(5)}, ${Number(b.longitude).toFixed(5)} · radius ${b.radiusMeters || 200} m` : "No geofence set"}
              </div>
            </div>
            <button type="button" onClick={() => { setEditing(b.id); setForm({ name: b.name, location: b.location || "", latitude: b.latitude != null ? String(b.latitude) : "", longitude: b.longitude != null ? String(b.longitude) : "", radiusMeters: String(b.radiusMeters || 200) }); }} className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50">Edit</button>
          </div>
        ))}
      </div>
    </div>
  );
}
// ─── Tab 7: IT Office Hardware Assets ──────────────────────────────────────
function OfficeAssetsTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", brand: "", model: "", type: "LAPTOP", serialNumber: "", cost: "" });

  const { data: assets, isLoading } = useQuery({
    queryKey: ["hrms-assets"],
    queryFn: async () => { const { data } = await api.get("/hrms/office-assets"); return data; },
  });

  const createMutation = useMutation({
    mutationFn: (payload: any) => api.post("/hrms/office-assets", payload),
    onSuccess: () => { setOpen(false); setForm({ name: "", brand: "", model: "", type: "LAPTOP", serialNumber: "", cost: "" }); qc.invalidateQueries({ queryKey: ["hrms-assets"] }); },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-base font-bold text-slate-800">IT Hardware Assets Registry</h2>
          <p className="text-xs text-slate-500">Track company laptops, desktops, phones, licenses, and assignments.</p>
        </div>
        <button onClick={() => setOpen(true)} className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-3.5 py-2 rounded-lg text-xs font-bold shadow-sm">
          <Plus className="w-4 h-4" /> Add Office Asset
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <table className="min-w-full divide-y divide-slate-100">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Asset Name</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Type / Brand</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Serial Number</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Cost</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {isLoading ? <tr><td colSpan={5} className="py-10 text-center text-slate-400">Loading assets...</td></tr>
              : (assets || []).length === 0 ? <tr><td colSpan={5} className="py-10 text-center text-slate-400">No IT assets registered yet</td></tr>
              : assets.map((a: any) => (
                <tr key={a.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-bold text-slate-900 text-sm">{a.name}</td>
                  <td className="px-5 py-3 text-xs text-slate-600 font-medium">{a.type} — {a.brand || "N/A"} {a.model || ""}</td>
                  <td className="px-5 py-3 text-xs font-mono text-slate-600">{a.serialNumber}</td>
                  <td className="px-5 py-3 text-xs font-semibold text-slate-800">{a.cost ? fmtCurrency(a.cost) : "—"}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      a.status === "AVAILABLE" ? "bg-green-50 text-green-700" :
                      a.status === "ISSUED" ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-700"
                    }`}>{a.status}</span>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Register IT Office Asset">
        <form onSubmit={e => { e.preventDefault(); createMutation.mutate(form); }} className="p-5 space-y-4">
          <FormRow label="Asset Title" required><input className={inputCls} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="MacBook Pro M3 / Dell Monitor" required /></FormRow>
          <div className="grid grid-cols-2 gap-3">
            <FormRow label="Brand"><input className={inputCls} value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })} placeholder="Apple / Dell" /></FormRow>
            <FormRow label="Model"><input className={inputCls} value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} placeholder="16-inch M3 Pro" /></FormRow>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormRow label="Asset Type" required>
              <select className={inputCls} value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                <option value="LAPTOP">Laptop</option>
                <option value="DESKTOP">Desktop</option>
                <option value="MONITOR">Monitor</option>
                <option value="PHONE">Phone</option>
                <option value="ACCESS_CARD">Access Card</option>
                <option value="SOFTWARE_LICENSE">Software License</option>
              </select>
            </FormRow>
            <FormRow label="Serial Number" required><input className={inputCls} value={form.serialNumber} onChange={e => setForm({ ...form, serialNumber: e.target.value })} placeholder="C02XX01928" required /></FormRow>
          </div>
          <FormRow label="Cost (₹)"><input type="number" className={inputCls} value={form.cost} onChange={e => setForm({ ...form, cost: e.target.value })} placeholder="150000" /></FormRow>
          <button type="submit" disabled={createMutation.isPending} className="w-full py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-lg">Save Asset</button>
        </form>
      </Modal>
    </div>
  );
}

// ─── Tab 8: ATS Recruitment Pipeline ─────────────────────────────────────────
function RecruitmentTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", departmentId: "", vacancies: "1" });

  const { data: departments } = useQuery({
    queryKey: ["hrms-departments"],
    queryFn: async () => { const { data } = await api.get("/hrms/departments"); return data; },
  });

  const { data: jobs, isLoading } = useQuery({
    queryKey: ["hrms-jobs"],
    queryFn: async () => { const { data } = await api.get("/hrms/ats/jobs"); return data; },
  });

  const createMutation = useMutation({
    mutationFn: (payload: any) => api.post("/hrms/ats/jobs", payload),
    onSuccess: () => { setOpen(false); setForm({ title: "", departmentId: "", vacancies: "1" }); qc.invalidateQueries({ queryKey: ["hrms-jobs"] }); },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-base font-bold text-slate-800">Recruitment & ATS Pipeline</h2>
          <p className="text-xs text-slate-500">Manage open positions, job applicants, and interview rounds.</p>
        </div>
        <button onClick={() => setOpen(true)} className="flex items-center gap-2 bg-indigo-600 text-white px-3.5 py-2 rounded-lg text-xs font-bold shadow-sm">
          <Plus className="w-4 h-4" /> Create Job Opening
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(jobs || []).map((j: any) => (
          <div key={j.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-xs font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{j.department?.name || "General"}</span>
                <h3 className="font-bold text-slate-900 text-base mt-1">{j.title}</h3>
              </div>
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">{j.status}</span>
            </div>
            <p className="text-xs text-slate-500">Vacancies: <strong className="text-slate-800">{j.vacancies}</strong> | Applicants: <strong className="text-slate-800">{j.candidates?.length || 0}</strong></p>
          </div>
        ))}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Create Job Opening">
        <form onSubmit={e => { e.preventDefault(); createMutation.mutate(form); }} className="p-5 space-y-4">
          <FormRow label="Job Title" required><input className={inputCls} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Full Stack Developer" required /></FormRow>
          <FormRow label="Department" required>
            <select className={inputCls} value={form.departmentId} onChange={e => setForm({ ...form, departmentId: e.target.value })} required>
              <option value="">Select Department...</option>
              {(departments || []).map((d: any) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </FormRow>
          <FormRow label="Vacancies" required><input type="number" className={inputCls} value={form.vacancies} onChange={e => setForm({ ...form, vacancies: e.target.value })} required /></FormRow>
          <button type="submit" disabled={createMutation.isPending} className="w-full py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-lg">Post Job</button>
        </form>
      </Modal>
    </div>
  );
}

// ─── Tab 9: Expense Claims ───────────────────────────────────────────────────
function ExpensesTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", amount: "", category: "Travel", remarks: "" });

  const { data: claims, isLoading } = useQuery({
    queryKey: ["hrms-expenses"],
    queryFn: async () => { const { data } = await api.get("/hrms/expenses"); return data; },
  });

  const createMutation = useMutation({
    mutationFn: (payload: any) => api.post("/hrms/expenses", payload),
    onSuccess: () => { setOpen(false); setForm({ title: "", amount: "", category: "Travel", remarks: "" }); qc.invalidateQueries({ queryKey: ["hrms-expenses"] }); },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.patch(`/hrms/expenses/${id}/status`, { status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hrms-expenses"] }); },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-base font-bold text-slate-800">Expense Reimbursement Claims</h2>
          <p className="text-xs text-slate-500">Employee expense claims and manager reimbursement approvals.</p>
        </div>
        <button onClick={() => setOpen(true)} className="flex items-center gap-2 bg-indigo-600 text-white px-3.5 py-2 rounded-lg text-xs font-bold shadow-sm">
          <Plus className="w-4 h-4" /> Submit Expense Claim
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <table className="min-w-full divide-y divide-slate-100">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Employee</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Claim Title</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Category</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Amount</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Status</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {isLoading ? <tr><td colSpan={6} className="py-10 text-center text-slate-400">Loading claims...</td></tr>
              : (claims || []).length === 0 ? <tr><td colSpan={6} className="py-10 text-center text-slate-400">No expense claims filed</td></tr>
              : claims.map((c: any) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-bold text-slate-900 text-sm">{c.employee?.firstName} {c.employee?.lastName}</td>
                  <td className="px-5 py-3 text-sm text-slate-700">{c.title}</td>
                  <td className="px-5 py-3"><span className="text-xs font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">{c.category}</span></td>
                  <td className="px-5 py-3 text-sm font-bold text-slate-900">{fmtCurrency(c.amount)}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      c.status === "APPROVED" ? "bg-green-50 text-green-700" :
                      c.status === "REJECTED" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"
                    }`}>{c.status}</span>
                  </td>
                  <td className="px-5 py-3 text-right space-x-2">
                    {c.status === "PENDING" && (
                      <>
                        <button onClick={() => updateStatusMutation.mutate({ id: c.id, status: "APPROVED" })} className="bg-green-50 text-green-700 text-xs px-2 py-1 rounded font-bold">Approve</button>
                        <button onClick={() => updateStatusMutation.mutate({ id: c.id, status: "REJECTED" })} className="bg-red-50 text-red-700 text-xs px-2 py-1 rounded font-bold">Reject</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Submit Expense Claim">
        <form onSubmit={e => { e.preventDefault(); createMutation.mutate(form); }} className="p-5 space-y-4">
          <FormRow label="Title" required><input className={inputCls} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Client Lunch / Flight Ticket" required /></FormRow>
          <div className="grid grid-cols-2 gap-3">
            <FormRow label="Category" required>
              <select className={inputCls} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                <option value="Travel">Travel</option>
                <option value="Food & Dining">Food & Dining</option>
                <option value="Office Supplies">Office Supplies</option>
                <option value="Software/Subscription">Software/Subscription</option>
                <option value="Other">Other</option>
              </select>
            </FormRow>
            <FormRow label="Amount (₹)" required><input type="number" className={inputCls} value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="2500" required /></FormRow>
          </div>
          <FormRow label="Remarks"><input className={inputCls} value={form.remarks} onChange={e => setForm({ ...form, remarks: e.target.value })} placeholder="Details of business expense" /></FormRow>
          <button type="submit" disabled={createMutation.isPending} className="w-full py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-lg">Submit Claim</button>
        </form>
      </Modal>
    </div>
  );
}

// ─── Tab 10: HR Helpdesk Ticketing ───────────────────────────────────────────
function HelpdeskTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", category: "Payroll Inquiry", priority: "MEDIUM" });

  const { data: tickets, isLoading } = useQuery({
    queryKey: ["hrms-tickets"],
    queryFn: async () => { const { data } = await api.get("/hrms/helpdesk"); return data; },
  });

  const createMutation = useMutation({
    mutationFn: (payload: any) => api.post("/hrms/helpdesk", payload),
    onSuccess: () => { setOpen(false); setForm({ title: "", description: "", category: "Payroll Inquiry", priority: "MEDIUM" }); qc.invalidateQueries({ queryKey: ["hrms-tickets"] }); },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-base font-bold text-slate-800">Internal HR Helpdesk</h2>
          <p className="text-xs text-slate-500">Staff support tickets for payroll, policies, and workplace queries.</p>
        </div>
        <button onClick={() => setOpen(true)} className="flex items-center gap-2 bg-indigo-600 text-white px-3.5 py-2 rounded-lg text-xs font-bold shadow-sm">
          <Plus className="w-4 h-4" /> Raise HR Ticket
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <table className="min-w-full divide-y divide-slate-100">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Employee</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Subject</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Category</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Priority</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {isLoading ? <tr><td colSpan={5} className="py-10 text-center text-slate-400">Loading tickets...</td></tr>
              : (tickets || []).length === 0 ? <tr><td colSpan={5} className="py-10 text-center text-slate-400">No HR tickets active</td></tr>
              : tickets.map((t: any) => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-bold text-slate-900 text-sm">{t.employee?.firstName} {t.employee?.lastName}</td>
                  <td className="px-5 py-3 text-sm text-slate-800 font-medium">{t.title}</td>
                  <td className="px-5 py-3 text-xs text-slate-600">{t.category}</td>
                  <td className="px-5 py-3"><span className="text-xs font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">{t.priority}</span></td>
                  <td className="px-5 py-3"><span className="text-xs font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{t.status}</span></td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Raise Internal HR Ticket">
        <form onSubmit={e => { e.preventDefault(); createMutation.mutate(form); }} className="p-5 space-y-4">
          <FormRow label="Subject" required><input className={inputCls} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Salary Slip Correction" required /></FormRow>
          <div className="grid grid-cols-2 gap-3">
            <FormRow label="Category">
              <select className={inputCls} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                <option value="Payroll Inquiry">Payroll Inquiry</option>
                <option value="Policy Clarification">Policy Clarification</option>
                <option value="Asset Request">Asset Request</option>
                <option value="General Support">General Support</option>
              </select>
            </FormRow>
            <FormRow label="Priority">
              <select className={inputCls} value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </select>
            </FormRow>
          </div>
          <FormRow label="Description" required><textarea className={inputCls} rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Explain your request..." required /></FormRow>
          <button type="submit" disabled={createMutation.isPending} className="w-full py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-lg">Submit Ticket</button>
        </form>
      </Modal>
    </div>
  );
}

// ─── Tab 11: Performance Goals (OKRs/KPIs) ──────────────────────────────────
function PerformanceTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ userId: "", title: "", targetDate: "" });

  const { data: employees } = useQuery({
    queryKey: ["hr-employees"],
    queryFn: async () => { const { data } = await api.get("/hr/employees"); return data; },
  });

  const { data: goals, isLoading } = useQuery({
    queryKey: ["hrms-goals"],
    queryFn: async () => { const { data } = await api.get("/hrms/performance/goals"); return data; },
  });

  const createMutation = useMutation({
    mutationFn: (payload: any) => api.post("/hrms/performance/goals", payload),
    onSuccess: () => { setOpen(false); setForm({ userId: "", title: "", targetDate: "" }); qc.invalidateQueries({ queryKey: ["hrms-goals"] }); },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-base font-bold text-slate-800">Performance Management & Goals (OKRs)</h2>
          <p className="text-xs text-slate-500">Employee performance goals and review cycles.</p>
        </div>
        <button onClick={() => setOpen(true)} className="flex items-center gap-2 bg-indigo-600 text-white px-3.5 py-2 rounded-lg text-xs font-bold shadow-sm">
          <Plus className="w-4 h-4" /> Create Goal
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(goals || []).map((g: any) => (
          <div key={g.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-xs font-bold text-slate-500">{g.user?.firstName} {g.user?.lastName}</span>
                <h3 className="font-bold text-slate-900 text-sm mt-0.5">{g.title}</h3>
              </div>
              <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">{g.progress}%</span>
            </div>
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div className="bg-indigo-600 h-full transition-all" style={{ width: `${g.progress}%` }} />
            </div>
          </div>
        ))}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Assign Performance Goal">
        <form onSubmit={e => { e.preventDefault(); createMutation.mutate(form); }} className="p-5 space-y-4">
          <FormRow label="Employee" required>
            <select className={inputCls} value={form.userId} onChange={e => setForm({ ...form, userId: e.target.value })} required>
              <option value="">Select Employee...</option>
              {(employees || []).map((e: any) => (
                <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>
              ))}
            </select>
          </FormRow>
          <FormRow label="Goal Title / OKR" required><input className={inputCls} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Complete Guardian Agent Integration" required /></FormRow>
          <FormRow label="Target Completion Date"><input type="date" className={inputCls} value={form.targetDate} onChange={e => setForm({ ...form, targetDate: e.target.value })} /></FormRow>
          <button type="submit" disabled={createMutation.isPending} className="w-full py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-lg">Assign Goal</button>
        </form>
      </Modal>
    </div>
  );
}

// ─── Tab 12: Payroll Engine ──────────────────────────────────────────────────
const PAYROLL_STATUS_STYLE: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  CALCULATED: "bg-blue-50 text-blue-700",
  REVIEW: "bg-amber-50 text-amber-700",
  APPROVED: "bg-green-50 text-green-700",
  FINALIZED: "bg-purple-50 text-purple-700",
  LOCKED: "bg-slate-800 text-white",
  PAID: "bg-green-50 text-green-700",
  CANCELLED: "bg-red-50 text-red-700",
};

const EXPORTABLE_RUN = ["APPROVED", "FINALIZED", "LOCKED", "PAID"];

function saveTextFile(filename: string, content: string, mime = "text/plain") {
  const url = URL.createObjectURL(new Blob([content], { type: `${mime};charset=utf-8` }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const inr = (n: any) => n === null || n === undefined ? "—" : `₹${Math.round(Number(n)).toLocaleString("en-IN")}`;

function Line({ k, v, strong }: { k: string; v: React.ReactNode; strong?: boolean }) {
  return <div className={`flex justify-between py-1 text-xs ${strong ? "font-bold text-slate-900 border-t border-slate-200 mt-1 pt-2" : "text-slate-600"}`}><span>{k}</span><span>{v}</span></div>;
}

/** Yearly salary statement (Form 16 Part B figures) and full & final settlement for one employee. */
function StatementsPanel() {
  const fyNow = new Date().getMonth() >= 3 ? CURRENT_YEAR : CURRENT_YEAR - 1;
  const [userId, setUserId] = useState("");
  const [fy, setFy] = useState(String(fyNow));
  const [fnf, setFnf] = useState({ lastWorkingDay: "", noticeShortfallDays: "", otherRecoveries: "", otherPayments: "" });
  const [error, setError] = useState<string | null>(null);
  const [statement, setStatement] = useState<any>(null);
  const [settlement, setSettlement] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const { data: employees } = useQuery({
    queryKey: ["hr-employees"],
    queryFn: async () => { const { data } = await api.get("/hr/employees"); return data; },
  });

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setError(null);
    try { await fn(); } catch (err: any) { setError(err?.response?.data?.message || "Request failed."); } finally { setBusy(false); }
  };
  const loadStatement = () => run(async () => {
    const { data } = await api.get(`/hrms/payroll/statement/${userId}?fy=${fy}`);
    setStatement(data);
  });
  const loadFnf = (markSettled = false) => run(async () => {
    const body: any = { markSettled };
    if (fnf.lastWorkingDay) body.lastWorkingDay = fnf.lastWorkingDay;
    for (const k of ["noticeShortfallDays", "otherRecoveries", "otherPayments"] as const) if (fnf[k]) body[k] = Number(fnf[k]);
    const { data } = await api.post(`/hrms/payroll/fnf/${userId}`, body);
    setSettlement(data);
  });
  const statementCsv = () => {
    if (!statement) return;
    const rows = [["Month", "Gross", "TDS", "Net"], ...statement.byMonth.map((m: any) => [`${MONTHS[m.month - 1]} ${m.year}`, m.gross, m.tds, m.net]),
      ["Total", statement.grossSalary, statement.tdsDeducted, statement.netPaid]];
    saveTextFile(`salary-statement-${statement.employee.name.replace(/\s+/g, "-")}-FY${statement.financialYear}.csv`, rows.map(r => r.join(",")).join("\n") + "\n", "text/csv");
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-bold text-slate-800">Statements & full and final</h2>
        <p className="text-xs text-slate-500">Yearly salary statement for Form 16 (Part B) and the exit settlement. Only approved payroll runs are counted.</p>
      </div>
      <div className="bg-white border border-slate-200 rounded-xl p-4 grid gap-3 sm:grid-cols-[1fr_auto]">
        <FormRow label="Employee" required>
          <select className={inputCls} value={userId} onChange={e => { setUserId(e.target.value); setStatement(null); setSettlement(null); }}>
            <option value="">Choose an employee</option>
            {(employees || []).map((e: any) => <option key={e.id} value={e.id}>{`${e.firstName || ""} ${e.lastName || ""}`.trim() || e.email}</option>)}
          </select>
        </FormRow>
      </div>
      {error && <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold px-3 py-2 rounded-lg"><AlertTriangle className="w-4 h-4 shrink-0" /> {error}</div>}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          <div className="text-sm font-bold text-slate-800">Yearly salary statement</div>
          <div className="flex items-end gap-2">
            <FormRow label="Financial year starting">
              <select className={inputCls} value={fy} onChange={e => setFy(e.target.value)}>
                {[0, 1, 2, 3].map(i => fyNow - i).map(y => <option key={y} value={y}>{`FY ${y}-${String((y + 1) % 100).padStart(2, "0")}`}</option>)}
              </select>
            </FormRow>
            <button onClick={loadStatement} disabled={!userId || busy} className="mb-0.5 px-3 py-2 bg-indigo-600 disabled:opacity-50 text-white text-xs font-bold rounded-lg">Show</button>
          </div>
          {statement && (statement.months === 0 ? (
            <p className="text-xs text-slate-500">No approved payslips for FY {statement.financialYear}.</p>
          ) : (
            <div>
              <Line k="Months paid" v={statement.months} />
              <Line k="Gross salary" v={inr(statement.grossSalary)} />
              <Line k="Basic" v={inr(statement.basic)} />
              <Line k="HRA" v={inr(statement.hra)} />
              <Line k="Employee PF (80C)" v={inr(statement.employeePf)} />
              <Line k="Professional tax" v={inr(statement.professionalTax)} />
              <Line k="Tax deducted (TDS)" v={inr(statement.tdsDeducted)} />
              <Line k="Net paid" v={inr(statement.netPaid)} strong />
              <div className="flex items-center justify-between mt-2">
                <span className="text-[11px] text-slate-400">PAN: {statement.employee.pan || "—"}</span>
                <button onClick={statementCsv} className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700"><Download className="w-3 h-3" /> CSV</button>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          <div className="text-sm font-bold text-slate-800">Full and final settlement</div>
          <div className="grid grid-cols-2 gap-2">
            <FormRow label="Last working day"><input type="date" className={inputCls} value={fnf.lastWorkingDay} onChange={e => setFnf({ ...fnf, lastWorkingDay: e.target.value })} /></FormRow>
            <FormRow label="Notice days not served"><input type="number" min={0} className={inputCls} value={fnf.noticeShortfallDays} onChange={e => setFnf({ ...fnf, noticeShortfallDays: e.target.value })} /></FormRow>
            <FormRow label="Other payments (₹)"><input type="number" min={0} className={inputCls} value={fnf.otherPayments} onChange={e => setFnf({ ...fnf, otherPayments: e.target.value })} /></FormRow>
            <FormRow label="Other recoveries (₹)"><input type="number" min={0} className={inputCls} value={fnf.otherRecoveries} onChange={e => setFnf({ ...fnf, otherRecoveries: e.target.value })} /></FormRow>
          </div>
          <p className="text-[11px] text-slate-400">Leave blank to use the exit date on the profile.</p>
          <button onClick={() => loadFnf(false)} disabled={!userId || busy} className="px-3 py-2 bg-indigo-600 disabled:opacity-50 text-white text-xs font-bold rounded-lg">Calculate</button>
          {settlement && (
            <div>
              <Line k={`Service`} v={`${settlement.serviceYears} years`} />
              <Line k={`Salary for ${settlement.daysWorked} of ${settlement.daysInMonth} days`} v={inr(settlement.earnings.finalMonthSalary)} />
              <Line k={`Earned leave (${settlement.earnedLeaveBalance ?? "—"} days)`} v={inr(settlement.earnings.leaveEncashment)} />
              <Line k="Gratuity" v={settlement.gratuityEligible ? inr(settlement.earnings.gratuity) : "Not eligible (under 5 years)"} />
              {settlement.earnings.otherPayments > 0 && <Line k="Other payments" v={inr(settlement.earnings.otherPayments)} />}
              {settlement.recoveries.noticeRecovery > 0 && <Line k="Notice shortfall recovery" v={`− ${inr(settlement.recoveries.noticeRecovery)}`} />}
              {settlement.recoveries.otherRecoveries > 0 && <Line k="Other recoveries" v={`− ${inr(settlement.recoveries.otherRecoveries)}`} />}
              <Line k="Net settlement" v={inr(settlement.netSettlement)} strong />
              <div className="mt-2">
                {settlement.settled
                  ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700"><CheckCircle2 className="w-3.5 h-3.5" /> Marked as settled</span>
                  : <button onClick={() => loadFnf(true)} disabled={busy} className="px-3 py-1.5 border border-slate-200 text-slate-700 text-xs font-bold rounded-lg">Mark as settled</button>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PayrollRunsPanel() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ month: String(new Date().getMonth() + 1), year: String(CURRENT_YEAR) });

  const { data: runs, isLoading } = useQuery({
    queryKey: ["hrms-payroll-runs"],
    queryFn: async () => { const { data } = await api.get("/hrms/payroll/runs"); return data; },
  });

  const createMutation = useMutation({
    mutationFn: (payload: any) => api.post("/hrms/payroll/runs", payload),
    onSuccess: () => { setOpen(false); qc.invalidateQueries({ queryKey: ["hrms-payroll-runs"] }); },
  });

  const processMutation = useMutation({
    mutationFn: (id: string) => api.post(`/hrms/payroll/runs/${id}/process`, {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hrms-payroll-runs"] }); },
  });

  // Enterprise Payroll Engine workflow — DRAFT/CALCULATED -> CALCULATED ->
  // REVIEW -> APPROVED -> FINALIZED -> LOCKED, alongside (not replacing) the
  // legacy synchronous "Process & Issue Payslips" action above.
  const [actionError, setActionError] = useState<string | null>(null);
  const workflowMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) => api.post(`/hrms/payroll/runs/${id}/${action}`, {}),
    onSuccess: () => { setActionError(null); qc.invalidateQueries({ queryKey: ["hrms-payroll-runs"] }); },
    onError: (err: any) => setActionError(err?.response?.data?.message || "Action failed."),
  });

  // Bank / PF ECR / ESI files of an approved run. The server lists anyone it had to leave out.
  const [exporting, setExporting] = useState<string | null>(null);
  const [exportNote, setExportNote] = useState<{ title: string; problems: { employee: string; reason: string }[] } | null>(null);
  const downloadExport = async (runId: string, kind: string) => {
    setExporting(`${runId}:${kind}`);
    try {
      const { data } = await api.get(`/hrms/payroll/runs/${runId}/exports/${kind}`);
      if (data.count > 0) saveTextFile(data.filename, data.content, data.mime);
      const what = kind === "bank" ? "bank transfer" : kind === "pf-ecr" ? "PF ECR" : "ESI";
      setExportNote({
        title: data.count > 0
          ? `${data.filename}: ${data.count} employee${data.count === 1 ? "" : "s"}${data.total ? `, ₹${Number(data.total).toLocaleString("en-IN")}` : ""}`
          : `No one to include in the ${what} file`,
        problems: data.problems || [],
      });
      setActionError(null);
    } catch (err: any) {
      setActionError(err?.response?.data?.message || "Download failed.");
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-base font-bold text-slate-800">Monthly Payroll Runs & Payslip Generator</h2>
          <p className="text-xs text-slate-500">Run monthly employee compensation, statutory deductions, and automatic payslip generation.</p>
        </div>
        <button onClick={() => setOpen(true)} className="flex items-center gap-2 bg-indigo-600 text-white px-3.5 py-2 rounded-lg text-xs font-bold shadow-sm">
          <Plus className="w-4 h-4" /> Start Payroll Run
        </button>
      </div>

      {actionError && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold px-3 py-2 rounded-lg">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {actionError}
        </div>
      )}

      {exportNote && (
        <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-slate-700">{exportNote.title}</span>
            <button onClick={() => setExportNote(null)} className="text-slate-400 hover:text-slate-600">Dismiss</button>
          </div>
          {exportNote.problems.length > 0 && (
            <ul className="mt-1.5 space-y-0.5 text-amber-700">
              {exportNote.problems.map((p, i) => <li key={i}>Left out {p.employee}: {p.reason}</li>)}
            </ul>
          )}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto shadow-sm">
        <table className="min-w-full divide-y divide-slate-100">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Period</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Payslips Issued</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Status</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {isLoading ? <tr><td colSpan={4} className="py-10 text-center text-slate-400">Loading payroll runs...</td></tr>
              : (runs || []).length === 0 ? <tr><td colSpan={4} className="py-10 text-center text-slate-400">No payroll runs created</td></tr>
              : runs.map((r: any) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-bold text-slate-900 text-sm">{MONTHS[r.month - 1]} {r.year}</td>
                  <td className="px-5 py-3 text-sm text-slate-700 font-semibold">{r.payslips?.length || 0} Employees</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${PAYROLL_STATUS_STYLE[r.status] || "bg-slate-100 text-slate-600"}`}>
                      {r.status === "LOCKED" && <Lock className="w-3 h-3 inline mr-1 -mt-0.5" />}
                      {r.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right space-x-1.5">
                    {r.status === "DRAFT" && (
                      <>
                        <button onClick={() => processMutation.mutate(r.id)} disabled={processMutation.isPending} className="bg-green-50 text-green-700 border border-green-200 text-xs px-2.5 py-1 rounded font-bold">
                          Process (Legacy)
                        </button>
                        <button onClick={() => workflowMutation.mutate({ id: r.id, action: "calculate" })} disabled={workflowMutation.isPending} className="bg-blue-50 text-blue-700 border border-blue-200 text-xs px-2.5 py-1 rounded font-bold">
                          Calculate (New Engine)
                        </button>
                      </>
                    )}
                    {r.status === "CALCULATED" && (
                      <>
                        <button onClick={() => workflowMutation.mutate({ id: r.id, action: "calculate" })} disabled={workflowMutation.isPending} className="bg-slate-50 text-slate-600 border border-slate-200 text-xs px-2.5 py-1 rounded font-bold">
                          Recalculate
                        </button>
                        <button onClick={() => workflowMutation.mutate({ id: r.id, action: "review" })} disabled={workflowMutation.isPending} className="bg-amber-50 text-amber-700 border border-amber-200 text-xs px-2.5 py-1 rounded font-bold">
                          Send to Review
                        </button>
                        <button onClick={() => workflowMutation.mutate({ id: r.id, action: "approve" })} disabled={workflowMutation.isPending} className="bg-green-50 text-green-700 border border-green-200 text-xs px-2.5 py-1 rounded font-bold">
                          Approve
                        </button>
                      </>
                    )}
                    {r.status === "REVIEW" && (
                      <button onClick={() => workflowMutation.mutate({ id: r.id, action: "approve" })} disabled={workflowMutation.isPending} className="bg-green-50 text-green-700 border border-green-200 text-xs px-2.5 py-1 rounded font-bold">
                        Approve
                      </button>
                    )}
                    {r.status === "APPROVED" && (
                      <button onClick={() => workflowMutation.mutate({ id: r.id, action: "finalize" })} disabled={workflowMutation.isPending} className="bg-purple-50 text-purple-700 border border-purple-200 text-xs px-2.5 py-1 rounded font-bold">
                        Finalize
                      </button>
                    )}
                    {r.status === "FINALIZED" && (
                      <button onClick={() => workflowMutation.mutate({ id: r.id, action: "lock" })} disabled={workflowMutation.isPending} className="bg-slate-800 text-white text-xs px-2.5 py-1 rounded font-bold flex items-center gap-1 ml-auto">
                        <Lock className="w-3 h-3" /> Lock
                      </button>
                    )}
                    {r.status === "LOCKED" && <span className="text-xs text-slate-400 italic">Immutable</span>}
                    {EXPORTABLE_RUN.includes(r.status) && (
                      <span className="inline-flex gap-1 ml-1.5 align-middle">
                        {([["bank", "Bank file"], ["pf-ecr", "PF ECR"], ["esi", "ESI"]] as const).map(([kind, label]) => (
                          <button key={kind} onClick={() => downloadExport(r.id, kind)} disabled={exporting === `${r.id}:${kind}`} className="inline-flex items-center gap-1 bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 text-xs px-2 py-1 rounded font-semibold">
                            <Download className="w-3 h-3" /> {label}
                          </button>
                        ))}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Create Monthly Payroll Run">
        <form onSubmit={e => { e.preventDefault(); createMutation.mutate(form); }} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <FormRow label="Month" required>
              <select className={inputCls} value={form.month} onChange={e => setForm({ ...form, month: e.target.value })}>
                {MONTHS.map((m, idx) => (
                  <option key={m} value={idx + 1}>{m}</option>
                ))}
              </select>
            </FormRow>
            <FormRow label="Year" required><input type="number" className={inputCls} value={form.year} onChange={e => setForm({ ...form, year: e.target.value })} required /></FormRow>
          </div>
          <button type="submit" disabled={createMutation.isPending} className="w-full py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-lg">Create Draft Run</button>
        </form>
      </Modal>
    </div>
  );
}

function PayrollConfigPanel() {
  const qc = useQueryClient();
  const { data: config, isLoading } = useQuery({
    queryKey: ["hrms-payroll-config"],
    queryFn: async () => { const { data } = await api.get("/hrms/payroll/config"); return data; },
  });
  const [form, setForm] = useState<any>(null);
  const [reason, setReason] = useState("");
  useEffect(() => { if (config && !form) setForm(config); }, [config, form]);

  const saveMutation = useMutation({
    mutationFn: (payload: any) => api.patch("/hrms/payroll/config", { ...payload, changeReason: reason }),
    onSuccess: () => { setReason(""); qc.invalidateQueries({ queryKey: ["hrms-payroll-config"] }); },
  });

  if (isLoading || !form) return <div className="py-10 text-center text-slate-400 text-sm">Loading payroll configuration...</div>;

  const num = (key: string) => (
    <input type="number" step="any" className={inputCls} value={form[key] ?? ""} onChange={e => setForm({ ...form, [key]: Number(e.target.value) })} />
  );

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h2 className="text-base font-bold text-slate-800">Statutory Payroll Configuration</h2>
        <p className="text-xs text-slate-500">Every change creates a new versioned, audited configuration — nothing is overwritten. Version {form.version} · effective {form.effectiveFrom ? new Date(form.effectiveFrom).toLocaleDateString() : "—"}.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          <div className="text-xs font-bold uppercase text-slate-500">Provident Fund (PF)</div>
          <FormRow label="Employee Rate">{num("pfEmployeeRate")}</FormRow>
          <FormRow label="Employer Rate">{num("pfEmployerRate")}</FormRow>
          <FormRow label="Wage Ceiling">{num("pfWageCeiling")}</FormRow>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          <div className="text-xs font-bold uppercase text-slate-500">ESI</div>
          <FormRow label="Employee Rate">{num("esiEmployeeRate")}</FormRow>
          <FormRow label="Employer Rate">{num("esiEmployerRate")}</FormRow>
          <FormRow label="Gross Ceiling">{num("esiGrossCeiling")}</FormRow>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          <div className="text-xs font-bold uppercase text-slate-500">Professional Tax</div>
          <FormRow label="State">
            <input className={inputCls} value={form.ptState ?? ""} onChange={e => setForm({ ...form, ptState: e.target.value })} />
          </FormRow>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          <div className="text-xs font-bold uppercase text-slate-500">LWP Basis</div>
          <FormRow label="Calculation Base">
            <select className={inputCls} value={form.lwpCalculationBase ?? "CALENDAR"} onChange={e => setForm({ ...form, lwpCalculationBase: e.target.value })}>
              <option value="CALENDAR">Calendar Days</option>
              <option value="FIXED_26">Fixed 26 Days</option>
              <option value="FIXED_30">Fixed 30 Days</option>
            </select>
          </FormRow>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
        <FormRow label="Reason for change" required>
          <input className={inputCls} value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Statutory PF rate revision for FY2026-27" />
        </FormRow>
        <button
          onClick={() => saveMutation.mutate(form)}
          disabled={saveMutation.isPending || !reason.trim()}
          className="bg-indigo-600 text-white text-xs font-bold px-4 py-2 rounded-lg disabled:opacity-40"
        >
          Save New Version
        </button>
        {saveMutation.isError && <p className="text-xs text-red-600 font-semibold">{(saveMutation.error as any)?.response?.data?.message || "Save failed."}</p>}
      </div>
    </div>
  );
}

function SalaryComponentsPanel() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code: "", name: "", type: "EARNING", calcType: "FIXED", fixedAmount: "0", percentage: "" });

  const { data: components, isLoading } = useQuery({
    queryKey: ["hrms-salary-components"],
    queryFn: async () => { const { data } = await api.get("/hrms/payroll/components"); return data; },
  });

  const createMutation = useMutation({
    mutationFn: (payload: any) => api.post("/hrms/payroll/components", {
      ...payload,
      fixedAmount: payload.fixedAmount ? Number(payload.fixedAmount) : undefined,
      percentage: payload.percentage ? Number(payload.percentage) : undefined,
    }),
    onSuccess: () => { setOpen(false); qc.invalidateQueries({ queryKey: ["hrms-salary-components"] }); },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => api.post(`/hrms/payroll/components/${id}/deactivate`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hrms-salary-components"] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-base font-bold text-slate-800">Salary Components</h2>
          <p className="text-xs text-slate-500">Earnings, allowances, bonuses, incentives, and deductions — dynamically configured, no code changes needed.</p>
        </div>
        <button onClick={() => setOpen(true)} className="flex items-center gap-2 bg-indigo-600 text-white px-3.5 py-2 rounded-lg text-xs font-bold shadow-sm">
          <Plus className="w-4 h-4" /> New Component
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <table className="min-w-full divide-y divide-slate-100">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Code</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Name</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Type</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Calculation</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Status</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {isLoading ? <tr><td colSpan={6} className="py-10 text-center text-slate-400">Loading components...</td></tr>
              : (components || []).length === 0 ? <tr><td colSpan={6} className="py-10 text-center text-slate-400">No salary components configured yet</td></tr>
              : components.map((c: any) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-mono text-xs text-slate-700">{c.code}</td>
                  <td className="px-5 py-3 text-sm font-semibold text-slate-900">{c.name}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${c.type === "EARNING" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{c.type}</span>
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-600">{c.calcType}{c.calcType?.startsWith("PERCENTAGE") ? ` (${(c.percentage * 100).toFixed(1)}%)` : c.calcType === "FIXED" ? ` (₹${c.fixedAmount})` : ""}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${c.isActive ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-500"}`}>{c.isActive ? "Active" : "Inactive"}</span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    {c.isActive && c.organizationId && (
                      <button onClick={() => deactivateMutation.mutate(c.id)} className="text-xs text-red-600 font-bold hover:underline">Deactivate</button>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="New Salary Component">
        <form onSubmit={e => { e.preventDefault(); createMutation.mutate(form); }} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <FormRow label="Code" required><input className={inputCls} value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase().replace(/\s+/g, "_") })} required /></FormRow>
            <FormRow label="Name" required><input className={inputCls} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></FormRow>
            <FormRow label="Type" required>
              <select className={inputCls} value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                <option value="EARNING">Earning</option>
                <option value="DEDUCTION">Deduction</option>
              </select>
            </FormRow>
            <FormRow label="Calculation Type" required>
              <select className={inputCls} value={form.calcType} onChange={e => setForm({ ...form, calcType: e.target.value })}>
                <option value="FIXED">Fixed Amount</option>
                <option value="PERCENTAGE_OF_BASIC">% of Basic</option>
                <option value="PERCENTAGE_OF_GROSS">% of Gross</option>
                <option value="PERCENTAGE_OF_CTC">% of CTC</option>
                <option value="TARGET_BASED">Target-Based</option>
                <option value="RATING_BASED">Rating-Based</option>
                <option value="MANUAL">Manual (Admin-Approved)</option>
              </select>
            </FormRow>
            {form.calcType === "FIXED" ? (
              <FormRow label="Fixed Amount (₹)"><input type="number" className={inputCls} value={form.fixedAmount} onChange={e => setForm({ ...form, fixedAmount: e.target.value })} /></FormRow>
            ) : form.calcType.startsWith("PERCENTAGE") ? (
              <FormRow label="Percentage (0-1)"><input type="number" step="0.01" className={inputCls} value={form.percentage} onChange={e => setForm({ ...form, percentage: e.target.value })} placeholder="0.10 = 10%" /></FormRow>
            ) : null}
          </div>
          <button type="submit" disabled={createMutation.isPending} className="w-full py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-lg">Create Component</button>
          {createMutation.isError && <p className="text-xs text-red-600 font-semibold">{(createMutation.error as any)?.response?.data?.message || "Failed to create."}</p>}
        </form>
      </Modal>
    </div>
  );
}

function HolidayCalendarsPanel() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [holidayModalFor, setHolidayModalFor] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", year: String(CURRENT_YEAR), state: "" });
  const [holidayForm, setHolidayForm] = useState({ date: "", name: "", isOptional: false });

  const { data: calendars, isLoading } = useQuery({
    queryKey: ["hrms-holiday-calendars"],
    queryFn: async () => { const { data } = await api.get("/hrms/payroll/holidays/calendars"); return data; },
  });

  const createMutation = useMutation({
    mutationFn: (payload: any) => api.post("/hrms/payroll/holidays/calendars", { ...payload, year: Number(payload.year) }),
    onSuccess: () => { setOpen(false); qc.invalidateQueries({ queryKey: ["hrms-holiday-calendars"] }); },
  });

  const addHolidayMutation = useMutation({
    mutationFn: ({ calendarId, payload }: any) => api.post(`/hrms/payroll/holidays/calendars/${calendarId}/holidays`, payload),
    onSuccess: () => { setHolidayModalFor(null); qc.invalidateQueries({ queryKey: ["hrms-holiday-calendars"] }); },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-base font-bold text-slate-800">Holiday Calendars</h2>
          <p className="text-xs text-slate-500">Multiple calendars per state/location — employees are assigned to the one that applies to them.</p>
        </div>
        <button onClick={() => setOpen(true)} className="flex items-center gap-2 bg-indigo-600 text-white px-3.5 py-2 rounded-lg text-xs font-bold shadow-sm">
          <Plus className="w-4 h-4" /> New Calendar
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {isLoading ? <div className="col-span-2 py-10 text-center text-slate-400 text-sm">Loading calendars...</div>
          : (calendars || []).length === 0 ? <div className="col-span-2 py-10 text-center text-slate-400 text-sm">No holiday calendars yet</div>
          : calendars.map((c: any) => (
            <div key={c.id} className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-bold text-slate-900 text-sm">{c.name}</div>
                  <div className="text-xs text-slate-500">{c.year}{c.state ? ` · ${c.state}` : ""}</div>
                </div>
                <button onClick={() => setHolidayModalFor(c.id)} className="text-xs text-indigo-600 font-bold hover:underline">+ Holiday</button>
              </div>
              <div className="text-xs text-slate-600 space-y-1 max-h-40 overflow-y-auto">
                {(c.holidays || []).length === 0 ? <div className="text-slate-400 italic">No holidays added</div>
                  : c.holidays.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()).map((h: any) => (
                    <div key={h.id} className="flex justify-between">
                      <span>{h.name}{h.isOptional ? " (optional)" : ""}</span>
                      <span className="text-slate-400">{new Date(h.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                    </div>
                  ))}
              </div>
            </div>
          ))}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="New Holiday Calendar">
        <form onSubmit={e => { e.preventDefault(); createMutation.mutate(form); }} className="p-5 space-y-4">
          <FormRow label="Name" required><input className={inputCls} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Karnataka 2026" required /></FormRow>
          <div className="grid grid-cols-2 gap-3">
            <FormRow label="Year" required><input type="number" className={inputCls} value={form.year} onChange={e => setForm({ ...form, year: e.target.value })} required /></FormRow>
            <FormRow label="State"><input className={inputCls} value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} /></FormRow>
          </div>
          <button type="submit" disabled={createMutation.isPending} className="w-full py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-lg">Create Calendar</button>
        </form>
      </Modal>

      <Modal open={!!holidayModalFor} onClose={() => setHolidayModalFor(null)} title="Add Holiday">
        <form onSubmit={e => { e.preventDefault(); addHolidayMutation.mutate({ calendarId: holidayModalFor, payload: holidayForm }); }} className="p-5 space-y-4">
          <FormRow label="Date" required><input type="date" className={inputCls} value={holidayForm.date} onChange={e => setHolidayForm({ ...holidayForm, date: e.target.value })} required /></FormRow>
          <FormRow label="Name" required><input className={inputCls} value={holidayForm.name} onChange={e => setHolidayForm({ ...holidayForm, name: e.target.value })} required /></FormRow>
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            <input type="checkbox" checked={holidayForm.isOptional} onChange={e => setHolidayForm({ ...holidayForm, isOptional: e.target.checked })} />
            Optional holiday
          </label>
          <button type="submit" disabled={addHolidayMutation.isPending} className="w-full py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-lg">Add Holiday</button>
          {addHolidayMutation.isError && <p className="text-xs text-red-600 font-semibold">{(addHolidayMutation.error as any)?.response?.data?.message || "Failed to add."}</p>}
        </form>
      </Modal>
    </div>
  );
}

const DAY_TYPE_OPTIONS = ["FULL_DAY", "HALF_DAY", "OFF", "ALTERNATE"];
const WEEKDAYS: Array<{ key: string; label: string }> = [
  { key: "monday", label: "Mon" }, { key: "tuesday", label: "Tue" }, { key: "wednesday", label: "Wed" },
  { key: "thursday", label: "Thu" }, { key: "friday", label: "Fri" }, { key: "saturday", label: "Sat" }, { key: "sunday", label: "Sun" },
];

function WorkingWeekPanel() {
  const qc = useQueryClient();
  const { data: week, isLoading } = useQuery({
    queryKey: ["hrms-working-week"],
    queryFn: async () => { const { data } = await api.get("/hrms/payroll/working-week"); return data; },
  });
  const [form, setForm] = useState<any>(null);
  const [reason, setReason] = useState("");
  useEffect(() => { if (week && !form) setForm(week); }, [week, form]);

  const saveMutation = useMutation({
    mutationFn: (payload: any) => api.patch("/hrms/payroll/working-week", { ...payload, reason }),
    onSuccess: () => { setReason(""); qc.invalidateQueries({ queryKey: ["hrms-working-week"] }); },
  });

  if (isLoading || !form) return <div className="py-10 text-center text-slate-400 text-sm">Loading working week...</div>;

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h2 className="text-base font-bold text-slate-800">Working Week</h2>
        <p className="text-xs text-slate-500">Every change creates a new effective-dated version — used directly by the payroll engine's holiday/LWP calculation.</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-7 gap-2">
        {WEEKDAYS.map(({ key, label }) => (
          <FormRow key={key} label={label}>
            <select className={inputCls} value={form[key] ?? "FULL_DAY"} onChange={e => setForm({ ...form, [key]: e.target.value })}>
              {DAY_TYPE_OPTIONS.map(d => <option key={d} value={d}>{d.replace("_", " ")}</option>)}
            </select>
          </FormRow>
        ))}
      </div>

      {(form.saturday === "ALTERNATE") && (
        <FormRow label="Alternate Saturday Rule">
          <select className={inputCls} value={form.alternateSaturdayRule ?? "NONE"} onChange={e => setForm({ ...form, alternateSaturdayRule: e.target.value })}>
            <option value="NONE">None</option>
            <option value="1ST_3RD">1st &amp; 3rd Saturday Off</option>
            <option value="2ND_4TH">2nd &amp; 4th Saturday Off</option>
            <option value="ALL">All Saturdays Off</option>
          </select>
        </FormRow>
      )}

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
        <FormRow label="Reason for change" required>
          <input className={inputCls} value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Switched to alternate Saturdays off" />
        </FormRow>
        <button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending || !reason.trim()} className="bg-indigo-600 text-white text-xs font-bold px-4 py-2 rounded-lg disabled:opacity-40">
          Save New Version
        </button>
        {saveMutation.isError && <p className="text-xs text-red-600 font-semibold">{(saveMutation.error as any)?.response?.data?.message || "Save failed."}</p>}
      </div>
    </div>
  );
}

function slabsToText(slabs: any[]) {
  return (slabs || []).map(s => `${s.incomeFrom},${s.incomeTo ?? ""},${s.taxRate}`).join("\n");
}

function TaxConfigPanel() {
  const qc = useQueryClient();
  const [fy, setFy] = useState(`${CURRENT_YEAR}-${String((CURRENT_YEAR + 1) % 100).padStart(2, "0")}`);
  const [regime, setRegime] = useState<"NEW" | "OLD">("NEW");
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [reason, setReason] = useState("");
  const [form, setForm] = useState({
    standardDeduction: "75000", rebateLimit: "700000", rebateAmount: "25000", cessRate: "0.04",
    slabsText: "0,300000,0\n300000,700000,0.05\n700000,1000000,0.1\n1000000,1200000,0.15\n1200000,1500000,0.2\n1500000,,0.3",
  });

  const { data: config, isLoading, isError } = useQuery({
    queryKey: ["hrms-tax-config", fy, regime],
    queryFn: async () => { const { data } = await api.get(`/hrms/payroll/tax/config?fy=${fy}&regime=${regime}`); return data; },
    retry: false,
  });
  const { data: history } = useQuery({
    queryKey: ["hrms-tax-config-history", fy, regime],
    queryFn: async () => { const { data } = await api.get(`/hrms/payroll/tax/config/history?fy=${fy}&regime=${regime}`); return data; },
    enabled: showHistory,
  });

  const parseSlabs = (text: string) => text.trim().split("\n").filter(Boolean).map(line => {
    const [from, to, rate] = line.split(",").map(s => s.trim());
    return { incomeFrom: Number(from), incomeTo: to ? Number(to) : null, taxRate: Number(rate) };
  });

  const openCreate = () => {
    setForm({ standardDeduction: "75000", rebateLimit: "700000", rebateAmount: "25000", cessRate: "0.04", slabsText: form.slabsText });
    setModalMode("create");
  };
  const openEdit = () => {
    if (!config) return;
    setForm({
      standardDeduction: String(config.standardDeduction), rebateLimit: String(config.rebateLimit),
      rebateAmount: String(config.rebateAmount), cessRate: String(config.cessRate),
      slabsText: slabsToText(config.slabs),
    });
    setModalMode("edit");
  };

  const createMutation = useMutation({
    mutationFn: () => api.post("/hrms/payroll/tax/config", {
      financialYear: fy, regimeType: regime,
      standardDeduction: Number(form.standardDeduction), rebateLimit: Number(form.rebateLimit),
      rebateAmount: Number(form.rebateAmount), cessRate: Number(form.cessRate),
      slabs: parseSlabs(form.slabsText), reason,
    }),
    onSuccess: () => { setModalMode(null); setReason(""); qc.invalidateQueries({ queryKey: ["hrms-tax-config", fy, regime] }); qc.invalidateQueries({ queryKey: ["hrms-tax-config-history", fy, regime] }); },
  });
  const updateMutation = useMutation({
    mutationFn: () => api.patch(`/hrms/payroll/tax/config?fy=${fy}&regime=${regime}`, {
      standardDeduction: Number(form.standardDeduction), rebateLimit: Number(form.rebateLimit),
      rebateAmount: Number(form.rebateAmount), cessRate: Number(form.cessRate),
      slabs: parseSlabs(form.slabsText), reason,
    }),
    onSuccess: () => { setModalMode(null); setReason(""); qc.invalidateQueries({ queryKey: ["hrms-tax-config", fy, regime] }); qc.invalidateQueries({ queryKey: ["hrms-tax-config-history", fy, regime] }); },
  });
  const activeMutation = modalMode === "edit" ? updateMutation : createMutation;

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-base font-bold text-slate-800">Income Tax Configuration</h2>
          <p className="text-xs text-slate-500">Financial-year and regime versioned — slabs, standard deduction, rebate, and cess all come from here, never hardcoded.</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 bg-indigo-600 text-white px-3.5 py-2 rounded-lg text-xs font-bold shadow-sm shrink-0">
          <Plus className="w-4 h-4" /> New FY Config
        </button>
      </div>

      <div className="flex gap-3">
        <FormRow label="Financial Year"><input className={inputCls} value={fy} onChange={e => setFy(e.target.value)} placeholder="2026-27" /></FormRow>
        <FormRow label="Regime">
          <select className={inputCls} value={regime} onChange={e => setRegime(e.target.value as any)}>
            <option value="NEW">New Regime</option>
            <option value="OLD">Old Regime</option>
          </select>
        </FormRow>
      </div>

      {isLoading ? <div className="py-6 text-center text-slate-400 text-sm">Loading...</div>
        : isError ? <div className="py-6 text-center text-slate-400 text-sm">No config found for FY {fy} ({regime} regime). Create one above.</div>
        : config && (
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-50 text-green-700">
                {history ? `Version ${history.length}` : "Current"} · Active
              </span>
              <span className="text-xs text-slate-400">Effective from {new Date(config.effectiveFrom).toLocaleDateString()}</span>
              <div className="space-x-2">
                <button onClick={() => setShowHistory(s => !s)} className="text-xs text-indigo-600 font-bold hover:underline">{showHistory ? "Hide" : "Show"} History</button>
                <button onClick={openEdit} className="text-xs text-indigo-600 font-bold hover:underline">Edit</button>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-3 text-xs">
              <div><div className="text-slate-400 font-semibold uppercase">Std. Deduction</div><div className="font-bold text-slate-800">₹{config.standardDeduction}</div></div>
              <div><div className="text-slate-400 font-semibold uppercase">Rebate Limit</div><div className="font-bold text-slate-800">₹{config.rebateLimit}</div></div>
              <div><div className="text-slate-400 font-semibold uppercase">Rebate Amount</div><div className="font-bold text-slate-800">₹{config.rebateAmount}</div></div>
              <div><div className="text-slate-400 font-semibold uppercase">Cess</div><div className="font-bold text-slate-800">{(config.cessRate * 100).toFixed(0)}%</div></div>
            </div>
            <table className="w-full text-xs">
              <thead><tr className="text-slate-400 uppercase"><th className="text-left py-1">From</th><th className="text-left py-1">To</th><th className="text-left py-1">Rate</th></tr></thead>
              <tbody>
                {(config.slabs || []).map((s: any) => (
                  <tr key={s.id} className="border-t border-slate-50">
                    <td className="py-1">₹{s.incomeFrom}</td>
                    <td className="py-1">{s.incomeTo ? `₹${s.incomeTo}` : "and above"}</td>
                    <td className="py-1">{(s.taxRate * 100).toFixed(0)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      {showHistory && (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-bold uppercase text-slate-500 mb-2">Historical Versions — FY {fy} ({regime})</div>
          {!history ? <div className="text-xs text-slate-400">Loading history...</div>
            : history.length === 0 ? <div className="text-xs text-slate-400">No versions yet.</div>
            : (
              <table className="w-full text-xs">
                <thead><tr className="text-slate-400 uppercase"><th className="text-left py-1">Status</th><th className="text-left py-1">Effective From</th><th className="text-left py-1">Effective To</th><th className="text-left py-1">Cess</th><th className="text-left py-1">Std. Deduction</th></tr></thead>
                <tbody>
                  {history.map((h: any) => (
                    <tr key={h.id} className="border-t border-slate-50">
                      <td className="py-1.5">{h.isActive ? <span className="text-green-600 font-semibold">Active</span> : <span className="text-slate-400">Superseded</span>}</td>
                      <td className="py-1.5">{new Date(h.effectiveFrom).toLocaleDateString()}</td>
                      <td className="py-1.5">{h.effectiveTo ? new Date(h.effectiveTo).toLocaleDateString() : "—"}</td>
                      <td className="py-1.5">{(h.cessRate * 100).toFixed(0)}%</td>
                      <td className="py-1.5">₹{h.standardDeduction}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </div>
      )}

      <Modal open={modalMode !== null} onClose={() => setModalMode(null)} title={`${modalMode === "edit" ? "Edit" : "New"} Tax Config — FY ${fy} (${regime})`} size="lg">
        <form onSubmit={e => { e.preventDefault(); activeMutation.mutate(); }} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <FormRow label="Standard Deduction"><input type="number" className={inputCls} value={form.standardDeduction} onChange={e => setForm({ ...form, standardDeduction: e.target.value })} /></FormRow>
            <FormRow label="Cess Rate (0-1)"><input type="number" step="0.01" className={inputCls} value={form.cessRate} onChange={e => setForm({ ...form, cessRate: e.target.value })} /></FormRow>
            <FormRow label="Rebate Limit"><input type="number" className={inputCls} value={form.rebateLimit} onChange={e => setForm({ ...form, rebateLimit: e.target.value })} /></FormRow>
            <FormRow label="Rebate Amount"><input type="number" className={inputCls} value={form.rebateAmount} onChange={e => setForm({ ...form, rebateAmount: e.target.value })} /></FormRow>
          </div>
          <FormRow label="Slabs (incomeFrom,incomeTo,rate — one per line, blank incomeTo = no upper bound)">
            <textarea className={`${inputCls} font-mono h-32`} value={form.slabsText} onChange={e => setForm({ ...form, slabsText: e.target.value })} />
          </FormRow>
          <FormRow label="Reason" required><input className={inputCls} value={reason} onChange={e => setReason(e.target.value)} placeholder={modalMode === "edit" ? "e.g. Cess rate revised for FY2026-27" : "e.g. FY2026-27 slab notification"} /></FormRow>
          <button type="submit" disabled={activeMutation.isPending || !reason.trim()} className="w-full py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-lg disabled:opacity-40">
            {modalMode === "edit" ? "Save New Version" : "Create Config"}
          </button>
          {activeMutation.isError && <p className="text-xs text-red-600 font-semibold">{(activeMutation.error as any)?.response?.data?.message || "Failed to save."}</p>}
        </form>
      </Modal>
    </div>
  );
}

function AdjustmentsPanel() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ userId: "", type: "ARREAR_SALARY", amount: "", reason: "", targetMonth: String(new Date().getMonth() + 1), targetYear: String(CURRENT_YEAR) });

  const { data: employees } = useQuery({
    queryKey: ["hr-employees"],
    queryFn: async () => { const { data } = await api.get("/hr/employees"); return data; },
  });
  const { data: pending, isLoading } = useQuery({
    queryKey: ["hrms-adjustments"],
    queryFn: async () => { const { data } = await api.get("/hrms/payroll/adjustments"); return data; },
  });

  const createMutation = useMutation({
    mutationFn: (payload: any) => api.post("/hrms/payroll/adjustments", { ...payload, amount: Number(payload.amount), targetMonth: Number(payload.targetMonth), targetYear: Number(payload.targetYear) }),
    onSuccess: () => { setOpen(false); qc.invalidateQueries({ queryKey: ["hrms-adjustments"] }); },
  });
  const approveMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/hrms/payroll/adjustments/${id}/approve`, { reason: "Approved via HR admin" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hrms-adjustments"] }),
  });
  const rejectMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/hrms/payroll/adjustments/${id}/reject`, { reason: "Rejected via HR admin" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hrms-adjustments"] }),
  });

  const employeeName = (id: string) => { const e = (employees || []).find((x: any) => x.id === id); return e ? `${e.firstName} ${e.lastName}` : id; };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-base font-bold text-slate-800">Payroll Adjustments &amp; Arrears</h2>
          <p className="text-xs text-slate-500">Arrears, corrections, and manual earning/deduction adjustments — every one requires approval before it flows into a payroll run.</p>
        </div>
        <button onClick={() => setOpen(true)} className="flex items-center gap-2 bg-indigo-600 text-white px-3.5 py-2 rounded-lg text-xs font-bold shadow-sm">
          <Plus className="w-4 h-4" /> New Adjustment
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <table className="min-w-full divide-y divide-slate-100">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Employee</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Type</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Amount</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Period</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Reason</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {isLoading ? <tr><td colSpan={6} className="py-10 text-center text-slate-400">Loading adjustments...</td></tr>
              : (pending || []).length === 0 ? <tr><td colSpan={6} className="py-10 text-center text-slate-400">No pending adjustments</td></tr>
              : pending.map((a: any) => (
                <tr key={a.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 text-sm font-semibold text-slate-900">{employeeName(a.userId)}</td>
                  <td className="px-5 py-3 text-xs text-slate-600">{a.type.replace(/_/g, " ")}</td>
                  <td className="px-5 py-3 text-sm font-bold text-slate-800">₹{a.amount}</td>
                  <td className="px-5 py-3 text-xs text-slate-600">{MONTHS[a.targetMonth - 1]} {a.targetYear}</td>
                  <td className="px-5 py-3 text-xs text-slate-500 max-w-xs truncate">{a.reason}</td>
                  <td className="px-5 py-3 text-right space-x-1.5">
                    <button onClick={() => approveMutation.mutate(a.id)} className="bg-green-50 text-green-700 border border-green-200 text-xs px-2.5 py-1 rounded font-bold">Approve</button>
                    <button onClick={() => rejectMutation.mutate(a.id)} className="bg-red-50 text-red-700 border border-red-200 text-xs px-2.5 py-1 rounded font-bold">Reject</button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="New Payroll Adjustment">
        <form onSubmit={e => { e.preventDefault(); createMutation.mutate(form); }} className="p-5 space-y-4">
          <FormRow label="Employee" required>
            <select className={inputCls} value={form.userId} onChange={e => setForm({ ...form, userId: e.target.value })} required>
              <option value="">Select Employee...</option>
              {(employees || []).map((e: any) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
            </select>
          </FormRow>
          <div className="grid grid-cols-2 gap-3">
            <FormRow label="Type" required>
              <select className={inputCls} value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                <option value="ARREAR_SALARY">Salary Arrear</option>
                <option value="ARREAR_INCREMENT">Increment Arrear</option>
                <option value="ARREAR_PROMOTION">Promotion Arrear</option>
                <option value="BONUS">Bonus</option>
                <option value="CORRECTION">Correction</option>
                <option value="MANUAL_EARNING">Manual Earning</option>
                <option value="MANUAL_DEDUCTION">Manual Deduction</option>
              </select>
            </FormRow>
            <FormRow label="Amount (₹)" required><input type="number" className={inputCls} value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} required /></FormRow>
            <FormRow label="Target Month" required>
              <select className={inputCls} value={form.targetMonth} onChange={e => setForm({ ...form, targetMonth: e.target.value })}>
                {MONTHS.map((m, idx) => <option key={m} value={idx + 1}>{m}</option>)}
              </select>
            </FormRow>
            <FormRow label="Target Year" required><input type="number" className={inputCls} value={form.targetYear} onChange={e => setForm({ ...form, targetYear: e.target.value })} required /></FormRow>
          </div>
          <FormRow label="Reason" required><input className={inputCls} value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} required /></FormRow>
          <button type="submit" disabled={createMutation.isPending} className="w-full py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-lg">Submit Adjustment</button>
          {createMutation.isError && <p className="text-xs text-red-600 font-semibold">{(createMutation.error as any)?.response?.data?.message || "Failed to submit."}</p>}
        </form>
      </Modal>
    </div>
  );
}

function ComponentOverrideRow({ override, onSaved }: { override: any; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [amountOverride, setAmountOverride] = useState(override.amountOverride ?? "");
  const [percentageOverride, setPercentageOverride] = useState(override.percentageOverride ?? "");
  const [isEligible, setIsEligible] = useState(override.isEligible);
  const [reason, setReason] = useState("");

  const saveMutation = useMutation({
    mutationFn: () => api.patch(`/hrms/payroll/overrides/component/${override.id}`, {
      amountOverride: amountOverride === "" ? null : Number(amountOverride),
      percentageOverride: percentageOverride === "" ? null : Number(percentageOverride),
      isEligible,
      reason,
    }),
    onSuccess: () => { setEditing(false); setReason(""); onSaved(); },
  });

  if (!editing) {
    return (
      <tr className="border-t border-slate-50">
        <td className="py-1.5 font-semibold text-slate-700">{override.component?.name}</td>
        <td className="py-1.5 text-slate-500">{override.amountOverride != null ? `₹${override.amountOverride}` : override.percentageOverride != null ? `${(override.percentageOverride * 100).toFixed(1)}%` : "default"}</td>
        <td className="py-1.5">{override.isEligible ? <span className="text-green-600 font-semibold">Eligible</span> : <span className="text-red-500 font-semibold">Excluded</span>}</td>
        <td className="py-1.5 text-right"><button onClick={() => setEditing(true)} className="text-xs text-indigo-600 font-bold hover:underline">Edit</button></td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-slate-50 bg-indigo-50/40">
      <td className="py-2 font-semibold text-slate-700 align-top">{override.component?.name}</td>
      <td colSpan={2} className="py-2">
        <div className="flex gap-2 items-center flex-wrap">
          <input type="number" placeholder="Amount ₹" className={`${inputCls} w-28`} value={amountOverride} onChange={e => setAmountOverride(e.target.value)} />
          <input type="number" step="0.01" placeholder="Percent (0-1)" className={`${inputCls} w-28`} value={percentageOverride} onChange={e => setPercentageOverride(e.target.value)} />
          <label className="flex items-center gap-1 text-xs font-semibold text-slate-600">
            <input type="checkbox" checked={isEligible} onChange={e => setIsEligible(e.target.checked)} /> Eligible
          </label>
          <input placeholder="Reason (required)" className={`${inputCls} flex-1 min-w-[160px]`} value={reason} onChange={e => setReason(e.target.value)} />
        </div>
        {saveMutation.isError && <p className="text-xs text-red-600 font-semibold mt-1">{(saveMutation.error as any)?.response?.data?.message || "Save failed."}</p>}
      </td>
      <td className="py-2 text-right align-top space-x-1.5 whitespace-nowrap">
        <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !reason.trim()} className="text-xs bg-indigo-600 text-white font-bold px-2.5 py-1 rounded disabled:opacity-40">Save</button>
        <button onClick={() => setEditing(false)} className="text-xs text-slate-500 font-bold px-2.5 py-1">Cancel</button>
      </td>
    </tr>
  );
}

function EmployeeOverridesPanel() {
  const qc = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState("");
  const [reason, setReason] = useState("");
  const [form, setForm] = useState<any>(null);

  const { data: employees } = useQuery({
    queryKey: ["hr-employees"],
    queryFn: async () => { const { data } = await api.get("/hr/employees"); return data; },
  });
  const { data: overrides, isLoading } = useQuery({
    queryKey: ["hrms-overrides", selectedUserId],
    queryFn: async () => { const { data } = await api.get(`/hrms/payroll/overrides/${selectedUserId}`); return data; },
    enabled: !!selectedUserId,
  });
  useEffect(() => { setForm(overrides?.statutory ?? null); }, [overrides]);

  const saveMutation = useMutation({
    mutationFn: (payload: any) => api.patch(`/hrms/payroll/overrides/${selectedUserId}`, { ...payload, reason }),
    onSuccess: () => { setReason(""); qc.invalidateQueries({ queryKey: ["hrms-overrides", selectedUserId] }); },
  });

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h2 className="text-base font-bold text-slate-800">Employee Statutory &amp; Payroll Overrides</h2>
        <p className="text-xs text-slate-500">Employee Override → Organization Config → Statutory Default. Every change here is audited with a reason.</p>
      </div>

      <FormRow label="Select Employee">
        <select className={inputCls} value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)}>
          <option value="">Select Employee...</option>
          {(employees || []).map((e: any) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
        </select>
      </FormRow>

      {!selectedUserId ? null
        : isLoading ? <div className="py-6 text-center text-slate-400 text-sm">Loading overrides...</div>
        : !form ? <div className="py-6 text-center text-slate-400 text-sm">No active salary record for this employee.</div>
        : (
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-2 gap-4">
              <FormRow label="PF Wage Ceiling Override">
                <input type="number" className={inputCls} value={form.pfWageCeiling ?? ""} onChange={e => setForm({ ...form, pfWageCeiling: Number(e.target.value) })} />
              </FormRow>
              <FormRow label="Voluntary PF % (on top of standard)">
                <input type="number" className={inputCls} value={form.voluntaryPfPercent ?? 0} onChange={e => setForm({ ...form, voluntaryPfPercent: Number(e.target.value) })} />
              </FormRow>
              <FormRow label="ESI Gross Ceiling Override">
                <input type="number" className={inputCls} value={form.esiGrossCeiling ?? ""} onChange={e => setForm({ ...form, esiGrossCeiling: Number(e.target.value) })} />
              </FormRow>
              <FormRow label="Professional Tax Override (0 = waived)">
                <input type="number" className={inputCls} value={form.professionalTaxOverride ?? ""} onChange={e => setForm({ ...form, professionalTaxOverride: e.target.value === "" ? null : Number(e.target.value) })} />
              </FormRow>
              <FormRow label="Tax Regime">
                <select className={inputCls} value={form.taxRegime ?? "NEW"} onChange={e => setForm({ ...form, taxRegime: e.target.value })}>
                  <option value="NEW">New Regime</option>
                  <option value="OLD">Old Regime</option>
                </select>
              </FormRow>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 mt-6">
                <input type="checkbox" checked={form.pfApplicable} onChange={e => setForm({ ...form, pfApplicable: e.target.checked })} /> PF Applicable
              </label>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                <input type="checkbox" checked={form.esiApplicable} onChange={e => setForm({ ...form, esiApplicable: e.target.checked })} /> ESI Applicable
              </label>
            </div>

            {(overrides?.componentOverrides || []).length > 0 && (
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="text-xs font-bold uppercase text-slate-500 mb-2">Assigned Component Overrides</div>
                <table className="w-full text-xs">
                  <tbody>
                    {overrides.componentOverrides.map((o: any) => (
                      <ComponentOverrideRow key={o.id} override={o} onSaved={() => qc.invalidateQueries({ queryKey: ["hrms-overrides", selectedUserId] })} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
              <FormRow label="Reason for change" required>
                <input className={inputCls} value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. High-package PF opt-out per employee request" />
              </FormRow>
              <button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending || !reason.trim()} className="bg-indigo-600 text-white text-xs font-bold px-4 py-2 rounded-lg disabled:opacity-40">
                Save Override
              </button>
              {saveMutation.isError && <p className="text-xs text-red-600 font-semibold">{(saveMutation.error as any)?.response?.data?.message || "Save failed."}</p>}
            </div>
          </div>
        )}
    </div>
  );
}

const AUDIT_ENTITY_TYPES = [
  "SALARY_COMPONENT", "EMPLOYEE_SALARY_COMPONENT", "HOLIDAY_CALENDAR", "HOLIDAY", "HOLIDAY_ASSIGNMENT",
  "WORKING_WEEK", "TAX_REGIME_CONFIG", "PAYROLL_ADJUSTMENT", "EMPLOYEE_OVERRIDE",
];
const AUDIT_ACTIONS = ["CREATE", "UPDATE", "DEACTIVATE", "DELETE", "ASSIGN", "APPROVE", "REJECT"];

function AuditHistoryPanel() {
  const [filters, setFilters] = useState({ entityType: "", action: "", actorId: "", dateFrom: "", dateTo: "" });

  const { data: employees } = useQuery({
    queryKey: ["hr-employees"],
    queryFn: async () => { const { data } = await api.get("/hr/employees"); return data; },
  });
  const query = new URLSearchParams(Object.fromEntries(Object.entries(filters).filter(([, v]) => v))).toString();
  const { data: entries, isLoading } = useQuery({
    queryKey: ["hrms-payroll-audit", filters],
    queryFn: async () => { const { data } = await api.get(`/hrms/payroll/audit${query ? `?${query}` : ""}`); return data; },
  });
  const actorName = (id: string) => { const e = (employees || []).find((x: any) => x.id === id); return e ? `${e.firstName} ${e.lastName}` : `${id.slice(0, 8)}...`; };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-bold text-slate-800">Payroll Audit History</h2>
        <p className="text-xs text-slate-500">Every change to statutory config, components, holidays, adjustments, and overrides — actor, timestamp, reason, and old/new value. Records are append-only.</p>
      </div>

      <div className="flex gap-3 flex-wrap bg-white border border-slate-200 rounded-xl p-4">
        <FormRow label="Entity Type">
          <select className={inputCls} value={filters.entityType} onChange={e => setFilters({ ...filters, entityType: e.target.value })}>
            <option value="">All</option>
            {AUDIT_ENTITY_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
          </select>
        </FormRow>
        <FormRow label="Action">
          <select className={inputCls} value={filters.action} onChange={e => setFilters({ ...filters, action: e.target.value })}>
            <option value="">All</option>
            {AUDIT_ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </FormRow>
        <FormRow label="Actor">
          <select className={inputCls} value={filters.actorId} onChange={e => setFilters({ ...filters, actorId: e.target.value })}>
            <option value="">All</option>
            {(employees || []).map((e: any) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
          </select>
        </FormRow>
        <FormRow label="From"><input type="date" className={inputCls} value={filters.dateFrom} onChange={e => setFilters({ ...filters, dateFrom: e.target.value })} /></FormRow>
        <FormRow label="To"><input type="date" className={inputCls} value={filters.dateTo} onChange={e => setFilters({ ...filters, dateTo: e.target.value })} /></FormRow>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <table className="min-w-full divide-y divide-slate-100 text-xs">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-2.5 text-left font-semibold text-slate-500 uppercase">When</th>
              <th className="px-4 py-2.5 text-left font-semibold text-slate-500 uppercase">Entity</th>
              <th className="px-4 py-2.5 text-left font-semibold text-slate-500 uppercase">Action</th>
              <th className="px-4 py-2.5 text-left font-semibold text-slate-500 uppercase">Field</th>
              <th className="px-4 py-2.5 text-left font-semibold text-slate-500 uppercase">Old → New</th>
              <th className="px-4 py-2.5 text-left font-semibold text-slate-500 uppercase">Reason</th>
              <th className="px-4 py-2.5 text-left font-semibold text-slate-500 uppercase">Actor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {isLoading ? <tr><td colSpan={7} className="py-10 text-center text-slate-400">Loading audit history...</td></tr>
              : (entries || []).length === 0 ? <tr><td colSpan={7} className="py-10 text-center text-slate-400">No audit records match these filters</td></tr>
              : entries.map((e: any) => (
                <tr key={e.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2 text-slate-500 whitespace-nowrap">{new Date(e.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-2 text-slate-700">{e.entityType.replace(/_/g, " ")}<div className="text-slate-400 font-mono">{e.entityId.slice(0, 8)}...</div></td>
                  <td className="px-4 py-2"><span className="font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">{e.action}</span></td>
                  <td className="px-4 py-2 text-slate-600">{e.fieldName || "—"}</td>
                  <td className="px-4 py-2 text-slate-600 max-w-xs truncate">{e.oldValue != null ? `${e.oldValue} → ${e.newValue}` : (e.newValue ?? "—")}</td>
                  <td className="px-4 py-2 text-slate-500 max-w-xs truncate">{e.reason || "—"}</td>
                  <td className="px-4 py-2 text-slate-500">{actorName(e.actorId)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MigrationPanel() {
  const qc = useQueryClient();
  const [reason, setReason] = useState("");
  const [lastResult, setLastResult] = useState<any>(null);

  const { data: status, isLoading } = useQuery({
    queryKey: ["hrms-migration-status"],
    queryFn: async () => { const { data } = await api.get("/hrms/payroll/migration/status"); return data; },
  });

  const runMutation = useMutation({
    mutationFn: () => api.post("/hrms/payroll/migration/run", { reason }),
    onSuccess: ({ data }) => { setLastResult(data); setReason(""); qc.invalidateQueries({ queryKey: ["hrms-migration-status"] }); },
  });

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h2 className="text-base font-bold text-slate-800">Legacy → Dynamic Component Migration</h2>
        <p className="text-xs text-slate-500">Synthesizes SalaryComponent definitions and per-employee assignments from existing EmployeeSalary fields. Idempotent — safe to run more than once. Legacy fields are never modified. Requires Super Admin.</p>
      </div>

      {isLoading ? <div className="py-6 text-center text-slate-400 text-sm">Loading status...</div>
        : status && (
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-xs text-slate-400 font-semibold uppercase">Component Definitions Configured</div>
              <div className="text-2xl font-bold text-slate-800">{status.componentDefinitionsConfigured}</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-xs text-slate-400 font-semibold uppercase">Total Active Employees</div>
              <div className="text-2xl font-bold text-slate-800">{status.totalActiveEmployees}</div>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <div className="text-xs text-green-700 font-semibold uppercase">On Dynamic Components</div>
              <div className="text-2xl font-bold text-green-800">{status.employeesUsingDynamicComponents}</div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="text-xs text-amber-700 font-semibold uppercase">Still on Legacy Fallback</div>
              <div className="text-2xl font-bold text-amber-800">{status.employeesStillOnLegacyFallback}</div>
            </div>
          </div>
        )}

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
        <FormRow label="Reason for running migration" required>
          <input className={inputCls} value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Onboarding org onto dynamic salary components" />
        </FormRow>
        <button onClick={() => runMutation.mutate()} disabled={runMutation.isPending || !reason.trim()} className="bg-indigo-600 text-white text-xs font-bold px-4 py-2 rounded-lg disabled:opacity-40">
          Run Migration
        </button>
        {runMutation.isError && <p className="text-xs text-red-600 font-semibold">{(runMutation.error as any)?.response?.data?.message || "Migration failed — this action requires Super Admin."}</p>}
      </div>

      {lastResult && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-xs space-y-1">
          <div className="font-bold text-slate-700 mb-1">Migration Result</div>
          <div>Components created: <b>{lastResult.componentsCreated}</b> (already existed: {lastResult.componentsAlreadyExisted})</div>
          <div>Employees migrated: <b>{lastResult.employeesMigrated}</b> (already migrated: {lastResult.employeesAlreadyMigrated}, skipped/no salary: {lastResult.employeesSkippedNoSalary})</div>
        </div>
      )}
    </div>
  );
}

function PayrollTab() {
  const [inner, setInner] = useState<"runs" | "statements" | "config" | "components" | "holidays" | "workingWeek" | "tax" | "adjustments" | "overrides" | "audit" | "migration">("runs");
  const tabs: Array<{ id: typeof inner; label: string; icon: any }> = [
    { id: "runs", label: "Payroll Runs", icon: ListChecks },
    { id: "statements", label: "Statements & F&F", icon: FileText },
    { id: "config", label: "Statutory Config", icon: Settings2 },
    { id: "components", label: "Salary Components", icon: Layers },
    { id: "holidays", label: "Holiday Calendars", icon: Calendar },
    { id: "workingWeek", label: "Working Week", icon: Clock },
    { id: "tax", label: "Tax Configuration", icon: Receipt },
    { id: "adjustments", label: "Adjustments & Arrears", icon: RefreshCw },
    { id: "overrides", label: "Employee Overrides", icon: UserCheck },
    { id: "audit", label: "Audit History", icon: FileText },
    { id: "migration", label: "Migration", icon: ExternalLink },
  ];
  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-slate-200 overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setInner(t.id)}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold border-b-2 -mb-px transition-colors whitespace-nowrap ${
              inner === t.id ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </button>
        ))}
      </div>
      {inner === "runs" && <PayrollRunsPanel />}
      {inner === "statements" && <StatementsPanel />}
      {inner === "config" && <PayrollConfigPanel />}
      {inner === "components" && <SalaryComponentsPanel />}
      {inner === "holidays" && <HolidayCalendarsPanel />}
      {inner === "workingWeek" && <WorkingWeekPanel />}
      {inner === "tax" && <TaxConfigPanel />}
      {inner === "adjustments" && <AdjustmentsPanel />}
      {inner === "overrides" && <EmployeeOverridesPanel />}
      {inner === "audit" && <AuditHistoryPanel />}
      {inner === "migration" && <MigrationPanel />}
    </div>
  );
}
