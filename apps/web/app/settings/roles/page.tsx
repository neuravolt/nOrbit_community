'use client';
import { useState, useMemo } from 'react';
import {
  useRoles,
  useRole,
  usePermissions,
  useCreateRole,
  useUpdateRole,
  useDeleteRole,
} from '../../../src/hooks/queries';
import { Shield, Plus, Edit3, Trash2, ArrowLeft, Check, Lock } from 'lucide-react';
import Link from 'next/link';

export default function RolesSettingsPage() {
  const { data: roles = [], isLoading: loadingRoles } = useRoles();
  const { data: permissionGroups = [], isLoading: loadingPermissions } = usePermissions();

  const createRoleMutation = useCreateRole();
  const updateRoleMutation = useUpdateRole();
  const deleteRoleMutation = useDeleteRole();

  const [showForm, setShowForm] = useState(false);
  const [editRole, setEditRole] = useState<any>(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    permissions: [] as string[],
  });

  const transformedPermissionGroups = useMemo(() => {
    return (permissionGroups || []).map((group: any) => {
      const moduleName = group.resource || group.module || '';
      const actions = (group.permissions || group.actions || []).map((perm: any) => {
        const actionName = perm.name || `${perm.action} (${perm.scope})`;
        const permissionStr = perm.permission || `${perm.resource}:${perm.action}:${perm.scope}`;
        return {
          name: actionName,
          permission: permissionStr,
        };
      });
      return {
        module: moduleName,
        actions: actions,
      };
    });
  }, [permissionGroups]);

  const permissionStringToIdMap = useMemo(() => {
    const map = new Map<string, string>();
    (permissionGroups || []).forEach((group: any) => {
      const permissions = group.permissions || group.actions || [];
      permissions.forEach((p: any) => {
        const key = p.permission || `${p.resource}:${p.action}:${p.scope}`;
        map.set(key, p.id);
      });
    });
    return map;
  }, [permissionGroups]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    const permissionIds = form.permissions
      .map(key => permissionStringToIdMap.get(key))
      .filter(Boolean) as string[];

    const payload = {
      name: form.name,
      description: form.description,
      permissionIds,
    };

    if (editRole) {
      await updateRoleMutation.mutateAsync({ id: editRole.id, ...payload });
    } else {
      await createRoleMutation.mutateAsync(payload);
    }
    setShowForm(false);
    setEditRole(null);
    setForm({ name: '', description: '', permissions: [] });
  };

  const startEdit = (role: any) => {
    // If it's a system role, block editing or warn
    if (role.isSystem) {
      alert('System roles cannot be modified.');
      return;
    }
    setEditRole(role);
    const permissionStrings = (role.permissions || []).map((p: any) => {
      if (typeof p === 'string') return p;
      return `${p.resource}:${p.action}:${p.scope}`;
    });
    setForm({
      name: role.name,
      description: role.description ?? '',
      permissions: permissionStrings,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this role?')) {
      try {
        await deleteRoleMutation.mutateAsync(id);
      } catch (err: any) {
        alert(err.response?.data?.message || 'Delete failed');
      }
    }
  };

  const togglePermission = (perm: string) => {
    setForm(prev => {
      const isSelected = prev.permissions.includes(perm);
      return {
        ...prev,
        permissions: isSelected
          ? prev.permissions.filter(p => p !== perm)
          : [...prev.permissions, perm],
      };
    });
  };

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
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Shield size={24} className="text-indigo-600" /> Roles & Permissions
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Create and manage administrative user roles and map access permission matrices.
            </p>
          </div>
          <button
            onClick={() => {
              setEditRole(null);
              setForm({ name: '', description: '', permissions: [] });
              setShowForm(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-sm transition-all"
          >
            <Plus size={16} /> Add Custom Role
          </button>
        </div>

        {/* Main List */}
        {loadingRoles ? (
          <div className="flex items-center justify-center h-48 text-slate-400">Loading roles…</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {roles.map((role: any) => (
              <div key={role.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between hover:shadow-md transition-shadow">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="font-bold text-slate-900 text-lg flex items-center gap-1.5">
                      {role.name}
                    </h2>
                    {role.isSystem ? (
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-bold uppercase flex items-center gap-1">
                        <Lock size={10} /> System
                      </span>
                    ) : (
                      <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-bold uppercase">Custom</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mb-6">{role.description || 'No description provided.'}</p>
                </div>

                <div className="flex items-center justify-between border-t border-slate-50 pt-4 mt-auto">
                  <div className="text-xs text-slate-500 font-semibold">
                    {role.permissionCount ?? role.permissions?.length ?? 0} Permissions
                  </div>
                  {!role.isSystem && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => startEdit(role)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(role.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">{editRole ? `Edit Role: ${editRole.name}` : 'Create Custom Role'}</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Role Name *</label>
                  <input
                    required
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Technical Lead"
                    className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Description</label>
                  <input
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Description of role privileges…"
                    className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Permission Matrix */}
              <div>
                <h3 className="text-sm font-bold text-slate-800 mb-3">Permissions Matrix Mapping</h3>
                {loadingPermissions ? (
                  <div className="text-sm text-slate-400">Loading permissions matrix…</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-h-96 overflow-y-auto p-4 border border-slate-100 rounded-xl bg-slate-50/50">
                    {transformedPermissionGroups.map((group: any) => (
                      <div key={group.module} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                        <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider block mb-3 border-b border-slate-50 pb-1.5">
                          {group.module} Management
                        </span>
                        <div className="space-y-2">
                          {group.actions.map((action: any) => {
                            const isChecked = form.permissions.includes(action.permission);
                            return (
                              <label key={action.permission} className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => togglePermission(action.permission)}
                                  className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                                />
                                <div>
                                  <span className="font-semibold text-slate-900 block">{action.name}</span>
                                  <span className="text-[10px] text-slate-400 font-mono block mt-0.5">{action.permission}</span>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createRoleMutation.isPending || updateRoleMutation.isPending}
                  className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
                >
                  {createRoleMutation.isPending || updateRoleMutation.isPending ? 'Saving…' : editRole ? 'Save Changes' : 'Create Role'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
