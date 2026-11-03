'use client';
import { useState } from 'react';
import {
  useServiceCatalog,
  useCreateService,
  useUpdateService,
  useSeedServiceCatalog,
  useUpsertRateCard,
  useBundles,
  useCreateBundle,
} from '../../../src/hooks/queries';
import { Plus, Layers, Edit3, ToggleLeft, ToggleRight, Sparkles, Search, IndianRupee, ArrowLeft, Percent, Gift, Tag } from 'lucide-react';
import Link from 'next/link';

const UNIT_TYPES = ['Fixed', 'Hour', 'Sprint', 'Page', 'Month', 'Yearly'];
const CLIENT_TIERS = ['STARTUP', 'SMB', 'ENTERPRISE', 'CUSTOM'];
const labelCls = 'text-xs font-semibold text-slate-500 uppercase tracking-wide';

export default function ServiceCatalogSettingsPage() {
  const { data, isLoading } = useServiceCatalog({ activeOnly: 'false' });
  const { data: bundles = [], isLoading: loadingBundles } = useBundles();

  const createMutation = useCreateService();
  const updateMutation = useUpdateService();
  const seedMutation = useSeedServiceCatalog();
  const upsertRateCardMutation = useUpsertRateCard();
  const createBundleMutation = useCreateBundle();

  const [activeTab, setActiveTab] = useState<'services' | 'rate-cards' | 'bundles'>('services');

  // Services state
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [editService, setEditService] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [serviceForm, setServiceForm] = useState({
    serviceCode: '', category: '', subCategory: '', name: '',
    description: '', unitType: 'Fixed', basePrice: '', costPrice: '', gstRate: 18,
  });

  // Rate card state
  const [rateCardForm, setRateCardForm] = useState({
    serviceId: '',
    clientTier: 'STARTUP',
    customPrice: '',
    discountPercent: '0',
  });
  const [rateCardStatus, setRateCardStatus] = useState<string | null>(null);

  // Bundle state
  const [showBundleForm, setShowBundleForm] = useState(false);
  const [bundleForm, setBundleForm] = useState({
    name: '',
    description: '',
    selectedServices: [] as string[],
    totalPrice: '',
  });

  const services = data?.services ?? [];
  const categories = [...new Set(services.map((s: any) => s.category))];

  const filtered = services.filter((s: any) => {
    const q = search.toLowerCase();
    return (
      (!filterCategory || s.category === filterCategory) &&
      (!q || s.name.toLowerCase().includes(q) || s.serviceCode.toLowerCase().includes(q) || s.category.toLowerCase().includes(q))
    );
  });

  const grouped = filtered.reduce((acc: any, s: any) => {
    if (!acc[s.category]) acc[s.category] = {};
    if (!acc[s.category][s.subCategory]) acc[s.category][s.subCategory] = [];
    acc[s.category][s.subCategory].push(s);
    return acc;
  }, {});

  const handleServiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...serviceForm,
      basePrice: Number(serviceForm.basePrice),
      costPrice: Number(serviceForm.costPrice),
      gstRate: Number(serviceForm.gstRate),
    };
    if (editService) {
      await updateMutation.mutateAsync({ id: editService.id, ...payload });
    } else {
      await createMutation.mutateAsync(payload);
    }
    setShowServiceForm(false);
    setEditService(null);
    setServiceForm({ serviceCode: '', category: '', subCategory: '', name: '', description: '', unitType: 'Fixed', basePrice: '', costPrice: '', gstRate: 18 });
  };

  const startEditService = (svc: any) => {
    setEditService(svc);
    setServiceForm({
      serviceCode: svc.serviceCode,
      category: svc.category,
      subCategory: svc.subCategory,
      name: svc.name,
      description: svc.description ?? '',
      unitType: svc.unitType,
      basePrice: String(svc.basePrice),
      costPrice: String(svc.costPrice),
      gstRate: svc.gstRate ?? 18,
    });
    setShowServiceForm(true);
  };

  const toggleServiceActive = (svc: any) =>
    updateMutation.mutateAsync({ id: svc.id, isActive: !svc.isActive });

  const handleRateCardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rateCardForm.serviceId) {
      alert('Please select a service');
      return;
    }
    await upsertRateCardMutation.mutateAsync({
      serviceId: rateCardForm.serviceId,
      clientTier: rateCardForm.clientTier,
      customPrice: Number(rateCardForm.customPrice),
      discountPercent: Number(rateCardForm.discountPercent),
    });
    setRateCardStatus('Rate card upserted successfully!');
    setRateCardForm(f => ({ ...f, customPrice: '', discountPercent: '0' }));
    setTimeout(() => setRateCardStatus(null), 3000);
  };

  const handleBundleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (bundleForm.selectedServices.length === 0) {
      alert('Please select at least one service for the bundle');
      return;
    }
    await createBundleMutation.mutateAsync({
      name: bundleForm.name,
      description: bundleForm.description,
      services: bundleForm.selectedServices,
      totalPrice: Number(bundleForm.totalPrice),
    });
    setShowBundleForm(false);
    setBundleForm({ name: '', description: '', selectedServices: [], totalPrice: '' });
  };

  const toggleServiceInBundle = (serviceId: string) => {
    setBundleForm(prev => {
      const isSelected = prev.selectedServices.includes(serviceId);
      const selectedServices = isSelected
        ? prev.selectedServices.filter(id => id !== serviceId)
        : [...prev.selectedServices, serviceId];

      // Sum up base prices as default total price
      const total = selectedServices.reduce((sum, id) => {
        const s = services.find((x: any) => x.id === id);
        return sum + (s ? Number(s.basePrice) : 0);
      }, 0);

      return {
        ...prev,
        selectedServices,
        totalPrice: String(total),
      };
    });
  };

  const fmt = (n: any) => `₹${Number(n).toLocaleString('en-IN')}`;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Back Link */}
        <div className="mb-4">
          <Link href="/settings" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 transition-colors">
            <ArrowLeft size={16} /> Back to Settings
          </Link>
        </div>

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Layers size={24} className="text-indigo-600" /> Service Catalog & Rates
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Configure agency service codes, tier-based client rate cards, and promotional bundles.
            </p>
          </div>
          <div className="flex gap-2">
            {activeTab === 'services' && (
              <>
                <button
                  onClick={() => seedMutation.mutateAsync()}
                  disabled={seedMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-semibold text-sm transition-all"
                >
                  <Sparkles size={16} />
                  {seedMutation.isPending ? 'Seeding…' : 'Seed Defaults'}
                </button>
                <button
                  onClick={() => { setShowServiceForm(true); setEditService(null); }}
                  className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-sm transition-all"
                >
                  <Plus size={16} /> Add Service
                </button>
              </>
            )}
            {activeTab === 'bundles' && (
              <button
                onClick={() => setShowBundleForm(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-sm transition-all"
              >
                <Plus size={16} /> Create Bundle
              </button>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1 mb-6">
          <button
            onClick={() => setActiveTab('services')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'services' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Layers size={16} /> Services List
          </button>
          <button
            onClick={() => setActiveTab('rate-cards')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'rate-cards' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Percent size={16} /> Client Rate Cards
          </button>
          <button
            onClick={() => setActiveTab('bundles')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'bundles' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Gift size={16} /> Service Bundles
          </button>
        </div>

        {/* ──────── TAB: SERVICES ──────── */}
        {activeTab === 'services' && (
          <>
            {/* Filters */}
            <div className="flex gap-3 mb-6">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search services by code or name…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <select
                value={filterCategory}
                onChange={e => setFilterCategory(e.target.value)}
                className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">All Categories</option>
                {categories.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>

            {/* List */}
            {isLoading ? (
              <div className="flex items-center justify-center h-48 text-slate-400">Loading catalog…</div>
            ) : Object.keys(grouped).length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-400">
                No services defined yet. Seed default values or add a new one.
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(grouped).map(([category, subcats]) => (
                  <div key={category} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-3">
                      <h2 className="text-white font-bold text-sm tracking-wide uppercase">{category}</h2>
                    </div>
                    {Object.entries(subcats as any).map(([subcat, svcs]) => (
                      <div key={subcat}>
                        <div className="px-5 py-2 bg-slate-50 border-b border-slate-100">
                          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{subcat}</h3>
                        </div>
                        <div className="divide-y divide-slate-50">
                          {(svcs as any[]).map((svc: any) => (
                            <div key={svc.id} className={`flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors ${!svc.isActive ? 'opacity-50' : ''}`}>
                              <div className="flex items-center gap-4 flex-1">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-slate-900 text-sm">{svc.name}</span>
                                    <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-mono">{svc.serviceCode}</span>
                                    <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">{svc.unitType}</span>
                                  </div>
                                  <p className="text-xs text-slate-400 mt-0.5">{svc.description}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-6">
                                <div className="text-right">
                                  <div className="text-sm font-bold text-slate-900">{fmt(svc.basePrice)}</div>
                                  <div className="text-xs text-slate-400">Cost: {fmt(svc.costPrice)}</div>
                                </div>
                                <div className="text-xs text-slate-400">GST {svc.gstRate}%</div>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => startEditService(svc)}
                                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                  >
                                    <Edit3 size={14} />
                                  </button>
                                  <button
                                    onClick={() => toggleServiceActive(svc)}
                                    className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                                  >
                                    {svc.isActive ? <ToggleRight size={18} className="text-green-500" /> : <ToggleLeft size={18} />}
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ──────── TAB: RATE CARDS ──────── */}
        {activeTab === 'rate-cards' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Upsert Rate Card form */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 h-fit shadow-sm">
              <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Tag size={16} className="text-indigo-600" /> Custom Tier Pricing
              </h2>
              {rateCardStatus && (
                <div className="p-3 mb-4 bg-green-50 text-green-700 rounded-lg text-xs font-semibold">
                  {rateCardStatus}
                </div>
              )}
              <form onSubmit={handleRateCardSubmit} className="space-y-4">
                <div>
                  <label className={labelCls}>Select Service</label>
                  <select
                    value={rateCardForm.serviceId}
                    onChange={e => setRateCardForm(f => ({ ...f, serviceId: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">-- Choose a Service --</option>
                    {services.map((s: any) => (
                      <option key={s.id} value={s.id}>{s.name} ({s.serviceCode})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Client Tier</label>
                  <select
                    value={rateCardForm.clientTier}
                    onChange={e => setRateCardForm(f => ({ ...f, clientTier: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {CLIENT_TIERS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Custom Tier Price (₹)</label>
                  <input
                    type="number"
                    required
                    value={rateCardForm.customPrice}
                    onChange={e => setRateCardForm(f => ({ ...f, customPrice: e.target.value }))}
                    placeholder="12000"
                    className="mt-1 w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className={labelCls}>Tier Discount (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={rateCardForm.discountPercent}
                    onChange={e => setRateCardForm(f => ({ ...f, discountPercent: e.target.value }))}
                    placeholder="0"
                    className="mt-1 w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={upsertRateCardMutation.isPending}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-60"
                >
                  {upsertRateCardMutation.isPending ? 'Saving…' : 'Save Rate Card'}
                </button>
              </form>
            </div>

            {/* Matrix / Existing Rate cards */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <h2 className="text-base font-bold text-slate-900 mb-4">Existing Rates Table</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase">
                        <th className="py-2">Service</th>
                        <th className="py-2">Client Tier</th>
                        <th className="py-2 text-right">Custom Price</th>
                        <th className="py-2 text-right">Discount</th>
                        <th className="py-2 text-right">Effective Rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-sm">
                      {services.filter((s: any) => s.rateCards && s.rateCards.length > 0).flatMap((s: any) =>
                        s.rateCards.map((rc: any) => {
                          const effective = Number(rc.customPrice) * (1 - Number(rc.discountPercent) / 100);
                          return (
                            <tr key={rc.id} className="hover:bg-slate-50/50">
                              <td className="py-2.5 font-medium text-slate-800">
                                <div>{s.name}</div>
                                <div className="text-xs text-slate-400 font-mono">{s.serviceCode}</div>
                              </td>
                              <td className="py-2.5">
                                <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-semibold">{rc.clientTier}</span>
                              </td>
                              <td className="py-2.5 text-right font-mono">{fmt(rc.customPrice)}</td>
                              <td className="py-2.5 text-right text-amber-600 font-semibold">{rc.discountPercent}%</td>
                              <td className="py-2.5 text-right font-bold font-mono text-indigo-600">{fmt(effective)}</td>
                            </tr>
                          );
                        })
                      )}
                      {services.filter((s: any) => s.rateCards && s.rateCards.length > 0).length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-400">
                            No custom tier prices saved yet. Use the sidebar to add rates.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ──────── TAB: BUNDLES ──────── */}
        {activeTab === 'bundles' && (
          <div className="space-y-6">
            {/* Bundles List */}
            {loadingBundles ? (
              <div className="flex items-center justify-center h-48 text-slate-400">Loading bundles…</div>
            ) : bundles.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-400 shadow-sm">
                No active service bundles defined. Click "Create Bundle" to build a packaged deal.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {bundles.map((bundle: any) => (
                  <div key={bundle.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 flex flex-col justify-between hover:shadow-md transition-shadow">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-bold text-slate-900 text-base flex items-center gap-1.5">
                          <Gift size={18} className="text-indigo-600" /> {bundle.name}
                        </h3>
                        <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-bold">Active</span>
                      </div>
                      <p className="text-xs text-slate-400 mb-4">{bundle.description}</p>
                      <div className="space-y-1.5 border-t border-slate-100 pt-3 mb-6">
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Included Services:</span>
                        {Array.isArray(bundle.services) && bundle.services.map((id: string) => {
                          const svc = services.find((x: any) => x.id === id);
                          return svc ? (
                            <div key={id} className="flex justify-between items-center text-xs">
                              <span className="text-slate-700 font-medium">{svc.name}</span>
                              <span className="text-slate-400 font-mono">{fmt(svc.basePrice)}</span>
                            </div>
                          ) : null;
                        })}
                      </div>
                    </div>
                    <div className="flex justify-between items-center border-t border-slate-100 pt-4">
                      <div>
                        <span className="text-xs text-slate-400 block">Bundle Flat Rate:</span>
                        <span className="text-lg font-bold text-indigo-600 font-mono">{fmt(bundle.totalPrice)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── SERVICE MODAL ── */}
      {showServiceForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowServiceForm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">{editService ? 'Edit Service' : 'Add New Service'}</h2>
            </div>
            <form onSubmit={handleServiceSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Service Code *</label>
                  <input required value={serviceForm.serviceCode} onChange={e => setServiceForm(f => ({ ...f, serviceCode: e.target.value }))}
                    placeholder="SWD-WEB-001"
                    className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Unit Type</label>
                  <select value={serviceForm.unitType} onChange={e => setServiceForm(f => ({ ...f, unitType: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {UNIT_TYPES.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Category *</label>
                  <input required value={serviceForm.category} onChange={e => setServiceForm(f => ({ ...f, category: e.target.value }))}
                    placeholder="Software Development"
                    className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Sub-Category *</label>
                  <input required value={serviceForm.subCategory} onChange={e => setServiceForm(f => ({ ...f, subCategory: e.target.value }))}
                    placeholder="Mobile App"
                    className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Service Name *</label>
                <input required value={serviceForm.name} onChange={e => setServiceForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Android App Development"
                  className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Description</label>
                <textarea value={serviceForm.description} onChange={e => setServiceForm(f => ({ ...f, description: e.target.value }))}
                  rows={2} placeholder="Full description of what's included…"
                  className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Base Price (₹) *</label>
                  <input required type="number" min="0" value={serviceForm.basePrice} onChange={e => setServiceForm(f => ({ ...f, basePrice: e.target.value }))}
                    placeholder="15000"
                    className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Cost Price (₹)</label>
                  <input type="number" min="0" value={serviceForm.costPrice} onChange={e => setServiceForm(f => ({ ...f, costPrice: e.target.value }))}
                    placeholder="8000"
                    className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">GST Rate (%)</label>
                  <input type="number" min="0" max="28" value={serviceForm.gstRate} onChange={e => setServiceForm(f => ({ ...f, gstRate: Number(e.target.value) }))}
                    className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowServiceForm(false)}
                  className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button type="submit" disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
                >
                  {editService ? 'Save Changes' : 'Add Service'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── BUNDLE FORM MODAL ── */}
      {showBundleForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowBundleForm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">Create Service Bundle</h2>
            </div>
            <form onSubmit={handleBundleSubmit} className="p-6 space-y-4">
              <div>
                <label className={labelCls}>Bundle Name *</label>
                <input
                  required
                  value={bundleForm.name}
                  onChange={e => setBundleForm(b => ({ ...b, name: e.target.value }))}
                  placeholder="Starter SaaS Package"
                  className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className={labelCls}>Description</label>
                <textarea
                  value={bundleForm.description}
                  onChange={e => setBundleForm(b => ({ ...b, description: e.target.value }))}
                  rows={2}
                  placeholder="Describe the packaged package deal..."
                  className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              {/* Service checklists */}
              <div>
                <label className={`${labelCls} block mb-2`}>Select Services to Bundle</label>
                <div className="max-h-40 overflow-y-auto border border-slate-100 rounded-lg divide-y divide-slate-50 p-2 bg-slate-50/50">
                  {services.map((svc: any) => (
                    <label key={svc.id} className="flex items-center gap-3 py-2 px-1 hover:bg-white rounded cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={bundleForm.selectedServices.includes(svc.id)}
                        onChange={() => toggleServiceInBundle(svc.id)}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <div className="text-xs">
                        <span className="font-semibold text-slate-800 block">{svc.name}</span>
                        <span className="text-slate-400 font-mono">{svc.serviceCode} — {fmt(svc.basePrice)}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className={labelCls}>Bundle Flat Price (₹) *</label>
                <input
                  required
                  type="number"
                  value={bundleForm.totalPrice}
                  onChange={e => setBundleForm(b => ({ ...b, totalPrice: e.target.value }))}
                  placeholder="35000"
                  className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Autosum of selected services base price is used as a default suggestion.
                </span>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBundleForm(false)}
                  className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createBundleMutation.isPending}
                  className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
                >
                  {createBundleMutation.isPending ? 'Creating…' : 'Create Bundle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
