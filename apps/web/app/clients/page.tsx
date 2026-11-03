'use client';

import { useState } from 'react';
import {
  Search, Plus, Building2, Mail, Phone, MapPin, Globe, Loader2, X,
  Pencil, Trash2, ChevronRight, Users, ExternalLink, MoreVertical,
  CheckCircle, XCircle, Tag, FileText, Clock
} from 'lucide-react';
import { useClients, useAllClients } from '../../src/hooks/queries';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../src/lib/api';
import { PageShell, PageHeader, Badge, Button, SearchInput, selectClass, th } from '../../src/components/ui/page';
import { KpiCard, ChartCard, BarList } from '../../src/components/ui/charts';

// ─── Types ──────────────────────────────────────────────────────────────────
interface ContactForm { name: string; email: string; phone: string; role: string; isPrimary: boolean; }
interface ClientForm { name: string; email: string; phone: string; address: string; website: string; industry: string; gstNumber: string; notes: string; status: string; contacts: ContactForm[]; }

const EMPTY_FORM: ClientForm = {
  name: '', email: '', phone: '', address: '', website: '',
  industry: '', gstNumber: '', notes: '', status: 'ACTIVE',
  contacts: [{ name: '', email: '', phone: '', role: '', isPrimary: true }],
};

const INDUSTRIES = ['Technology', 'Healthcare', 'Finance', 'Manufacturing', 'Retail', 'Education', 'Real Estate', 'E-Commerce', 'Media', 'Logistics', 'Other'];

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  ACTIVE:   { label: 'Active',   cls: 'bg-emerald-100 text-emerald-700' },
  INACTIVE: { label: 'Inactive', cls: 'bg-slate-100 text-slate-500' },
  PROSPECT: { label: 'Prospect', cls: 'bg-amber-100 text-amber-700' },
};

const inputCls = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors bg-white';
const labelCls = 'block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1';

// ─── Client Detail Panel ─────────────────────────────────────────────────────
// ─── Client Detail Panel ─────────────────────────────────────────────────────
function ClientDetailPanel({ client, onClose, onEdit, onDelete, onEnablePortal, onDisablePortal, onResetPortalPassword, portalActionLoading, onToggleCollect, collectActionLoading }: {
  client: any; onClose: () => void; onEdit: (c: any) => void; onDelete: (c: any) => void;
  onEnablePortal: (id: string) => Promise<void>; onDisablePortal: (id: string) => Promise<void>;
  onResetPortalPassword: (id: string) => Promise<void>;
  portalActionLoading: boolean;
  onToggleCollect: (id: string, enable: boolean) => Promise<void>;
  collectActionLoading: boolean;
}) {
  const fmtDate = (d: any) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  return (
    <div className="fixed inset-0 z-40 flex" onClick={onClose}>
      {/* Dim overlay */}
      <div className="flex-1 bg-black/30 backdrop-blur-sm" />
      {/* Side panel */}
      <div
        className="w-full max-w-md bg-white h-full shadow-2xl overflow-y-auto flex flex-col animate-in slide-in-from-right duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 p-6 text-white">
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <Building2 size={24} className="text-white" />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onEdit(client)}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors" title="Edit"
              >
                <Pencil size={15} />
              </button>
              <button
                onClick={() => onDelete(client)}
                className="p-2 bg-red-500/30 hover:bg-red-500/50 rounded-lg transition-colors" title="Delete"
              >
                <Trash2 size={15} />
              </button>
              <button onClick={onClose} className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors">
                <X size={15} />
              </button>
            </div>
          </div>
          <h2 className="text-xl font-bold">{client.name}</h2>
          <div className="flex items-center gap-2 mt-2">
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_CONFIG[client.status]?.cls ?? 'bg-slate-100 text-slate-500'}`}>
              {STATUS_CONFIG[client.status]?.label ?? client.status}
            </span>
            {client.industry && (
              <span className="text-xs text-indigo-200 flex items-center gap-1"><Tag size={11} />{client.industry}</span>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5 flex-1">
          {/* Contact Info */}
          <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Contact Information</h3>
            <div className="space-y-2.5">
              {client.email && (
                <div className="flex items-center gap-3 text-sm text-slate-700">
                  <Mail size={15} className="text-slate-400 shrink-0" />
                  <a href={`mailto:${client.email}`} className="hover:text-indigo-600 hover:underline">{client.email}</a>
                </div>
              )}
              {client.phone && (
                <div className="flex items-center gap-3 text-sm text-slate-700">
                  <Phone size={15} className="text-slate-400 shrink-0" />
                  <a href={`tel:${client.phone}`} className="hover:text-indigo-600">{client.phone}</a>
                </div>
              )}
              {client.address && (
                <div className="flex items-start gap-3 text-sm text-slate-700">
                  <MapPin size={15} className="text-slate-400 shrink-0 mt-0.5" />
                  <span>{client.address}</span>
                </div>
              )}
              {client.website && (
                <div className="flex items-center gap-3 text-sm text-slate-700">
                  <Globe size={15} className="text-slate-400 shrink-0" />
                  <a href={client.website} target="_blank" rel="noreferrer" className="hover:text-indigo-600 hover:underline flex items-center gap-1">
                    {client.website} <ExternalLink size={11} />
                  </a>
                </div>
              )}
              {client.gstNumber && (
                <div className="flex items-center gap-3 text-sm text-slate-700">
                  <FileText size={15} className="text-slate-400 shrink-0" />
                  <span>GST: <span className="font-mono font-medium">{client.gstNumber}</span></span>
                </div>
              )}
            </div>
          </div>

          {/* Contact Persons */}
          {(client.contactPersons ?? []).length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Contact Persons</h3>
              <div className="space-y-2">
                {client.contactPersons.map((cp: any) => (
                  <div key={cp.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                    <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-bold shrink-0">
                      {cp.name?.charAt(0)?.toUpperCase() ?? '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-900">{cp.name}</span>
                        {cp.isPrimary && <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">Primary</span>}
                      </div>
                      {cp.role && <div className="text-xs text-slate-500">{cp.role}</div>}
                      {cp.email && <div className="text-xs text-slate-400 truncate">{cp.email}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {client.notes && (
            <div>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Notes</h3>
              <p className="text-sm text-slate-600 bg-slate-50 rounded-xl p-3 leading-relaxed">{client.notes}</p>
            </div>
          )}

          {/* Portal Access */}
          <div className="border-t border-slate-100 pt-4">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Portal Access</h3>
            {client.clientUser?.portalEnabled ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500 font-medium">Status</span>
                  <span className="font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full text-xs">Enabled</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500 font-medium">Portal Email</span>
                  <span className="font-semibold text-slate-800">{client.clientUser.email}</span>
                </div>
                {client.clientUser.lastLoginAt && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500 font-medium">Last Login</span>
                    <span className="text-slate-600 font-medium">{fmtDate(client.clientUser.lastLoginAt)}</span>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => onResetPortalPassword(client.id)}
                    disabled={portalActionLoading}
                    className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {portalActionLoading && <Loader2 size={13} className="animate-spin" />}
                    Reset Password
                  </button>
                  <button
                    type="button"
                    onClick={() => onDisablePortal(client.id)}
                    disabled={portalActionLoading}
                    className="px-3 py-2 border border-red-200 text-red-650 hover:bg-red-50 rounded-xl text-xs font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {portalActionLoading && <Loader2 size={13} className="animate-spin" />}
                    Disable Portal
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500 font-medium">Status</span>
                  <span className="font-semibold text-slate-400 bg-slate-50 px-2.5 py-0.5 rounded-full text-xs">Disabled</span>
                </div>
                <button
                  type="button"
                  onClick={() => onEnablePortal(client.id)}
                  disabled={portalActionLoading}
                  className="w-full px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm disabled:opacity-60 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {portalActionLoading && <Loader2 size={13} className="animate-spin" />}
                  Enable Portal Access
                </button>
              </div>
            )}
          </div>

          {/* NeuraCollect Merchant Gateway Access */}
          <div className="border-t border-slate-100 pt-4">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">NeuraCollect Merchant Gateway</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500 font-medium">Gateway Service</span>
                <span className={`font-semibold px-2.5 py-0.5 rounded-full text-xs ${
                  client.collectEnabled
                    ? 'text-emerald-700 bg-emerald-50'
                    : 'text-slate-500 bg-slate-100'
                }`}>
                  {client.collectEnabled ? 'Activated' : 'Inactive'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {client.collectEnabled
                  ? 'Client has access to NeuraCollect merchant portal, API keys, wallet balance, and payout requests.'
                  : 'Enable to allow client to generate API keys, accept customer payments, and request balance withdrawals.'}
              </p>
              <button
                type="button"
                onClick={() => onToggleCollect(client.id, !client.collectEnabled)}
                disabled={collectActionLoading}
                className={`w-full px-4 py-2.5 rounded-xl text-xs font-bold transition-colors shadow-sm disabled:opacity-60 flex items-center justify-center gap-1.5 cursor-pointer ${
                  client.collectEnabled
                    ? 'border border-amber-300 text-amber-800 hover:bg-amber-50'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                }`}
              >
                {collectActionLoading && <Loader2 size={13} className="animate-spin" />}
                {client.collectEnabled ? 'Deactivate NeuraCollect Gateway' : 'Activate NeuraCollect Gateway'}
              </button>
            </div>
          </div>

          {/* Meta */}
          <div className="border-t border-slate-100 pt-4">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Clock size={12} />
              <span>Added {new Date(client.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
            </div>
          </div>
        </div>

        {/* Footer CTA */}
        <div className="p-4 border-t border-slate-100 grid grid-cols-2 gap-2">
          <button onClick={() => onEdit(client)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-colors">
            <Pencil size={14} /> Edit Client
          </button>
          <button onClick={() => onDelete(client)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-655 border border-red-200 rounded-xl text-sm font-medium transition-colors">
            <Trash2 size={14} /> Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Client Form Modal ────────────────────────────────────────────────────────
function ClientModal({ isEdit, initial, onClose, onSave }: {
  isEdit: boolean;
  initial: ClientForm;
  onClose: () => void;
  onSave: (data: ClientForm, enablePortal?: boolean) => Promise<void>;
}) {
  const [form, setForm] = useState<ClientForm>(initial);
  const [enablePortal, setEnablePortal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const set = (k: keyof ClientForm, v: string) => setForm(f => ({ ...f, [k]: v }));
  const setContact = (k: keyof ContactForm, v: string) =>
    setForm(f => ({ ...f, contacts: [{ ...f.contacts[0], [k]: v }] }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Client name is required.'); return; }
    if (!isEdit && enablePortal && !form.email.trim()) {
      setError('Company email is required to enable portal access immediately.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await onSave(form, enablePortal);
      onClose();
    } catch (err: any) {
      const status = err?.response?.status;
      const data = err?.response?.data;
      const msg = data?.message;

      // Handle validation errors — NestJS class-validator returns an array
      if (Array.isArray(msg)) {
        setError('Please fix the following: ' + msg.join('. '));
      } else if (status === 403) {
        setError('Permission denied. Your account does not have access to perform this action. Contact your administrator.');
      } else if (status === 401) {
        setError('Session expired. Please refresh the page and log in again.');
      } else if (status === 409) {
        setError(msg ?? 'A client with this email already exists. Please use a different email.');
      } else if (status === 400 && msg) {
        setError(typeof msg === 'string' ? msg : 'Invalid data. Please check all fields and try again.');
      } else if (msg) {
        setError(typeof msg === 'string' ? msg : 'Failed to save. Please try again.');
      } else {
        setError('Failed to save. Please check your network connection and try again.');
      }
    } finally { setSubmitting(false); }
  };


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{isEdit ? 'Edit Client' : 'Add New Client'}</h2>
            <p className="text-xs text-slate-500 mt-0.5">{isEdit ? 'Update client information' : 'Fill in the details to create a new client'}</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>}

          {/* Company Info */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Company Information</h3>
            <div>
              <label className={labelCls}>Company Name *</label>
              <input required value={form.name} onChange={e => set('name', e.target.value)}
                placeholder="e.g. Acme Corporation" className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Email</label>
                <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                  placeholder="billing@acme.com" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Phone</label>
                <input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)}
                  placeholder="+91 98765 43210" className={inputCls} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Address</label>
              <input value={form.address} onChange={e => set('address', e.target.value)}
                placeholder="123 Business Ave, Mumbai, Maharashtra" className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Website</label>
                <input type="url" value={form.website} onChange={e => set('website', e.target.value)}
                  placeholder="https://acme.com" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Industry</label>
                <select value={form.industry} onChange={e => set('industry', e.target.value)} className={inputCls}>
                  <option value="">Select Industry</option>
                  {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>GST Number</label>
                <input value={form.gstNumber} onChange={e => set('gstNumber', e.target.value)}
                  placeholder="22AAAAA0000A1Z5" className={`${inputCls} font-mono uppercase`} />
              </div>
              {isEdit && (
                <div>
                  <label className={labelCls}>Status</label>
                  <select value={form.status} onChange={e => set('status', e.target.value)} className={inputCls}>
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                    <option value="PROSPECT">Prospect</option>
                  </select>
                </div>
              )}
            </div>
            <div>
              <label className={labelCls}>Notes</label>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
                rows={2} placeholder="Any additional notes about this client…" className={`${inputCls} resize-none`} />
            </div>
          </div>

          {/* Primary Contact */}
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Primary Contact Person</h3>
            <div>
              <label className={labelCls}>Contact Name</label>
              <input value={form.contacts[0].name} onChange={e => setContact('name', e.target.value)}
                placeholder="Rajesh Sharma" className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Contact Email</label>
                <input type="email" value={form.contacts[0].email} onChange={e => setContact('email', e.target.value)}
                  placeholder="rajesh@acme.com" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Designation</label>
                <input value={form.contacts[0].role} onChange={e => setContact('role', e.target.value)}
                  placeholder="CEO, CTO, Manager…" className={inputCls} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Contact Phone</label>
              <input type="tel" value={form.contacts[0].phone} onChange={e => setContact('phone', e.target.value)}
                placeholder="+91 98765 43210" className={inputCls} />
            </div>
          </div>

          {/* Enable Portal Checkbox (only on creation) */}
          {!isEdit && (
            <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
              <input
                type="checkbox"
                id="enablePortal"
                checked={enablePortal}
                onChange={e => setEnablePortal(e.target.checked)}
                className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
              />
              <label htmlFor="enablePortal" className="text-sm font-semibold text-slate-750 cursor-pointer select-none">
                Enable Portal Access immediately
              </label>
            </div>
          )}

          {/* Footer */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={submitting}
              className="flex-1 flex items-center justify-center px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 rounded-xl transition-colors">
              {submitting ? <><Loader2 size={15} className="mr-2 animate-spin" /> Saving…</> : isEdit ? 'Save Changes' : 'Create Client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────
function DeleteModal({ client, onClose, onConfirm }: { client: any; onClose: () => void; onConfirm: () => Promise<void>; }) {
  const [deleting, setDeleting] = useState(false);
  const handle = async () => {
    setDeleting(true);
    try { await onConfirm(); onClose(); }
    catch { alert('Failed to delete client'); }
    finally { setDeleting(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <Trash2 size={22} className="text-red-600" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 text-center">Delete Client?</h2>
        <p className="text-sm text-slate-500 text-center mt-1">
          Are you sure you want to delete <span className="font-semibold text-slate-900">{client.name}</span>?
          This cannot be undone and will remove all associated data.
        </p>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors">
            Cancel
          </button>
          <button onClick={handle} disabled={deleting}
            className="flex-1 flex items-center justify-center px-4 py-2.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 rounded-xl transition-colors">
            {deleting ? <><Loader2 size={14} className="mr-2 animate-spin" />Deleting…</> : 'Yes, Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
function CredentialsModal({ credentials, onClose }: {
  credentials: { email: string; tempPassword?: string; message?: string };
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(`Email/ID: ${credentials.email}\nPassword: ${credentials.tempPassword || 'Check your email'}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
          <CheckCircle size={22} className="text-emerald-600" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 text-center">Portal Credentials</h2>
        <p className="text-xs text-slate-500 text-center">
          {credentials.message || 'Credentials have been generated successfully.'}
        </p>

        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3 font-semibold text-xs text-slate-700">
          <div>
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">Portal Login Email</span>
            <span className="font-mono text-slate-900 block select-all">{credentials.email}</span>
          </div>
          {credentials.tempPassword && (
            <div>
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">Temporary Password</span>
              <span className="font-mono text-slate-900 block select-all">{credentials.tempPassword}</span>
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={handleCopy} className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm cursor-pointer">
            {copied ? 'Copied!' : 'Copy Credentials'}
          </button>
          <button onClick={onClose} className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ClientsPage() {
  const [search, setSearch] = useState('');
  const [industry, setIndustry] = useState('');
  const [status, setStatus] = useState('');
  const [view, setView] = useState<'grid' | 'table'>('grid');

  // Modals / panels state
  const [showAdd, setShowAdd] = useState(false);
  const [editClient, setEditClient] = useState<any>(null);
  const [deleteClient, setDeleteClient] = useState<any>(null);
  const [detailClient, setDetailClient] = useState<any>(null);
  const [portalActionLoading, setPortalActionLoading] = useState(false);
  const [collectActionLoading, setCollectActionLoading] = useState(false);
  const [credentials, setCredentials] = useState<{ email: string; tempPassword?: string; message?: string } | null>(null);

  const queryClient = useQueryClient();

  const handleToggleCollect = async (clientId: string, enable: boolean) => {
    setCollectActionLoading(true);
    try {
      await api.patch(`/clients/${clientId}`, { collectEnabled: enable });
      await queryClient.invalidateQueries({ queryKey: ['clients'] });
      await queryClient.invalidateQueries({ queryKey: ['clients-all'] });
      if (detailClient && detailClient.id === clientId) {
        setDetailClient((prev: any) => ({
          ...prev,
          collectEnabled: enable,
        }));
      }
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to update NeuraCollect status.');
    } finally {
      setCollectActionLoading(false);
    }
  };
  const { data, isLoading, isError } = useClients({
    search: search || undefined,
    industry: industry || undefined,
    status: status || undefined,
    limit: 100,
  });

  const clients = data?.clients ?? [];
  const total = data?.total ?? 0;
  const { data: allClientsData } = useAllClients();
  const allClients = allClientsData ?? [];

  const handleEnablePortal = async (clientId: string) => {
    setPortalActionLoading(true);
    try {
      const { data } = await api.post(`/clients/${clientId}/portal/enable`);
      setCredentials({
        email: data.email,
        tempPassword: data.tempPassword,
        message: data.message,
      });
      await queryClient.invalidateQueries({ queryKey: ['clients'] });
      await queryClient.invalidateQueries({ queryKey: ['clients-all'] });
      
      // Update local detailClient state to reflect the new clientUser
      if (detailClient && detailClient.id === clientId) {
        setDetailClient((prev: any) => ({
          ...prev,
          clientUser: {
            id: 'temp-id',
            email: data.email,
            portalEnabled: true,
            isActive: true,
          },
        }));
      }
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to enable portal access.');
    } finally {
      setPortalActionLoading(false);
    }
  };

  const handleDisablePortal = async (clientId: string) => {
    if (!confirm('Are you sure you want to disable portal access for this client? They will not be able to log in.')) {
      return;
    }
    setPortalActionLoading(true);
    try {
      await api.post(`/clients/${clientId}/portal/disable`);
      await queryClient.invalidateQueries({ queryKey: ['clients'] });
      await queryClient.invalidateQueries({ queryKey: ['clients-all'] });
      
      // Update local detailClient state to reflect the disabled clientUser
      if (detailClient && detailClient.id === clientId) {
        setDetailClient((prev: any) => ({
          ...prev,
          clientUser: undefined,
        }));
      }
      alert('Portal access disabled successfully.');
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to disable portal access.');
    } finally {
      setPortalActionLoading(false);
    }
  };

  const handleResetPortalPassword = async (clientId: string) => {
    if (!confirm('Are you sure you want to reset portal password for this client? A new temporary password will be generated.')) {
      return;
    }
    setPortalActionLoading(true);
    try {
      const { data } = await api.post(`/clients/${clientId}/portal/reset-password`);
      setCredentials({
        email: data.email,
        tempPassword: data.tempPassword,
        message: data.message,
      });
      await queryClient.invalidateQueries({ queryKey: ['clients'] });
      await queryClient.invalidateQueries({ queryKey: ['clients-all'] });
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to reset portal password.');
    } finally {
      setPortalActionLoading(false);
    }
  };

  // ── API actions
  const handleCreate = async (form: ClientForm, enablePortal?: boolean) => {
    const payload = {
      name: form.name.trim(),
      email: form.email.trim() || undefined,
      phone: form.phone.trim() || undefined,
      address: form.address.trim() || undefined,
      website: form.website.trim() || undefined,
      industry: form.industry.trim() || undefined,
      gstNumber: form.gstNumber.trim() || undefined,
      notes: form.notes.trim() || undefined,
      contacts: form.contacts[0].name.trim()
        ? [{ ...form.contacts[0], phone: form.contacts[0].phone || undefined }]
        : [],
    };
    const response = await api.post('/clients', payload);
    const createdClient = response.data;

    if (enablePortal && createdClient?.id) {
      try {
        const portalRes = await api.post(`/clients/${createdClient.id}/portal/enable`);
        setCredentials({
          email: portalRes.data.email,
          tempPassword: portalRes.data.tempPassword,
          message: portalRes.data.message,
        });
      } catch (err: any) {
        alert('Client created, but failed to enable portal access: ' + (err?.response?.data?.message || err.message));
      }
    }

    await queryClient.invalidateQueries({ queryKey: ['clients'] });
    await queryClient.invalidateQueries({ queryKey: ['clients-all'] });
  };

  const handleEdit = async (form: ClientForm) => {
    if (!editClient?.id) return;
    const payload = {
      name: form.name.trim(),
      email: form.email.trim() || undefined,
      phone: form.phone.trim() || undefined,
      address: form.address.trim() || undefined,
      website: form.website.trim() || undefined,
      industry: form.industry.trim() || undefined,
      gstNumber: form.gstNumber.trim() || undefined,
      notes: form.notes.trim() || undefined,
      status: form.status || undefined,
      contacts: form.contacts[0].name.trim()
        ? [{ ...form.contacts[0], phone: form.contacts[0].phone || undefined }]
        : [],
    };
    await api.patch(`/clients/${editClient.id}`, payload);
    await queryClient.invalidateQueries({ queryKey: ['clients'] });
    await queryClient.invalidateQueries({ queryKey: ['clients-all'] });
    setDetailClient(null);
  };

  const handleDelete = async () => {
    if (!deleteClient?.id) return;
    await api.delete(`/clients/${deleteClient.id}`);
    await queryClient.invalidateQueries({ queryKey: ['clients'] });
    await queryClient.invalidateQueries({ queryKey: ['clients-all'] });
    setDetailClient(null);
    setDeleteClient(null);
  };

  const handleToggleStatus = async (client: any) => {
    const newStatus = client.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    await api.patch(`/clients/${client.id}`, { status: newStatus });
    await queryClient.invalidateQueries({ queryKey: ['clients'] });
  };

  const openEdit = (c: any) => {
    // Pre-fill the edit form with the existing client data including status
    setEditClient({
      ...c,
      _initialForm: {
        name: c.name ?? '',
        email: c.email ?? '',
        phone: c.phone ?? '',
        address: c.address ?? '',
        website: c.website ?? '',
        industry: c.industry ?? '',
        gstNumber: c.gstNumber ?? '',
        notes: c.notes ?? '',
        status: c.status ?? 'ACTIVE',
        contacts: c.contacts?.length
          ? c.contacts
          : [{ name: '', email: '', phone: '', role: '', isPrimary: true }],
      },
    });
    setDetailClient(null);
  };
  const openDelete = (c: any) => {
    setDeleteClient(c);
  };

  // Counts cover every client, not just the filtered list, so a filter never zeroes the other cards.
  const countStatus = (st: string) => allClients.filter((c: any) => c.status === st).length;
  const byIndustry = Object.entries(allClients.reduce((acc: Record<string, number>, c: any) => { const k = c.industry || 'Not set'; acc[k] = (acc[k] ?? 0) + 1; return acc; }, {}))
    .sort((x: any, y: any) => y[1] - x[1]).slice(0, 6).map(([k, v]) => ({ label: k, value: v as number }));
  const toggleStatus = (st: string) => setStatus(status === st ? '' : st);
  const STATUS_TONE: Record<string, 'green' | 'slate' | 'amber'> = { ACTIVE: 'green', INACTIVE: 'slate', PROSPECT: 'amber' };

  return (
    <PageShell>
      <div className="max-w-7xl mx-auto space-y-5">
        <PageHeader
          icon={Building2}
          title="Clients"
          subtitle={total > 0 ? `${total} client${total > 1 ? 's' : ''} total` : 'Manage your client portfolio'}
          actions={<Button variant="primary" onClick={() => setShowAdd(true)}><Plus size={16} /> Add client</Button>}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="grid grid-cols-2 gap-3 lg:col-span-2 content-start">
            <KpiCard tone="ok" icon={CheckCircle} value={countStatus('ACTIVE')} label="Active" active={status === 'ACTIVE'} onClick={() => toggleStatus('ACTIVE')} />
            <KpiCard tone="warning" icon={Clock} value={countStatus('PROSPECT')} label="Prospects" active={status === 'PROSPECT'} onClick={() => toggleStatus('PROSPECT')} />
            <KpiCard tone="neutral" icon={XCircle} value={countStatus('INACTIVE')} label="Inactive" active={status === 'INACTIVE'} onClick={() => toggleStatus('INACTIVE')} />
            <KpiCard tone="info" icon={Users} value={allClients.length} label="Total clients" />
          </div>
          <ChartCard title="Clients by industry">
            <BarList items={byIndustry} empty="No clients yet." />
          </ChartCard>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 bg-white p-3 rounded-2xl border border-slate-200">
          <SearchInput className="flex-1 min-w-48" value={search} onChange={setSearch} placeholder="Search by name, email, phone…" />
          <select value={industry} onChange={e => setIndustry(e.target.value)} className={selectClass}>
            <option value="">All industries</option>
            {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
          </select>
          <select value={status} onChange={e => setStatus(e.target.value)} className={selectClass}>
            <option value="">All status</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="PROSPECT">Prospect</option>
          </select>
          {/* View toggle */}
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
            <button onClick={() => setView('grid')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${view === 'grid' ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}>
              Grid
            </button>
            <button onClick={() => setView('table')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${view === 'table' ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}>
              Table
            </button>
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={32} className="text-indigo-600 animate-spin" />
          </div>
        )}

        {/* Error */}
        {isError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
            Failed to load clients. Make sure the API server is running on port 3001.
          </div>
        )}

        {/* Empty */}
        {!isLoading && !isError && clients.length === 0 && (
          <div className="text-center py-24 bg-white border border-slate-200 rounded-2xl">
            <Building2 size={48} className="mx-auto mb-4 text-slate-200" />
            <p className="font-semibold text-slate-500">No clients found</p>
            <p className="text-sm text-slate-400 mt-1 mb-6">
              {search || industry || status ? 'Try adjusting your filters' : 'Click "Add Client" to create your first client.'}
            </p>
            {!search && !industry && !status && (
              <button onClick={() => setShowAdd(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-colors">
                <Plus size={15} /> Add First Client
              </button>
            )}
          </div>
        )}

        {/* Grid View */}
        {!isLoading && !isError && clients.length > 0 && view === 'grid' && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {clients.map((client: any) => (
              <div key={client.id}
                className="bg-white rounded-2xl border border-slate-200 hover:border-indigo-200 hover:shadow-sm transition-all duration-200 flex flex-col group overflow-hidden">
                {/* Card body */}
                <div className="p-5 flex-1 cursor-pointer" onClick={() => setDetailClient(client)}>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-lg shrink-0">
                        {client.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 group-hover:text-indigo-700 transition-colors leading-tight">{client.name}</h3>
                        <p className="text-xs text-slate-400 mt-0.5">{client.industry ?? 'No Industry'}</p>
                      </div>
                    </div>
                    <Badge tone={STATUS_TONE[client.status] ?? 'slate'} dot>{STATUS_CONFIG[client.status]?.label ?? client.status}</Badge>
                  </div>

                  <div className="space-y-2">
                    {client.email && (
                      <div className="flex items-center gap-2 text-xs text-slate-500 truncate">
                        <Mail size={12} className="shrink-0 text-slate-400" />{client.email}
                      </div>
                    )}
                    {client.phone && (
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Phone size={12} className="shrink-0 text-slate-400" />{client.phone}
                      </div>
                    )}
                    {client.address && (
                      <div className="flex items-start gap-2 text-xs text-slate-500 truncate">
                        <MapPin size={12} className="shrink-0 text-slate-400 mt-0.5" />{client.address}
                      </div>
                    )}
                  </div>
                </div>

                {/* Card footer with actions */}
                <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {(client.contactPersons ?? []).length > 0 && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Users size={11} />
                        {client.contactPersons[0]?.name ?? 'Contact'}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setDetailClient(client)}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="View Details"
                    >
                      <ChevronRight size={15} />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); openEdit(client); }}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit Client"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); openDelete(client); }}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete Client"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Table View */}
        {!isLoading && !isError && clients.length > 0 && view === 'table' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="border-b border-slate-100">
                <tr>
                  <th className={`${th} text-left`}>Client</th>
                  <th className={`${th} text-left`}>Contact</th>
                  <th className={`${th} text-left`}>Industry</th>
                  <th className={`${th} text-center`}>Status</th>
                  <th className={`${th} text-right`}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {clients.map((client: any) => (
                  <tr key={client.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-5 py-4">
                      <button onClick={() => setDetailClient(client)} className="flex items-center gap-3 text-left">
                        <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-700 font-bold shrink-0">
                          {client.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-slate-900 hover:text-indigo-700">{client.name}</div>
                          {client.email && <div className="text-xs text-slate-400">{client.email}</div>}
                        </div>
                      </button>
                    </td>
                    <td className="px-5 py-4">
                      <div className="text-sm text-slate-700">{client.contactPersons?.[0]?.name ?? '—'}</div>
                      {client.phone && <div className="text-xs text-slate-400">{client.phone}</div>}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">{client.industry ?? '—'}</td>
                    <td className="px-5 py-4 text-center">
                      <button onClick={() => handleToggleStatus(client)} title="Click to toggle status">
                        <Badge tone={STATUS_TONE[client.status] ?? 'slate'} dot>{STATUS_CONFIG[client.status]?.label ?? client.status}</Badge>
                      </button>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => setDetailClient(client)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="View">
                          <ChevronRight size={15} />
                        </button>
                        <button onClick={() => openEdit(client)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => openDelete(client)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modals / Panels ── */}

      {/* Add Client */}
      {showAdd && (
        <ClientModal isEdit={false} initial={EMPTY_FORM} onClose={() => setShowAdd(false)} onSave={handleCreate} />
      )}

      {/* Edit Client */}
      {editClient && (
        <ClientModal
          isEdit={true}
          initial={editClient._initialForm ?? {
            name: editClient.name ?? '',
            email: editClient.email ?? '',
            phone: editClient.phone ?? '',
            address: editClient.address ?? '',
            website: editClient.website ?? '',
            industry: editClient.industry ?? '',
            gstNumber: editClient.gstNumber ?? '',
            notes: editClient.notes ?? '',
            status: editClient.status ?? 'ACTIVE',
            contacts: (editClient.contacts ?? editClient.contactPersons ?? []).length > 0
              ? [{ name: (editClient.contacts ?? editClient.contactPersons)[0].name ?? '', email: (editClient.contacts ?? editClient.contactPersons)[0].email ?? '', phone: (editClient.contacts ?? editClient.contactPersons)[0].phone ?? '', role: (editClient.contacts ?? editClient.contactPersons)[0].role ?? '', isPrimary: true }]
              : [{ name: '', email: '', phone: '', role: '', isPrimary: true }],
          }}
          onClose={() => setEditClient(null)}
          onSave={handleEdit}
        />
      )}

      {/* Delete Confirm */}
      {deleteClient && (
        <DeleteModal client={deleteClient} onClose={() => setDeleteClient(null)} onConfirm={handleDelete} />
      )}

      {/* Detail Panel */}
      {detailClient && (
        <ClientDetailPanel
          client={detailClient}
          onClose={() => setDetailClient(null)}
          onEdit={c => { setDetailClient(null); openEdit(c); }}
          onDelete={c => { setDetailClient(null); openDelete(c); }}
          onEnablePortal={handleEnablePortal}
          onDisablePortal={handleDisablePortal}
          onResetPortalPassword={handleResetPortalPassword}
          portalActionLoading={portalActionLoading}
          onToggleCollect={handleToggleCollect}
          collectActionLoading={collectActionLoading}
        />
      )}

      {/* Credentials Modal */}
      {credentials && (
        <CredentialsModal credentials={credentials} onClose={() => setCredentials(null)} />
      )}
    </PageShell>
  );
}
