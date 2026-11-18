"use client";

import { useState } from "react";
import { Folder, Plus, Search } from "lucide-react";
import { AdminEmptyState, AdminError, AdminPageHeader, adminInputClass } from "../components/AdminPrimitives";
import { sellerButton, sellerDanger, sellerPrimary } from "../components/SellerUi";
import { queryKeys } from "../configs/queryKeys";
import { useApiQuery } from "../hooks/useApi";
import { useAuth } from "../hooks/useAuth";
import { getCategoryTree } from "../service/catalogService";
import { createAdminCategory, deleteAdminCategory, getAdminCategory, updateAdminCategory } from "../service/adminCatalogService";
import type { AdminCategory, CategoryInput } from "../types/adminCatalogType";
import { CategoryParentPicker } from "../components/CategoryParentPicker";
import { categorySlug, flattenAdminCategories, type CategoryChoice } from "./adminCategoryUtils";
import { useAdminAction } from "./useAdminAction";

function CategoryForm({ category, choices, close, created }: { category?: AdminCategory; choices: CategoryChoice[]; close: () => void; created?: (id: string) => void }) {
  const auth = useAuth();
  const [name, setName] = useState(category?.name ?? "");
  const [slug, setSlug] = useState(category?.slug ?? "");
  const [slugEdited, setSlugEdited] = useState(Boolean(category));
  const [description, setDescription] = useState(category?.description ?? "");
  const [parentId, setParentId] = useState(category?.parentId ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [message, setMessage] = useState("");
  const invalidations = [queryKeys.backoffice.categories(auth.sessionId), queryKeys.catalog.tree, ["catalog", "products"]];
  const save = useAdminAction((body: CategoryInput, options) => category ? updateAdminCategory(category.id, body, options) : createAdminCategory(body, options), invalidations,
    (result) => { setMessage("Category saved."); if (!category) created?.(result.id); });
  const remove = useAdminAction((_input: undefined, options) => deleteAdminCategory(category!.id, options), invalidations, close);
  const busy = save.isPending || remove.isPending;
  return <section className="min-w-0 rounded-sm border border-border bg-card p-5 sm:p-6" aria-label="Category editor">
    <h2 className="mb-6 text-heading-20">{category ? "Edit category" : "New category"}</h2>
    <form className="space-y-5" onSubmit={(event) => {
      event.preventDefault(); setMessage("");
      save.run({ name: name.trim(), slug: slug.trim(), description: description.trim() || null, parentId: parentId || null });
    }}>
      <fieldset disabled={busy} className="space-y-5">
        <label className="block text-sm">Name<input aria-label="Name" className={`${adminInputClass} mt-2`} required maxLength={150} pattern=".*\S.*" value={name} onChange={(event) => { setName(event.target.value); if (!slugEdited) setSlug(categorySlug(event.target.value)); }} /></label>
        <label className="block text-sm">Slug<input aria-label="Slug" className={`${adminInputClass} mt-2 font-mono`} required maxLength={100} pattern="[a-z0-9]+(-[a-z0-9]+)*" title="Lowercase letters, numbers and single hyphens" value={slug} onChange={(event) => { setSlug(event.target.value); setSlugEdited(true); }} /><span className="mt-1 block text-xs text-muted-foreground">{category ? "Changing the slug changes the category URL." : "Generated from the name. Edit it only if you need a different URL."}</span></label>
        <div className="block text-sm"><span>Parent category</span><CategoryParentPicker label="Parent category" value={parentId} onChange={setParentId} choices={choices.filter((choice) => choice.id !== category?.id && !choice.ancestors.includes(category?.id ?? ""))} /><span className="mt-1 block text-xs text-muted-foreground">Change the parent to move this category and its children.</span></div>
        <label className="block text-sm">Description<textarea aria-label="Description" rows={4} maxLength={1000} className={`${adminInputClass} mt-2 resize-y`} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
        {category && <dl className="grid gap-1 text-xs text-muted-foreground"><dt>Category path</dt><dd className="break-all font-mono">{category.path}</dd></dl>}
        <div className="flex flex-wrap justify-between gap-3 border-t border-border pt-5">
          {category && <button type="button" className={sellerButton} onClick={() => { setConfirmDelete(true); remove.reset(); }}>Delete category</button>}
          <div className="ml-auto flex flex-wrap gap-3"><button type="button" className={sellerButton} onClick={close}>Cancel</button><button type="submit" className={sellerPrimary}>{save.isPending ? "Saving…" : "Save category"}</button></div>
        </div>
      </fieldset>
      <AdminError error={save.error?.kind === "aborted" ? null : save.error} />
      {message && <p role="status" className="text-sm text-success">{message}</p>}
    </form>
    {confirmDelete && <div className="mt-5 space-y-3 rounded-sm border border-danger/30 bg-danger/5 p-4" role="group" aria-label="Confirm category deletion">
      <p className="text-sm">Delete “{category?.name}”? Categories with products or children cannot be deleted.</p>
      <AdminError error={remove.error?.kind === "aborted" ? null : remove.error} />
      <div className="flex flex-wrap gap-3"><button type="button" disabled={busy} className={sellerButton} onClick={() => setConfirmDelete(false)}>Keep category</button><button type="button" disabled={busy} className={sellerDanger} onClick={() => remove.run(undefined)}>{remove.isPending ? "Deleting…" : "Confirm delete"}</button></div>
    </div>}
  </section>;
}

function CategoryEditor({ id, choices, close }: { id: string; choices: CategoryChoice[]; close: () => void }) {
  const auth = useAuth();
  const detail = useApiQuery({ queryKey: queryKeys.backoffice.category(auth.sessionId, id), service: (signal) => getAdminCategory(id, { signal }) }, { retry: false });
  if (detail.isPending) return <p role="status">Loading category…</p>;
  if (detail.error) return <AdminError error={detail.error} onRetry={() => void detail.refetch()} />;
  return <CategoryForm category={detail.data} choices={choices} close={close} />;
}

function AdminCategoriesPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const tree = useApiQuery({ queryKey: queryKeys.catalog.tree, service: (signal) => getCategoryTree({ signal }) });
  const choices = flattenAdminCategories(tree.data ?? []);
  const filtered = choices.filter((choice) => choice.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  return <>
    <AdminPageHeader title="Categories" description={`${choices.length} categories · organize your product catalogue`}><button className={sellerPrimary} onClick={() => setSelected("new")}><Plus className="size-4" aria-hidden="true" />New category</button></AdminPageHeader>
    <AdminError error={tree.error} onRetry={() => void tree.refetch()} />
    <div className="grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(240px,1fr)_minmax(0,2fr)]">
      <section className="min-w-0 rounded-sm border border-border bg-card" aria-label="Category tree">
        <label className="flex items-center gap-2 border-b border-border px-4 py-3"><Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" /><input aria-label="Search categories" className="min-h-10 min-w-0 flex-1 bg-transparent text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search categories" /></label>
        {tree.isPending ? <p role="status" className="p-5 text-sm">Loading categories…</p> : filtered.length ? <nav aria-label="Categories" className="max-h-[640px] overflow-y-auto py-2">{filtered.map((choice) => <button key={choice.id} aria-pressed={selected === choice.id} onClick={() => setSelected(choice.id)} style={{ paddingLeft: 16 + choice.depth * 20 }} className={`flex min-h-11 w-full items-center gap-2 pr-4 text-left text-sm hover:bg-muted ${selected === choice.id ? "bg-primary/5 font-medium text-primary" : ""}`}><Folder aria-hidden="true" className="size-4 shrink-0" /><span className="min-w-0 break-words">{choice.name}</span></button>)}</nav> : <AdminEmptyState title={search ? "No matching categories" : "No categories yet"} />}
      </section>
      {selected === "new" ? <CategoryForm key="new" choices={choices} close={() => setSelected(null)} created={setSelected} /> : selected ? <CategoryEditor key={selected} id={selected} choices={choices} close={() => setSelected(null)} /> : <AdminEmptyState title="Choose a category" description="Select a category to edit it, or create a new one to organize your catalogue." />}
    </div>
  </>;
}
export default AdminCategoriesPage;
