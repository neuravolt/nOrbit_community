'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  GitBranch,
  Shield,
  Key,
  Lock,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Copy,
  Check,
  RefreshCw,
  FolderGit2,
  GraduationCap,
  ExternalLink,
  Info,
} from 'lucide-react';
import { useAuthStore } from '../../../../src/store/auth';
import { api } from '../../../../src/lib/api';

type Scope = 'PROJECTS' | 'LAUNCHPAD';

interface SettingsData {
  scope: Scope;
  appId: string;
  appName: string;
  isPrivateKeyConfigured: boolean;
  isWebhookSecretConfigured: boolean;
  source: 'DATABASE_ENCRYPTED' | 'ENVIRONMENT';
  hasRollback: boolean;
  lastTestedAt: string | null;
  lastTestStatus: 'SUCCESS' | 'FAILED' | null;
  lastTestMessage: string | null;
  webhookUrl: string;
  legacySharedWebhookUrl: string;
  callbackUrl: string;
}

export default function GitHubSettingsPage() {
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const [activeScope, setActiveScope] = useState<Scope>('PROJECTS');
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [testing, setTesting] = useState<boolean>(false);
  const [rollingBack, setRollingBack] = useState<boolean>(false);
  const [copiedWebhook, setCopiedWebhook] = useState<boolean>(false);

  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form fields (only for inputs; never holds existing secrets)
  const [appIdInput, setAppIdInput] = useState<string>('');
  const [appNameInput, setAppNameInput] = useState<string>('');
  const [privateKeyInput, setPrivateKeyInput] = useState<string>('');
  const [webhookSecretInput, setWebhookSecretInput] = useState<string>('');

  const fetchSettings = async (scope: Scope) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await api.get(`/settings/integrations/github?scope=${scope}`);
      setSettings(res.data);
      setAppIdInput(res.data.appId || '');
      setAppNameInput(res.data.appName || '');
      setPrivateKeyInput('');
      setWebhookSecretInput('');
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || err.message || 'Failed to load GitHub settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSuperAdmin) {
      fetchSettings(activeScope);
    }
  }, [activeScope, isSuperAdmin]);

  const handleScopeChange = (scope: Scope) => {
    setActiveScope(scope);
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const payload: any = {
        scope: activeScope,
        appId: appIdInput.trim() || undefined,
        appName: appNameInput.trim() || undefined,
      };
      if (privateKeyInput.trim()) {
        payload.privateKey = privateKeyInput.trim();
      }
      if (webhookSecretInput.trim()) {
        payload.webhookSecret = webhookSecretInput.trim();
      }

      const res = await api.post('/settings/integrations/github', payload);
      setSettings(res.data);
      setPrivateKeyInput('');
      setWebhookSecretInput('');
      setSuccessMsg(`Successfully updated and encrypted GitHub settings for ${activeScope}.`);
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || err.message || 'Failed to save configuration.');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await api.post('/settings/integrations/github/test', { scope: activeScope });
      if (res.data.success) {
        setSuccessMsg(res.data.message);
      } else {
        setErrorMsg(res.data.message);
      }
      // Refresh state to update test status timestamp
      const updated = await api.get(`/settings/integrations/github?scope=${activeScope}`);
      setSettings(updated.data);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || err.message || 'Connection test failed.');
    } finally {
      setTesting(false);
    }
  };

  const handleRollback = async () => {
    if (!confirm(`Are you sure you want to rollback ${activeScope} GitHub settings to the previous configuration?`)) {
      return;
    }
    setRollingBack(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await api.post('/settings/integrations/github/rollback', { scope: activeScope });
      setSettings(res.data);
      setAppIdInput(res.data.appId || '');
      setAppNameInput(res.data.appName || '');
      setPrivateKeyInput('');
      setWebhookSecretInput('');
      setSuccessMsg(`Rolled back ${activeScope} GitHub configuration to previous valid state.`);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || err.message || 'Failed to rollback configuration.');
    } finally {
      setRollingBack(false);
    }
  };

  const handleCopyWebhook = () => {
    if (settings?.webhookUrl) {
      navigator.clipboard.writeText(settings.webhookUrl);
      setCopiedWebhook(true);
      setTimeout(() => setCopiedWebhook(false), 2000);
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-800/80 border border-slate-700/80 rounded-2xl p-8 text-center space-y-4 shadow-xl">
          <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-400 mx-auto flex items-center justify-center">
            <Lock size={24} />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">Access Restricted</h1>
          <p className="text-sm text-slate-400 leading-relaxed">
            Centralized GitHub integration settings and cryptographic credential management are restricted strictly to authorized <span className="font-semibold text-rose-400">SUPER_ADMIN</span> users.
          </p>
          <div className="pt-2">
            <Link
              href="/settings"
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-slate-700 text-slate-200 hover:bg-slate-600 transition"
            >
              <ArrowLeft size={14} /> Back to Settings Hub
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Top Header */}
        <div>
          <Link
            href="/settings"
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft size={14} />
            Back to System Settings Hub
          </Link>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <GitBranch size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold tracking-tight text-white">Centralized GitHub Settings</h1>
                  <span className="px-2.5 py-0.5 text-[11px] font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30 rounded-full flex items-center gap-1">
                    <Shield size={11} /> SUPER_ADMIN ONLY
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Manage dedicated GitHub App configurations, encrypted credentials, and webhooks with strict isolation.
                </p>
              </div>
            </div>

            {/* Scope Switcher Tabs */}
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1 gap-1">
              <button
                type="button"
                onClick={() => handleScopeChange('PROJECTS')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
                  activeScope === 'PROJECTS'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <FolderGit2 size={14} />
                Projects (Task Bar)
              </button>
              <button
                type="button"
                onClick={() => handleScopeChange('LAUNCHPAD')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
                  activeScope === 'LAUNCHPAD'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <GraduationCap size={14} />
                Launchpad (Academy)
              </button>
            </div>
          </div>
        </div>

        {/* Global Notifications */}
        {errorMsg && (
          <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-start gap-3">
            <XCircle size={16} className="shrink-0 mt-0.5 text-rose-400" />
            <div className="flex-1 font-medium">{errorMsg}</div>
          </div>
        )}
        {successMsg && (
          <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-xs flex items-start gap-3">
            <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-emerald-400" />
            <div className="flex-1 font-medium">{successMsg}</div>
          </div>
        )}

        {/* Safeguard & Scope Description Banner */}
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-start gap-3">
          <Info size={18} className="text-indigo-400 shrink-0 mt-0.5" />
          <div className="text-xs text-slate-300 space-y-1">
            <p className="font-semibold text-slate-100">
              {activeScope === 'PROJECTS'
                ? 'Internal Projects GitHub App Configuration'
                : 'Launchpad Student Academy GitHub App (Preserved)'}
            </p>
            <p className="text-slate-400 leading-relaxed">
              {activeScope === 'PROJECTS'
                ? 'Dedicated to internal company repositories only. Provides repo sync, task branches, pull requests, and collaborator access. Production deployment and production repo installations remain strictly ON HOLD.'
                : 'Preserves the existing neuravolt-launchpad GitHub App, credentials, and webhook endpoints for student curriculum assessments and automated wallet reward distribution without modification.'}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
            <RefreshCw size={24} className="animate-spin text-indigo-400" />
            <span className="text-xs">Loading integration status...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Status & Diagnostics Card */}
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Shield size={16} className="text-indigo-400" />
                    Security & Health
                  </h3>
                  <span
                    className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                      settings?.isPrivateKeyConfigured
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                    }`}
                  >
                    {settings?.isPrivateKeyConfigured ? 'READY' : 'INCOMPLETE'}
                  </span>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between py-1.5 border-b border-slate-800/80">
                    <span className="text-slate-400">Target Scope</span>
                    <span className="font-semibold text-slate-200">{settings?.scope}</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-slate-800/80">
                    <span className="text-slate-400">Storage Backend</span>
                    <span className="font-mono text-[11px] text-slate-200 bg-slate-800 px-2 py-0.5 rounded">
                      {settings?.source === 'DATABASE_ENCRYPTED' ? 'AES-256-GCM DB' : 'ENV FALLBACK'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-slate-800/80">
                    <span className="text-slate-400">App ID</span>
                    <span className="font-mono text-slate-200">{settings?.appId || 'Not Configured'}</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-slate-800/80">
                    <span className="text-slate-400">Private Key</span>
                    <span
                      className={`font-semibold ${
                        settings?.isPrivateKeyConfigured ? 'text-emerald-400' : 'text-slate-500'
                      }`}
                    >
                      {settings?.isPrivateKeyConfigured ? 'Configured (Encrypted)' : 'Missing'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-slate-800/80">
                    <span className="text-slate-400">Webhook Secret</span>
                    <span
                      className={`font-semibold ${
                        settings?.isWebhookSecretConfigured ? 'text-emerald-400' : 'text-slate-500'
                      }`}
                    >
                      {settings?.isWebhookSecretConfigured ? 'Configured (Encrypted)' : 'Missing'}
                    </span>
                  </div>
                </div>

                {/* Connection Test Diagnostics */}
                <div className="pt-2 border-t border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300">Remote API Status</span>
                    {settings?.lastTestStatus === 'SUCCESS' && (
                      <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                        <CheckCircle2 size={12} /> Connected
                      </span>
                    )}
                    {settings?.lastTestStatus === 'FAILED' && (
                      <span className="text-[10px] text-rose-400 font-bold flex items-center gap-1">
                        <XCircle size={12} /> Failed
                      </span>
                    )}
                    {!settings?.lastTestStatus && (
                      <span className="text-[10px] text-slate-500">Untested</span>
                    )}
                  </div>

                  {settings?.lastTestMessage && (
                    <p className="text-[11px] text-slate-400 bg-slate-950/60 p-2 rounded-lg border border-slate-800 font-mono break-words">
                      {settings.lastTestMessage}
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={testing || !settings?.isPrivateKeyConfigured}
                    className="w-full py-2 px-3 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 disabled:opacity-50 transition flex items-center justify-center gap-2"
                  >
                    <RefreshCw size={12} className={testing ? 'animate-spin' : ''} />
                    {testing ? 'Testing GitHub Connectivity...' : 'Test GitHub Connection'}
                  </button>
                </div>

                {/* Rollback Snapshot Panel */}
                {settings?.hasRollback && (
                  <div className="pt-2 border-t border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 flex items-center gap-1">
                        <RotateCcw size={12} className="text-amber-400" />
                        Previous Snapshot
                      </span>
                      <span className="text-[10px] text-amber-400 font-semibold">Available</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleRollback}
                      disabled={rollingBack}
                      className="w-full py-2 px-3 text-xs font-semibold rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition flex items-center justify-center gap-2"
                    >
                      <RotateCcw size={12} className={rollingBack ? 'animate-spin' : ''} />
                      {rollingBack ? 'Rolling back...' : 'Rollback to Previous Snapshot'}
                    </button>
                  </div>
                )}
              </div>

              {/* Webhook URLs Card */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <Key size={14} className="text-indigo-400" />
                    Webhook Configuration
                  </h3>
                  <button
                    type="button"
                    onClick={handleCopyWebhook}
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold"
                  >
                    {copiedWebhook ? <Check size={12} /> : <Copy size={12} />}
                    {copiedWebhook ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 font-mono text-[11px] text-slate-300 break-all select-all">
                  {settings?.webhookUrl}
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Configure this Webhook URL and the encrypted Webhook Secret in GitHub App settings. Content type must be set to <code className="text-indigo-300">application/json</code>.
                </p>
              </div>
            </div>

            {/* Credential Configuration Form */}
            <div className="lg:col-span-2">
              <form
                onSubmit={handleSave}
                className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 md:p-8 space-y-6 shadow-sm"
              >
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Lock size={16} className="text-indigo-400" />
                    Configure Encrypted GitHub Credentials ({activeScope})
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Credentials are encrypted at rest with AES-256-GCM. Plaintext secrets and private keys are never stored in the database or exposed to the frontend.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-300 uppercase tracking-wide mb-1.5 block">
                      GitHub App ID <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={appIdInput}
                      onChange={(e) => setAppIdInput(e.target.value)}
                      placeholder="e.g. 1198765"
                      className="w-full px-3.5 py-2.5 text-sm bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-100 placeholder:text-slate-600 font-mono"
                    />
                    <span className="text-[11px] text-slate-500 mt-1 block">
                      Numeric App ID provided by GitHub in App General settings.
                    </span>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-300 uppercase tracking-wide mb-1.5 block">
                      GitHub App Slug / Name
                    </label>
                    <input
                      type="text"
                      value={appNameInput}
                      onChange={(e) => setAppNameInput(e.target.value)}
                      placeholder={activeScope === 'PROJECTS' ? 'neuravolt-os-projects' : 'neuravolt-launchpad'}
                      className="w-full px-3.5 py-2.5 text-sm bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-100 placeholder:text-slate-600"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-slate-300 uppercase tracking-wide block">
                        RSA Private Key (PEM) <span className="text-rose-400">*</span>
                      </label>
                      {settings?.isPrivateKeyConfigured && (
                        <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                          <CheckCircle2 size={12} /> Currently Encrypted at Rest
                        </span>
                      )}
                    </div>
                    <textarea
                      rows={5}
                      value={privateKeyInput}
                      onChange={(e) => setPrivateKeyInput(e.target.value)}
                      placeholder={
                        settings?.isPrivateKeyConfigured
                          ? '•••••••••••••••••••••••••••••••• (Leave blank to keep existing encrypted key)'
                          : '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA0...'
                      }
                      className="w-full px-3.5 py-2.5 text-xs bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-100 placeholder:text-slate-600 font-mono leading-relaxed"
                    />
                    <span className="text-[11px] text-slate-500 mt-1 block">
                      Downloaded as a .pem file from GitHub. Only paste here if configuring or rotating.
                    </span>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-slate-300 uppercase tracking-wide block">
                        Webhook Secret
                      </label>
                      {settings?.isWebhookSecretConfigured && (
                        <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                          <CheckCircle2 size={12} /> Currently Encrypted at Rest
                        </span>
                      )}
                    </div>
                    <input
                      type="password"
                      value={webhookSecretInput}
                      onChange={(e) => setWebhookSecretInput(e.target.value)}
                      placeholder={
                        settings?.isWebhookSecretConfigured
                          ? '••••••••••••••••'
                          : 'Secret entered in GitHub App webhook configuration'
                      }
                      className="w-full px-3.5 py-2.5 text-sm bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-100 placeholder:text-slate-600 font-mono"
                    />
                    <span className="text-[11px] text-slate-500 mt-1 block">
                      Used to authenticate HMAC-SHA256 signatures on inbound webhook events.
                    </span>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-4">
                  <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                    <Lock size={12} />
                    AES-256-GCM zero-knowledge secret storage
                  </div>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-indigo-600/20"
                  >
                    <Key size={14} />
                    {saving ? 'Encrypting & Saving...' : 'Save Encrypted Settings'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
