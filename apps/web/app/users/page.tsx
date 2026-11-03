"use client";

import { useState, useMemo } from "react";
import { useUsers, useCreate, useUpdate, useRoles } from "../../src/hooks/queries";
import { Plus, Loader2, Edit3, Users, UserCheck, UserX, ShieldCheck } from "lucide-react";
import { PageShell, PageHeader, Badge, Button, SearchInput, selectClass, TableCard, th, td, EmptyBlock } from "../../src/components/ui/page";
import type { BadgeTone } from "../../src/components/ui/page";
import { KpiCard } from "../../src/components/ui/charts";
import { Modal, FormField, inputCls, selectCls } from "../components/Modal";

const ROLE_TONES: Record<string, BadgeTone> = {
  SUPER_ADMIN: "red", MANAGER: "violet", DEVELOPER: "blue", QA: "amber", SALES: "green",
  SUPPORT: "sky", ACCOUNTANT: "green", CLIENT: "slate", EMPLOYEE: "blue",
};

export default function UsersPage() {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [open, setOpen] = useState(false);
  const [editUser, setEditUser] = useState<any>(null);
  const [form, setForm] = useState({ email: "", firstName: "", lastName: "", roleId: "", password: "", status: "ACTIVE" });
  const [err, setErr] = useState("");

  const { data, isLoading, isError } = useUsers({ search: search || undefined });
  const { data: dbRoles = [] } = useRoles();

  const createMutation = useCreate("users", "users");
  const updateMutation = useUpdate("users", "users");

  const users = data?.users || [];
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleStartEdit = (user: any) => {
    setEditUser(user);
    setForm({
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roleId: user.roleId || "",
      password: "",
      status: user.status || "ACTIVE",
    });
    setErr("");
    setOpen(true);
  };

  const handleStartInvite = () => {
    setEditUser(null);
    setForm({
      email: "",
      firstName: "",
      lastName: "",
      roleId: dbRoles[0]?.id || "",
      password: "",
      status: "ACTIVE",
    });
    setErr("");
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email.trim()) { setErr("Email is required."); return; }
    if (!form.firstName.trim() || !form.lastName.trim()) { setErr("Full name is required."); return; }
    if (!editUser && (!form.password || form.password.length < 8)) {
      setErr("Password must be at least 8 characters.");
      return;
    }
    if (form.password && form.password.length < 8) {
      setErr("Password must be at least 8 characters.");
      return;
    }
    setErr("");

    const selectedRole = dbRoles.find(r => r.id === form.roleId);
    // Only send `role` (the coarse access-tier enum) when the selected job
    // Role's name is confidently one of the known enum values. Most real
    // Roles are custom job titles ("SOFTWARE ENGINEER", "EMPLOYEE", ...)
    // that don't match — previously this silently defaulted `role` to
    // "CLIENT" on every save, corrupting the access tier of anyone whose
    // Role didn't literally match the enum. Omitting the field here leaves
    // the user's existing `role` untouched (the backend field is optional).
    const roleEnum = selectedRole && ["SUPER_ADMIN", "MANAGER", "DEVELOPER", "QA", "SALES", "SUPPORT", "ACCOUNTANT", "CLIENT"].includes(selectedRole.name)
      ? selectedRole.name
      : undefined;

    try {
      const payload: any = {
        email: form.email.trim(),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        roleId: form.roleId || undefined,
        status: form.status,
      };
      if (roleEnum) {
        payload.role = roleEnum;
      }

      if (form.password) {
        payload.password = form.password;
      }

      if (editUser) {
        await updateMutation.mutateAsync({ id: editUser.id, ...payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
      setOpen(false);
      setEditUser(null);
      setForm({ email: "", firstName: "", lastName: "", roleId: "", password: "", status: "ACTIVE" });
    } catch (e: any) {
      setErr(e.response?.data?.message || "Operation failed.");
    }
  };

  // Client-side role filtering
  const filteredUsers = useMemo(() => {
    return users.filter((u: any) => {
      if (!role) return true;
      const selectedRole = dbRoles.find(r => r.id === role);
      if (!selectedRole) return true;
      return u.roleId === selectedRole.id || u.role === selectedRole.name;
    });
  }, [users, role, dbRoles]);

  const isActive = (u: any) => u.status === "ACTIVE" || u.isActive;
  const roleLabel = (r?: string) => (r || "—").replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase());

  return (
    <PageShell>
      <PageHeader
        icon={Users}
        title="Users"
        subtitle="Team members, their roles and whether they can sign in."
        actions={<Button variant="primary" onClick={handleStartInvite}><Plus className="w-4 h-4" /> Add user</Button>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Users" value={data?.total ?? users.length} icon={Users} tone="info" />
        <KpiCard label="Can sign in" value={users.filter(isActive).length} icon={UserCheck} tone="ok" />
        <KpiCard label="Switched off" value={users.filter((u: any) => !isActive(u)).length} icon={UserX} tone="neutral" />
        <KpiCard label="Super admins" value={users.filter((u: any) => u.role === "SUPER_ADMIN").length} icon={ShieldCheck} tone="critical" />
      </div>

      <TableCard
        title="Everyone"
        count={filteredUsers.length}
        toolbar={
          <>
            <SearchInput value={search} onChange={setSearch} placeholder="Search name or email" />
            <select className={selectClass} value={role} onChange={e => setRole(e.target.value)}>
              <option value="">All roles</option>
              {dbRoles.map((r: any) => <option key={r.id} value={r.id}>{roleLabel(r.name)}</option>)}
            </select>
          </>
        }
      >
        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 text-indigo-600 animate-spin" /></div>
        ) : isError ? (
          <EmptyBlock icon={Users} title="Users could not be loaded" hint="Try again in a moment." />
        ) : filteredUsers.length === 0 ? (
          <EmptyBlock icon={Users} title="No users match" hint={search || role ? "Clear the search or role filter." : "Add your first team member."} />
        ) : (
          <table className="min-w-full divide-y divide-slate-100">
            <thead><tr><th className={th}>Name</th><th className={th}>Role</th><th className={th}>Status</th><th className={th}>Last sign-in</th><th className={th}></th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.map((user: any) => (
                <tr key={user.id} className="hover:bg-slate-50">
                  <td className={td}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center text-xs font-semibold shrink-0">{user.firstName?.[0]}{user.lastName?.[0]}</div>
                      <div className="min-w-0"><div className="font-medium text-slate-900 truncate">{user.firstName} {user.lastName}</div><div className="text-xs text-slate-500 truncate">{user.email}</div></div>
                    </div>
                  </td>
                  <td className={td}><Badge tone={ROLE_TONES[user.role] || "slate"}>{roleLabel(user.roleName || user.role)}</Badge></td>
                  <td className={td}><Badge tone={isActive(user) ? "green" : "slate"} dot>{isActive(user) ? "Active" : "Inactive"}</Badge></td>
                  <td className={`${td} text-slate-500`}>{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                  <td className={`${td} text-right`}>
                    <button onClick={() => handleStartEdit(user)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg" aria-label="Edit user"><Edit3 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </TableCard>

      <Modal isOpen={open} onClose={() => setOpen(false)} title={editUser ? "Edit User" : "Invite User"} subtitle={editUser ? "Modify user profile settings." : "Create a new team member account."}>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {err && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{err}</div>}
          <div className="grid grid-cols-2 gap-3">
            <FormField label="First Name" required>
              <input className={inputCls} placeholder="John" value={form.firstName} onChange={e => set("firstName", e.target.value)} />
            </FormField>
            <FormField label="Last Name" required>
              <input className={inputCls} placeholder="Smith" value={form.lastName} onChange={e => set("lastName", e.target.value)} />
            </FormField>
          </div>
          <FormField label="Email" required>
            <input type="email" className={inputCls} placeholder="john@company.com" value={form.email} onChange={e => set("email", e.target.value)} />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Role" required>
              <select className={selectCls} value={form.roleId} onChange={e => set("roleId", e.target.value)}>
                {dbRoles.map((r: any) => (
                  <option key={r.id} value={r.id}>{r.name.replace('_', ' ')}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Status" required>
              <select className={selectCls} value={form.status} onChange={e => set("status", e.target.value)}>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </FormField>
          </div>
          <FormField label="Password" required={!editUser}>
            <input
              type="password"
              className={inputCls}
              placeholder={editUser ? "Leave blank to keep unchanged" : "Min. 8 characters"}
              value={form.password}
              onChange={e => set("password", e.target.value)}
            />
          </FormField>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              className="flex-1 flex items-center justify-center px-4 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg"
            >
              {createMutation.isPending || updateMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>
              ) : editUser ? (
                "Save Changes"
              ) : (
                "Create User"
              )}
            </button>
          </div>
        </form>
      </Modal>
    </PageShell>
  );
}
