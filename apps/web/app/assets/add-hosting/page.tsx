"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  useAssets, 
  useGuardianAgents, 
  useTriggerGuardianDiscovery, 
  useGuardianDiscoveries, 
  useAllClients, 
  useCreate 
} from "../../../src/hooks/queries";
import { 
  ArrowLeft, 
  Server, 
  Globe, 
  Users, 
  Shield, 
  Activity, 
  Loader2, 
  CheckCircle2, 
  Search, 
  AlertTriangle 
} from "lucide-react";

export default function AddHostingWizard() {
  const router = useRouter();

  // Wizard Steps
  const [step, setStep] = useState(1);
  const [selectedServerId, setSelectedServerId] = useState("");
  const [mode, setMode] = useState<"auto" | "manual" | "import">("auto");
  const [isScanning, setIsScanning] = useState(false);
  const [assignedClients, setAssignedClients] = useState<Record<string, string>>({}); // website -> clientId

  const { data: assetsData, isLoading: assetsLoading } = useAssets();
  const servers = assetsData?.assets?.filter((a: any) => a.type === "VPS" || a.type === "HOSTING") || [];

  const { data: agents } = useGuardianAgents();
  const selectedAgent = Array.isArray(agents) ? agents.find((a: any) => a.serverId === selectedServerId) : null;

  const triggerDiscovery = useTriggerGuardianDiscovery();
  const { data: discoveries, refetch: refetchDiscoveries } = useGuardianDiscoveries(selectedAgent?.id);
  const { data: clients } = useAllClients();
  const createAsset = useCreate("assets", "assets");

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const handleStartScan = async () => {
    if (!selectedAgent) {
      alert("No Guardian agent registered for this server. Please deploy an agent first.");
      return;
    }
    setIsScanning(true);
    try {
      await triggerDiscovery.mutateAsync(selectedAgent.id);
      refetchDiscoveries();
      setStep(3);
    } catch (e: any) {
      alert(e.response?.data?.message || "Failed to initiate discovery scan.");
    } finally {
      setIsScanning(false);
    }
  };

  const handleAssignClients = () => {
    // Basic validation
    setStep(4);
  };

  const handleSaveAll = async () => {
    setSaving(true);
    setErr("");
    try {
      const siteList = discoveries?.discoveredWebsites || [];
      for (const site of siteList) {
        const clientId = assignedClients[site.domain];
        if (!clientId) continue;

        // Register website in workspace inventory
        await createAsset.mutateAsync({
          name: site.domain,
          type: "WEBSITE",
          clientId,
          description: `Discovered on server path: ${site.path}`,
          notes: JSON.stringify({
            docRoot: site.path,
            dbName: site.dbDetails?.name,
            dbUser: site.dbDetails?.username,
          }),
        });
      }
      setStep(5);
    } catch (e: any) {
      setErr(e.response?.data?.message || "Failed to link websites to inventory.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8 max-w-4xl mx-auto space-y-8 select-none selection:bg-teal-500 selection:text-slate-950">
      
      {/* Title */}
      <div className="flex items-center justify-between border-b border-slate-900 pb-6">
        <div className="space-y-2">
          <Link 
            href="/assets" 
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Assets List
          </Link>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            Map Server & Setup Guardian
          </h1>
        </div>
      </div>

      {/* Step Indicators */}
      <div className="flex items-center justify-between bg-slate-900 border border-slate-850 p-4 rounded-xl text-xs text-slate-400 font-bold">
        {[
          { num: 1, label: "Server" },
          { num: 2, label: "Mode" },
          { num: 3, label: "Discovery" },
          { num: 4, label: "Link Clients" },
          { num: 5, label: "Review" },
        ].map((s) => (
          <div key={s.num} className="flex items-center gap-2">
            <span className={`w-5 h-5 flex items-center justify-center rounded-full text-[10px] ${
              step >= s.num ? "bg-teal-500 text-slate-950" : "bg-slate-800 text-slate-500"
            }`}>
              {s.num}
            </span>
            <span className={step === s.num ? "text-teal-400" : ""}>{s.label}</span>
          </div>
        ))}
      </div>

      {err && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl text-xs leading-relaxed">
          {err}
        </div>
      )}

      {/* STEP 1: Select Server */}
      {step === 1 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
          <div className="space-y-1">
            <h3 className="font-bold text-white text-sm">Step 1: Choose Host VPS/Server</h3>
            <p className="text-[10px] text-slate-400">Select which active infrastructure host to run compliance scanning on.</p>
          </div>

          <div className="space-y-3 pt-2">
            {servers.length === 0 ? (
              <p className="text-xs text-slate-500">No active VPS or HOSTING assets found in inventory.</p>
            ) : (
              servers.map((srv: any) => (
                <label 
                  key={srv.id}
                  onClick={() => setSelectedServerId(srv.id)}
                  className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer hover:border-slate-700 transition-colors ${
                    selectedServerId === srv.id ? "bg-teal-500/5 border-teal-500/30 text-teal-400" : "bg-slate-950/40 border-slate-850 text-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Server className="w-5 h-5 text-slate-500" />
                    <span className="text-xs font-semibold">{srv.name}</span>
                  </div>
                  <input
                    type="radio"
                    name="serverSelect"
                    checked={selectedServerId === srv.id}
                    onChange={() => {}}
                    className="sr-only"
                  />
                </label>
              ))
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-900">
            <button
              onClick={() => setStep(2)}
              disabled={!selectedServerId}
              className="px-5 py-2.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs rounded-xl disabled:opacity-50 transition-colors"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Choose Mode */}
      {step === 2 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
          <div className="space-y-1">
            <h3 className="font-bold text-white text-sm">Step 2: Choose Setup Mode</h3>
            <p className="text-[10px] text-slate-400">Select how directory configurations and client mappings should be scanned.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            {[
              { id: "auto", title: "Auto Discover", desc: "Guardian agent inspects Nginx site-availables and logs to extract paths." },
              { id: "manual", title: "Manual Scan", desc: "Manually point to your site document roots and db files." },
              { id: "import", title: "Import File", desc: "Upload a JSON mapping file exported from a backup." },
            ].map((m) => (
              <div
                key={m.id}
                onClick={() => setMode(m.id as any)}
                className={`p-4 border rounded-xl cursor-pointer hover:border-slate-700 transition-colors flex flex-col gap-2 ${
                  mode === m.id ? "bg-teal-500/5 border-teal-500/30 text-teal-400" : "bg-slate-950/40 border-slate-850 text-slate-400"
                }`}
              >
                <h4 className="text-xs font-bold text-white">{m.title}</h4>
                <p className="text-[10px] leading-relaxed">{m.desc}</p>
              </div>
            ))}
          </div>

          <div className="flex justify-between gap-3 pt-4 border-t border-slate-900">
            <button
              onClick={() => setStep(1)}
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-400 text-xs font-bold rounded-xl border border-slate-800"
            >
              Back
            </button>
            <button
              onClick={handleStartScan}
              disabled={isScanning}
              className="px-5 py-2.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs rounded-xl disabled:opacity-50 transition-colors flex items-center gap-1.5"
            >
              {isScanning && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Start Discovery Scan
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Discovery Results */}
      {step === 3 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
          <div className="space-y-1">
            <h3 className="font-bold text-white text-sm">Step 3: Scan Discoveries</h3>
            <p className="text-[10px] text-slate-400">Guardian discovered these Linux environment websites and virtual host logs.</p>
          </div>

          <div className="space-y-3 pt-2">
            {!discoveries?.discoveredWebsites || discoveries.discoveredWebsites.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">No Virtual Hosts or document roots resolved.</p>
            ) : (
              discoveries.discoveredWebsites.map((site: any) => (
                <div key={site.domain} className="p-4 bg-slate-950/40 border border-slate-850 rounded-xl space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-200">{site.domain}</span>
                    <span className="px-2 py-0.5 bg-slate-905 border border-slate-800 rounded text-[10px] text-slate-400">
                      {site.type}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">{site.path}</div>
                  {site.dbDetails && (
                    <div className="text-[10px] text-teal-500 font-mono">
                      DB Config: {site.dbDetails.name} (user: {site.dbDetails.username})
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="flex justify-between gap-3 pt-4 border-t border-slate-900">
            <button
              onClick={() => setStep(2)}
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-400 text-xs font-bold rounded-xl border border-slate-800"
            >
              Back
            </button>
            <button
              onClick={handleAssignClients}
              disabled={!discoveries?.discoveredWebsites}
              className="px-5 py-2.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs rounded-xl disabled:opacity-50 transition-colors"
            >
              Map Client Accounts
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: Link Clients */}
      {step === 4 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
          <div className="space-y-1">
            <h3 className="font-bold text-white text-sm">Step 4: Map Websites to Clients</h3>
            <p className="text-[10px] text-slate-400">Link each scanned web domain to its parent client profile in inventory.</p>
          </div>

          <div className="space-y-4 pt-2">
            {discoveries?.discoveredWebsites?.map((site: any) => (
              <div key={site.domain} className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center border-b border-slate-850/60 pb-3">
                <span className="text-xs font-bold text-slate-200">{site.domain}</span>
                <select
                  value={assignedClients[site.domain] || ""}
                  onChange={(e) => setAssignedClients(f => ({ ...f, [site.domain]: e.target.value }))}
                  className="bg-slate-950 border border-slate-800 text-white rounded-lg p-2.5 text-xs focus:outline-none focus:border-teal-500 cursor-pointer"
                >
                  <option value="">Do Not Link</option>
                  {clients?.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div className="flex justify-between gap-3 pt-4 border-t border-slate-900">
            <button
              onClick={() => setStep(3)}
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-400 text-xs font-bold rounded-xl border border-slate-800"
            >
              Back
            </button>
            <button
              onClick={handleSaveAll}
              disabled={saving}
              className="px-5 py-2.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs rounded-xl disabled:opacity-50 transition-colors flex items-center gap-1.5"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Confirm & Save
            </button>
          </div>
        </div>
      )}

      {/* STEP 5: Complete & Review */}
      {step === 5 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center space-y-6">
          <div className="w-16 h-16 bg-teal-500/10 border border-teal-500/20 text-teal-400 rounded-full flex items-center justify-center mx-auto animate-bounce">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h3 className="font-extrabold text-white text-base">Setup Process Completed!</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Your server websites are registered, assigned to client accounts, and mapped for security log-scanning.
            </p>
          </div>
          <div className="pt-2">
            <button
              onClick={() => router.push("/assets")}
              className="px-6 py-3 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs rounded-xl transition-all"
            >
              Enter Assets Dashboard
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
