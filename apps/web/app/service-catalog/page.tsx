'use client';
import { useState } from 'react';
import { useServiceCatalog, useCreateService, useUpdateService, useSeedServiceCatalog } from '../../src/hooks/queries';
import { Plus, Layers, Edit3, ToggleLeft, ToggleRight, Sparkles, IndianRupee, CheckCircle2, FolderTree } from 'lucide-react';
import { PageShell, PageHeader, Button, SearchInput, selectClass } from '../../src/components/ui/page';
import { KpiCard } from '../../src/components/ui/charts';

const UNIT_TYPES = ['Fixed', 'Hour', 'Sprint', 'Page', 'Month'];

export default function ServiceCatalogPage() {
  const { data, isLoading } = useServiceCatalog({ activeOnly: 'false' });
  const createMutation = useCreateService();
  const updateMutation = useUpdateService();
  const seedMutation = useSeedServiceCatalog();

  const [showForm, setShowForm] = useState(false);
  const [editService, setEditService] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [form, setForm] = useState({
    serviceCode: '', category: '', subCategory: '', name: '',
    description: '', unitType: 'Fixed', basePrice: '', costPrice: '', gstRate: 18,
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

  // Group filtered services
  const grouped = filtered.reduce((acc: any, s: any) => {
    if (!acc[s.category]) acc[s.category] = {};
    if (!acc[s.category][s.subCategory]) acc[s.category][s.subCategory] = [];
    acc[s.category][s.subCategory].push(s);
    return acc;
  }, {});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...form, basePrice: Number(form.basePrice), costPrice: Number(form.costPrice), gstRate: Number(form.gstRate) };
    if (editService) {
      await updateMutation.mutateAsync({ id: editService.id, ...payload });
    } else {
      await createMutation.mutateAsync(payload);
    }
    setShowForm(false);
    setEditService(null);
    setForm({ serviceCode: '', category: '', subCategory: '', name: '', description: '', unitType: 'Fixed', basePrice: '', costPrice: '', gstRate: 18 });
  };

  const startEdit = (svc: any) => {
    setEditService(svc);
    setForm({ ...svc, basePrice: svc.basePrice, costPrice: svc.costPrice });
    setShowForm(true);
  };

  const toggleActive = (svc: any) => updateMutation.mutateAsync({ id: svc.id, isActive: !svc.isActive });

  const fmt = (n: any) => `₹${Number(n).toLocaleString('en-IN')}`;

  const avgPrice = services.length > 0 ? services.reduce((s: any, x: any) => s + Number(x.basePrice), 0) / services.length : null;

  return (
    <PageShell>
      <div className="max-w-7xl mx-auto space-y-5">
        <PageHeader
          icon={Layers}
          title="Service Catalog"
          subtitle="Master list of services with pricing. Used in quotations and invoices."
          actions={<>
            <Button onClick={() => seedMutation.mutateAsync()} disabled={seedMutation.isPending}>
              <Sparkles size={15} /> {seedMutation.isPending ? 'Seeding…' : 'Seed defaults'}
            </Button>
            <Button variant="primary" onClick={() => { setShowForm(true); setEditService(null); }}>
              <Plus size={15} /> Add service
            </Button>
          </>}
        />

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <KpiCard tone="info" icon={Layers} value={services.length} label="Total services" />
          <KpiCard tone="ok" icon={CheckCircle2} value={services.filter((s: any) => s.isActive).length} label="Active" />
          <KpiCard tone="violet" icon={FolderTree} value={categories.length} label="Categories" />
          <KpiCard tone="warning" icon={IndianRupee} value={avgPrice === null ? '—' : fmt(Math.round(avgPrice))} label="Average base price" />
        </div>

        <div className="flex flex-wrap items-center gap-2 bg-white p-3 rounded-2xl border border-slate-200">
          <SearchInput className="flex-1 min-w-48" placeholder="Search services…" value={search} onChange={setSearch} />
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className={selectClass}>
            <option value="">All categories</option>
            {categories.map((c: any) => <option key={c}>{c}</option>)}
          </select>
        </div>

        {/* Service Groups */}
        {isLoading ? (
          <div className="flex items-center justify-center h-48 text-slate-400">Loading services…</div>
        ) : Object.keys(grouped).length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400 bg-white rounded-xl border border-slate-200">
            <Layers size={40} className="mb-3 opacity-30" />
            <p className="font-medium">No services found</p>
            <p className="text-sm">Click "Seed Defaults" to load 12 pre-built services</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([category, subcats]) => (
              <div key={category} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100">
                  <FolderTree size={16} className="text-indigo-600" />
                  <h2 className="text-slate-900 font-semibold text-sm">{category}</h2>
                  <span className="text-xs text-slate-400">({Object.values(subcats as any).reduce((n: number, l: any) => n + l.length, 0)})</span>
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
                                <span className="font-medium text-slate-900 text-sm">{svc.name}</span>
                                <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-mono">{svc.serviceCode}</span>
                                <span className="text-[11px] font-semibold border border-indigo-200 bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md">{svc.unitType}</span>
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
                                onClick={() => startEdit(svc)}
                                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                              >
                                <Edit3 size={14} />
                              </button>
                              <button
                                onClick={() => toggleActive(svc)}
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
      </div>

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">{editService ? 'Edit Service' : 'Add New Service'}</h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Service Code *</label>
                  <input required value={form.serviceCode} onChange={e => setForm(f => ({ ...f, serviceCode: e.target.value }))}
                    placeholder="SWD-WEB-001"
                    className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Unit Type</label>
                  <select value={form.unitType} onChange={e => setForm(f => ({ ...f, unitType: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {UNIT_TYPES.map(u => <option key={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Category *</label>
                  <input required value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    placeholder="Software Development"
                    className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Sub-Category *</label>
                  <input required value={form.subCategory} onChange={e => setForm(f => ({ ...f, subCategory: e.target.value }))}
                    placeholder="Mobile App"
                    className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Service Name *</label>
                <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Android App Development"
                  className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Description</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={2} placeholder="Full description of what's included…"
                  className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Base Price (₹) *</label>
                  <input required type="number" min="0" value={form.basePrice} onChange={e => setForm(f => ({ ...f, basePrice: e.target.value }))}
                    placeholder="15000"
                    className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Cost Price (₹)</label>
                  <input type="number" min="0" value={form.costPrice} onChange={e => setForm(f => ({ ...f, costPrice: e.target.value }))}
                    placeholder="8000"
                    className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">GST Rate (%)</label>
                  <input type="number" min="0" max="28" value={form.gstRate} onChange={e => setForm(f => ({ ...f, gstRate: Number(e.target.value) }))}
                    className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
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
    </PageShell>
  );
}
