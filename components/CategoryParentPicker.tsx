"use client";

import { useEffect, useId, useRef, useState } from "react";
import { adminInputClass } from "./AdminPrimitives";

export type ParentChoice = { id: string; name: string; depth: number; ancestors: string[] };

const plain = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[đĐ]/g, "d").toLowerCase();

export function CategoryParentPicker({ label, value, choices, onChange, disabled = false }: { label: string; value: string; choices: ParentChoice[]; onChange: (id: string) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const listId = useId();
  const names = new Map(choices.map((choice) => [choice.id, choice.name]));
  const pathOf = (choice: ParentChoice) => choice.ancestors.map((id) => names.get(id)).filter(Boolean).join(" › ");
  const selected = choices.find((choice) => choice.id === value);
  const search = plain(query.trim());
  const visible = search ? choices.filter((choice) => plain(choice.name).includes(search) || plain(pathOf(choice)).includes(search)) : choices;
  useEffect(() => {
    if (!open) return;
    const outside = (event: MouseEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", outside);
    return () => document.removeEventListener("mousedown", outside);
  }, [open]);
  const pick = (id: string) => { onChange(id); setOpen(false); setQuery(""); };
  return <div ref={root} className="relative" onKeyDown={(event) => { if (event.key === "Escape" && open) { event.stopPropagation(); setOpen(false); } }}>
    <button type="button" aria-label={label} aria-haspopup="listbox" aria-expanded={open} aria-controls={listId} data-value={value} disabled={disabled} onClick={() => setOpen(!open)}
      className={`${adminInputClass} mt-2 flex items-center justify-between gap-3 text-left`}>
      <span className="min-w-0 truncate">{selected ? <>{pathOf(selected) && <span className="text-muted-foreground">{pathOf(selected)} › </span>}{selected.name}</> : <span className="text-muted-foreground">None · top level</span>}</span>
      <span aria-hidden="true" className={`shrink-0 text-xs text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
    </button>
    {open && <div className="absolute inset-x-0 z-30 mt-1 overflow-hidden rounded-md border border-border bg-card shadow-modal">
      <div className="border-b border-border p-2"><input autoFocus aria-label="Search parent categories" placeholder="Search categories" value={query} onChange={(event) => setQuery(event.target.value)}
        className="min-h-10 w-full rounded-sm border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring" /></div>
      <ul id={listId} role="listbox" aria-label={label} className="max-h-72 overflow-y-auto py-1 text-sm">
        {!search && <li role="option" aria-selected={!value} data-value="" tabIndex={0} onClick={() => pick("")} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); pick(""); } }}
          className={`mx-1 cursor-pointer rounded-sm px-3 py-2 italic text-muted-foreground hover:bg-muted focus-visible:bg-muted focus-visible:outline-none ${!value ? "bg-primary/10 text-primary" : ""}`}>None · top level</li>}
        {visible.map((choice) => <li key={choice.id} role="option" aria-selected={choice.id === value} data-value={choice.id} tabIndex={0} onClick={() => pick(choice.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); pick(choice.id); } }}
          className={`mx-1 cursor-pointer rounded-sm py-2 pr-3 hover:bg-muted focus-visible:bg-muted focus-visible:outline-none ${choice.id === value ? "bg-primary/10 font-medium text-primary" : ""} ${search ? "pl-3" : choice.depth === 0 ? "mt-1 pl-3 font-semibold" : ""}`}
          style={search || choice.depth === 0 ? undefined : { paddingLeft: 12 + choice.depth * 16 }}>
          {!search && choice.depth > 0 ? <span className="block border-l border-border pl-3">{choice.name}</span> : <>{search && pathOf(choice) && <span className="block text-xs font-normal text-muted-foreground">{pathOf(choice)}</span>}{choice.name}</>}
        </li>)}
        {visible.length === 0 && <li className="px-4 py-3 text-muted-foreground">No categories match “{query}”.</li>}
      </ul>
    </div>}
  </div>;
}
