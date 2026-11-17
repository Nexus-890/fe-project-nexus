"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ArrowDownUp, MoreHorizontal, Plus, Search, X } from "lucide-react";
import { AdminEmptyState, AdminError, AdminPageHeader, AdminPagination, adminInputClass, adminSelectClass } from "../components/AdminPrimitives";
import { Button } from "../components/button";
import { Popover, PopoverContent, PopoverTrigger } from "../components/popover";
import { queryKeys } from "../configs/queryKeys";
import { useApiMutation, useApiQuery } from "../hooks/useApi";
import { useAuth } from "../hooks/useAuth";
import { assignAdminUserRoles, createAdminUser, deleteAdminUser, getAdminRoles, getAdminUsers, setAdminUserPassword, unlockAdminUser, updateAdminUser } from "../service/adminUserService";
import type { AdminAssignRolesRequest, AdminCreateUserRequest, AdminPasswordRequest, AdminRoleCode, AdminUpdateUserRequest, AdminUserFilters } from "../types/adminUserType";
import type { UserResponse } from "../types/authResponseType";
import type { ApiError } from "../types/commonResponseType";
import { readBackofficeRoles } from "./backofficeAccess";
import { adminRoleCodes, adminRoleLabels, canManageUser, userInitials, type AdminUserAction } from "./adminUserUtils";

type UserEditor = { action: "create" } | { action: Exclude<AdminUserAction, "create">; user: UserResponse };
type UserMutation =
  | { action: "create"; body: AdminCreateUserRequest }
  | { action: "edit"; id: string; body: AdminUpdateUserRequest }
  | { action: "password"; id: string; body: AdminPasswordRequest }
  | { action: "roles"; id: string; body: AdminAssignRolesRequest }
  | { action: "delete" | "unlock"; id: string };
const actionLabels: Record<AdminUserAction, string> = {
  create: "Create User", edit: "Edit User", password: "Set Password", roles: "Change Roles", delete: "Delete User", unlock: "Unlock User",
};
const initialFilters: AdminUserFilters = { q: "", role: "", status: "ACTIVE", page: 0, size: 20, sort: "fullName", direction: "asc" };
// Mutation variables live in TanStack's cache; clear credentials as soon as the request settles or the page leaves.
const clearUserCredentials = (input: UserMutation | null) => {
  if (input?.action === "create") input.body.password = "";
  if (input?.action === "password") input.body.newPassword = "";
};

function UserField({ name, label, errors, children }: { name: string; label: string; errors?: ApiError | null; children: ReactNode }) {
  return <label className="grid gap-1.5 text-sm"><span className="font-medium">{label}</span>{children}{errors?.fieldErrors?.[name]?.map((message) => <span key={message} role="alert" className="text-xs text-danger">{message}</span>)}</label>;
}

function UserDialog({ editor, pending, error, save, close }: {
  editor: UserEditor; pending: boolean; error: ApiError | null; save: (input: UserMutation) => void; close: () => void;
}) {
  const auth = useAuth();
  const dialog = useRef<HTMLDialogElement>(null);
  const create = editor.action === "create";
  const user = "user" in editor ? editor.user : undefined;
  const profile = create || editor.action === "edit";
  const chooseRoles = create || editor.action === "roles";
  const [selectedRoles, setSelectedRoles] = useState<AdminRoleCode[]>(() => user?.roles.filter((role): role is AdminRoleCode => adminRoleCodes.includes(role as AdminRoleCode)) ?? ["BUYER"]);
  const roleResult = useApiQuery({ queryKey: queryKeys.admin.roles(auth.sessionId), meta: { requiresAuth: true },
    service: (signal) => getAdminRoles("", { context: auth.requestContext, signal }) }, { enabled: chooseRoles });
  const selectableRoles = roleResult.data?.roles.filter((role) => adminRoleCodes.includes(role.code as AdminRoleCode)) ?? [];
  useEffect(() => { dialog.current?.showModal(); }, []);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !canManageUser(readBackofficeRoles(auth.accessToken), editor.action)) return;
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "").trim();
    if (editor.action === "create") save({ action: "create", body: {
      fullName: text("fullName"), email: text("email"), phone: text("phone"), password: String(form.get("password") ?? ""),
      identityNumber: text("identityNumber"), gender: text("gender") as AdminCreateUserRequest["gender"],
      address: text("address"), dateOfBirth: text("dateOfBirth"), roleCodes: selectedRoles,
    } });
    else if (editor.action === "edit") save({ action: "edit", id: editor.user.id, body: {
      fullName: text("fullName"), email: text("email"), address: text("address"),
      ...(text("dateOfBirth") ? { dateOfBirth: text("dateOfBirth") } : {}),
      ...(text("gender") ? { gender: text("gender") as AdminCreateUserRequest["gender"] } : {}),
    } });
    else if (editor.action === "password") save({ action: "password", id: editor.user.id, body: { newPassword: String(form.get("newPassword") ?? "") } });
    else if (editor.action === "roles") save({ action: "roles", id: editor.user.id, body: { roleCodes: selectedRoles } });
    else save({ action: editor.action, id: editor.user.id });
  }

  return <dialog ref={dialog} onCancel={(event) => { event.preventDefault(); if (!pending) close(); }} aria-labelledby="user-dialog-title" className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-md border border-border bg-card p-0 text-foreground shadow-xl backdrop:bg-black/40">
    <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5"><div><h2 id="user-dialog-title" className="text-xl font-semibold">{actionLabels[editor.action]}</h2>{user && <p className="mt-1 break-words text-sm text-muted-foreground">{user.fullName} · {user.email}</p>}</div><Button type="button" variant="ghost" aria-label="Close dialog" disabled={pending} onClick={close}><X className="size-4" /></Button></div>
    <form onSubmit={submit} className="space-y-5 p-6">
      <fieldset disabled={pending} className="space-y-4">
        {profile && <>
          <UserField name="fullName" label="Full name" errors={error}><input name="fullName" autoComplete="off" required maxLength={150} defaultValue={user?.fullName} className={adminInputClass} /></UserField>
          <UserField name="email" label="Email" errors={error}><input name="email" type="email" autoComplete="off" required maxLength={255} defaultValue={user?.email} className={adminInputClass} /></UserField>
          {create && <>
            <UserField name="phone" label="Phone" errors={error}><input name="phone" type="tel" autoComplete="off" required pattern="\+?[0-9]{7,15}" className={adminInputClass} /></UserField>
            <UserField name="identityNumber" label="Identity number" errors={error}><input name="identityNumber" required maxLength={255} autoComplete="off" className={adminInputClass} /></UserField>
            <UserField name="password" label="Initial password" errors={error}><input name="password" type="password" autoComplete="new-password" required minLength={8} className={adminInputClass} /></UserField>
          </>}
          <div className="grid gap-4 sm:grid-cols-2">
            <UserField name="gender" label="Gender" errors={error}><select name="gender" aria-label="Gender" required={create} defaultValue={user?.gender ?? ""} className={`${adminSelectClass} w-full`}><option value="">Select gender</option><option value="MALE">Male</option><option value="FEMALE">Female</option><option value="OTHER">Other</option></select></UserField>
            <UserField name="dateOfBirth" label="Date of birth" errors={error}><input name="dateOfBirth" type="date" required={create} max={new Date().toISOString().slice(0, 10)} defaultValue={user?.dateOfBirth ?? ""} className={adminInputClass} /></UserField>
          </div>
          <UserField name="address" label="Address" errors={error}><textarea name="address" required={create} rows={2} defaultValue={user?.address ?? ""} className={adminInputClass} /></UserField>
        </>}
        {editor.action === "password" && <><p className="text-sm text-muted-foreground">Set a new password that meets the account password policy.</p><UserField name="newPassword" label="New password" errors={error}><input name="newPassword" type="password" autoComplete="new-password" required minLength={8} className={adminInputClass} /></UserField></>}
        {chooseRoles && <fieldset className="space-y-3"><legend className="mb-2 text-sm font-medium">Roles</legend>
          {roleResult.isPending ? <p role="status" className="text-sm text-muted-foreground">Loading roles…</p> : roleResult.error ? <AdminError error={roleResult.error} onRetry={() => void roleResult.refetch()} /> : <div className="grid gap-3 sm:grid-cols-2">{selectableRoles.map((role) => <label key={role.id} className="flex min-h-10 items-center gap-2 rounded-sm border border-border px-3 text-sm"><input type="checkbox" name="roleCodes" value={role.code} checked={selectedRoles.includes(role.code as AdminRoleCode)} onChange={(event) => setSelectedRoles((current) => event.target.checked ? [...current, role.code as AdminRoleCode] : current.filter((code) => code !== role.code))} className="size-4 accent-primary focus-visible:outline-2 focus-visible:outline-ring" />{adminRoleLabels[role.code as AdminRoleCode]}</label>)}</div>}
          {!selectedRoles.length && <p role="alert" className="text-xs text-danger">Select at least one role.</p>}
          {editor.action === "roles" && <p className="text-xs text-muted-foreground">This replaces the account’s selected roles. Changes take effect after a new sign-in.</p>}
        </fieldset>}
        {editor.action === "delete" && <p className="text-sm">Delete this account? It will be hidden from the user list. This action cannot be undone here.</p>}
        {editor.action === "unlock" && <p className="text-sm">Clear the current sign-in lock for this account?</p>}
      </fieldset>
      <AdminError error={error} />
      <div className="flex justify-end gap-2 border-t border-border pt-4"><Button type="button" variant="outline" className="min-h-10" disabled={pending} onClick={close}>Cancel</Button><Button type="submit" variant={editor.action === "delete" ? "destructive" : "default"} className="min-h-10" disabled={pending || chooseRoles && (roleResult.isPending || Boolean(roleResult.error) || !selectableRoles.length || !selectedRoles.length)}>{pending ? "Saving…" : actionLabels[editor.action]}</Button></div>
    </form>
  </dialog>;
}

function AdminUsersPage() {
  const auth = useAuth();
  const roles = readBackofficeRoles(auth.accessToken);
  const authorized = roles.includes("ADMIN") || roles.includes("SUPPORT_STAFF");
  const [filters, setFilters] = useState<AdminUserFilters>(initialFilters);
  const [search, setSearch] = useState("");
  const [editor, setEditor] = useState<UserEditor | null>(null);
  const [notice, setNotice] = useState("");
  const [openUserMenu, setOpenUserMenu] = useState<string | null>(null);
  const mounted = useRef(true);
  const mutationController = useRef<AbortController | null>(null);
  const pendingInput = useRef<UserMutation | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; mutationController.current?.abort(); clearUserCredentials(pendingInput.current); pendingInput.current = null; };
  }, []);
  const result = useApiQuery({ queryKey: queryKeys.admin.users(auth.sessionId, filters), meta: { requiresAuth: true },
    service: (signal) => getAdminUsers(filters, { context: auth.requestContext, signal }) }, { enabled: authorized });
  const mutation = useApiMutation<void, UserMutation>({
    isCurrent: () => mounted.current && auth.isSessionCurrent(auth.sessionId),
    invalidateKey: [queryKeys.admin.root(auth.sessionId)],
    execute: async (input) => {
      if (!canManageUser(readBackofficeRoles(auth.requestContext.getAccessToken?.() ?? null), input.action))
        throw { kind: "http", status: 403, title: "Access denied", detail: "Your role cannot perform this action." } satisfies ApiError;
      mutationController.current = new AbortController();
      const options = { context: auth.requestContext, signal: mutationController.current.signal };
      pendingInput.current = input;
      try {
        if (input.action === "create") await createAdminUser(input.body, options);
        else if (input.action === "edit") await updateAdminUser(input.id, input.body, options);
        else if (input.action === "password") await setAdminUserPassword(input.id, input.body, options);
        else if (input.action === "roles") await assignAdminUserRoles(input.id, input.body, options);
        else if (input.action === "delete") await deleteAdminUser(input.id, options);
        else await unlockAdminUser(input.id, options);
      } finally { clearUserCredentials(input); pendingInput.current = null; }
    },
  }, {
    gcTime: 0,
    onSettled: (_, _error, input) => { clearUserCredentials(input); if (pendingInput.current === input) pendingInput.current = null; },
    onSuccess: (_, input): void => { setEditor(null); setNotice(`${actionLabels[input.action]} completed successfully.`); mutation.reset(); },
  });
  function close() { clearUserCredentials(pendingInput.current); mutation.reset(); setEditor(null); }
  function open(next: UserEditor) { setOpenUserMenu(null); mutation.reset(); setNotice(""); setEditor(next); }
  const updateFilters = (change: Partial<AdminUserFilters>) => setFilters((current) => ({ ...current, ...change, page: 0 }));
  if (!authorized) return <AdminEmptyState title="Access denied" description="User administration is available to Admin and Support Staff." />;

  return <section className="min-w-0 space-y-6">
    <AdminPageHeader title="Users" description={`${result.data?.page.totalElements.toLocaleString() ?? "—"} accounts · soft-deleted accounts are hidden`}>
      {canManageUser(roles, "create") && <Button className="min-h-10" onClick={() => open({ action: "create" })}><Plus className="size-4" aria-hidden="true" />Create User</Button>}
    </AdminPageHeader>
    <form role="search" onSubmit={(event) => { event.preventDefault(); updateFilters({ q: search }); }} className="flex flex-wrap gap-2">
      <div className="relative min-w-48 flex-1"><Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" aria-hidden="true" /><input type="search" aria-label="Search users by name or email" placeholder="Search name, email or phone" value={search} onChange={(event) => setSearch(event.target.value)} className={`${adminInputClass} pl-9`} /></div>
      <Button type="submit" variant="outline" className="min-h-10">Search</Button>
      <select aria-label="Filter users by role" value={filters.role} onChange={(event) => updateFilters({ role: event.target.value })} className={adminSelectClass}><option value="">All roles</option>{adminRoleCodes.map((role) => <option key={role} value={role}>{adminRoleLabels[role]}</option>)}</select>
      <select aria-label="Filter users by status" value={filters.status} onChange={(event) => updateFilters({ status: event.target.value })} className={adminSelectClass}><option value="">All statuses</option><option value="ACTIVE">Status: Active</option><option value="LOCKED">Status: Locked</option></select>
    </form>
    {notice && <p role="status" className="rounded-sm border border-success/30 bg-success/5 px-4 py-3 text-sm text-success">{notice}</p>}
    {result.isPending ? <p role="status" className="py-12 text-center text-sm text-muted-foreground">Loading users…</p> : result.error ? <AdminError error={result.error} onRetry={() => void result.refetch()} /> : !result.data?.users.length ? <AdminEmptyState title="No users found" description="Try a different name, email, role or status." /> : <>
      <div className="relative overflow-x-auto rounded-sm border border-border"><table className="w-full min-w-[760px] text-left text-sm"><caption className="sr-only">User accounts</caption><thead className="bg-muted text-xs text-muted-foreground"><tr>
        <th scope="col" className="px-4 py-3 font-normal" aria-sort={filters.direction === "asc" ? "ascending" : "descending"}><button type="button" onClick={() => updateFilters({ direction: filters.direction === "asc" ? "desc" : "asc" })} className="inline-flex items-center gap-2 rounded-sm focus-visible:outline-2 focus-visible:outline-ring">Full name<ArrowDownUp className="size-3" aria-hidden="true" /></button></th>
        {["Phone", "Gender", "Role", "Status"].map((label) => <th key={label} scope="col" className="px-4 py-3 font-normal">{label}</th>)}<th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
      </tr></thead><tbody>{result.data.users.map((user) => <tr key={user.id} className="border-t border-border">
        <th scope="row" className="px-4 py-4 font-normal"><div className="flex items-center gap-3"><span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-secondary text-xs font-medium">{userInitials(user.fullName)}</span><div><span className="block font-medium">{user.fullName}</span><span className="mt-0.5 block text-xs text-muted-foreground">{user.email}</span></div></div></th>
        <td className="px-4 py-4 font-mono text-xs">{user.phone}</td><td className="px-4 py-4 text-muted-foreground">{user.gender ? user.gender.charAt(0) + user.gender.slice(1).toLowerCase() : "—"}</td>
        <td className="max-w-52 px-4 py-4 text-muted-foreground">{user.roles.map((role) => adminRoleLabels[role as AdminRoleCode] ?? role).join(", ") || "—"}</td>
        <td className="px-4 py-4"><span className={`inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-1 text-xs ${user.status === "ACTIVE" ? "text-success" : "text-danger"}`}><span aria-hidden="true" className="size-1.5 rounded-full bg-current" />{user.status === "ACTIVE" ? "Active" : user.status === "LOCKED" ? "Locked" : "Deleted"}</span></td>
        <td className="w-12 px-4 py-4"><Popover open={openUserMenu === user.id} onOpenChange={(value) => setOpenUserMenu(value ? user.id : null)}><PopoverTrigger type="button" aria-label={`Actions for ${user.fullName}`} className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"><MoreHorizontal className="size-4" aria-hidden="true" /></PopoverTrigger><PopoverContent align="end" aria-label={`User actions for ${user.fullName}`} className="w-40 gap-0 rounded-sm p-1">{(["edit", "roles", "password", "unlock", "delete"] as const).filter((action) => canManageUser(roles, action)).map((action) => <button key={action} type="button" className={`min-h-10 rounded-sm px-3 text-left text-xs hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring ${action === "delete" ? "text-danger" : ""}`} onClick={() => open({ action, user })}>{actionLabels[action]}</button>)}</PopoverContent></Popover></td>
      </tr>)}</tbody></table></div>
      <AdminPagination page={result.data.page} onPageChange={(page) => setFilters((current) => ({ ...current, page }))} />
    </>}
    {editor && <UserDialog key={`${editor.action}:${"user" in editor ? editor.user.id : "new"}`} editor={editor} pending={mutation.isPending} error={mutation.error?.kind === "aborted" ? null : mutation.error} close={close} save={(input) => { pendingInput.current = input; mutation.mutate(input); }} />}
  </section>;
}

export default AdminUsersPage;
