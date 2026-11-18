"use client";

import { useState } from "react";
import { AdminEmptyState, AdminError, AdminPageHeader, AdminPagination } from "../components/AdminPrimitives";
import { PromotionField, PromotionPanel, PromotionSelect, formDate, formText, localDateTime } from "../components/PromotionFields";
import { sellerButton, sellerPrimary } from "../components/SellerUi";
import { queryKeys } from "../configs/queryKeys";
import { useApiQuery } from "../hooks/useApi";
import { useAuth } from "../hooks/useAuth";
import { changeEventStatus, getEventRegistrations, getPromotionEvents, registerForEvent, reviewEventRegistration, savePromotionEvent, withdrawFromEvent } from "../service/promotionService";
import type { EventWrite, PromotionEvent } from "../types/promotionType";
import { useAdminAction } from "./useAdminAction";

function EventForm({ event, close }: { event?: PromotionEvent; close: () => void }) {
  const auth = useAuth();
  const [validation, setValidation] = useState("");
  const save = useAdminAction((input: EventWrite, options) => savePromotionEvent(event?.id, input, options), [queryKeys.promotions.root(auth.sessionId)], close);
  return <PromotionPanel title={event ? "Edit event" : "New event"}><form className="space-y-5" onSubmit={(e) => {
    e.preventDefault(); const data = new FormData(e.currentTarget);
    const input: EventWrite = { name: formText(data, "name"), description: formText(data, "description"), bannerUrl: formText(data, "bannerUrl"),
      registrationStartAt: formDate(data, "registrationStartAt"), registrationEndAt: formDate(data, "registrationEndAt"), startAt: formDate(data, "startAt"), endAt: formDate(data, "endAt") };
    if (!(input.registrationStartAt < input.registrationEndAt && input.registrationEndAt <= input.startAt && input.startAt < input.endAt)) { setValidation("Registration must end before the event starts, and the event must end after it starts."); return; }
    setValidation(""); save.run(input);
  }}><fieldset disabled={save.isPending} className="grid gap-5 sm:grid-cols-2">
    <PromotionField name="name" label="Event name" value={event?.name} required />
    <PromotionField name="bannerUrl" label="Banner URL" type="url" value={event?.bannerUrl} />
    <PromotionField name="description" label="Description" value={event?.description} />
    {["registrationStartAt", "registrationEndAt", "startAt", "endAt"].map((key, i) => <PromotionField key={key} name={key} label={["Registration opens", "Registration closes", "Event starts", "Event ends"][i]} type="datetime-local" required value={localDateTime(event?.[key as "startAt"])} />)}
  </fieldset><p className="text-xs text-muted-foreground">Times use your local timezone. Events advance automatically after registration opens.</p>
  {validation && <p role="alert" className="text-sm text-danger">{validation}</p>}<AdminError error={save.error} />
  <div className="flex gap-3"><button className={sellerPrimary} disabled={save.isPending}>Save event</button><button type="button" className={sellerButton} onClick={close}>Close editor</button></div></form></PromotionPanel>;
}

function Registrations({ eventId }: { eventId: string }) {
  const auth = useAuth(); const [page, setPage] = useState(0); const [status, setStatus] = useState(""); const [note, setNote] = useState("");
  const filters = { page, ...(status ? { status } : {}) };
  const result = useApiQuery({ queryKey: queryKeys.promotions.list(auth.sessionId, "registrations", { eventId, ...filters }), meta: { requiresAuth: true }, service: (signal) => getEventRegistrations(eventId, filters, { context: auth.requestContext, signal }) });
  const review = useAdminAction((input: { id: string; status: "APPROVED" | "REJECTED" }, options) => reviewEventRegistration(input.id, input.status, note, options), [queryKeys.promotions.root(auth.sessionId)], () => setNote(""));
  return <PromotionPanel title="Seller registrations"><PromotionSelect name="registration-status" label="Registration status" value={status} values={["", "PENDING", "APPROVED", "REJECTED", "WITHDRAWN"]} onChange={(v) => { setStatus(v); setPage(0); }} />
    <label className="grid gap-2 text-sm">Review note<input className="min-h-11 rounded-sm border border-border px-3" value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} /></label>
    <AdminError error={result.error} onRetry={() => void result.refetch()} /><AdminError error={review.error} />
    {result.isPending && <p role="status">Loading registrations…</p>}
    {result.data?.content.map((row) => <div key={row.id} className="flex flex-wrap items-center gap-3 border-t border-border py-4 text-sm"><span className="min-w-0 flex-1 break-all font-mono">{row.sellerId}</span><span>{row.status}</span>{row.reviewNote && <p className="basis-full">{row.reviewNote}</p>}{row.status === "PENDING" && <><button className={sellerButton} disabled={review.isPending} onClick={() => review.run({ id: row.id, status: "APPROVED" })}>Approve</button><button className={sellerButton} disabled={review.isPending} onClick={() => review.run({ id: row.id, status: "REJECTED" })}>Reject</button></>}</div>)}
    {result.data?.content.length === 0 && <AdminEmptyState title="No registrations" />}<AdminPagination page={result.data?.page} onPageChange={setPage} />
  </PromotionPanel>;
}

function PromotionEvents({ admin = false }: { admin?: boolean }) {
  const auth = useAuth(); const [page, setPage] = useState(0); const [status, setStatus] = useState("");
  const [editor, setEditor] = useState<PromotionEvent | "new" | null>(null); const [selected, setSelected] = useState<string | null>(null); const [notice, setNotice] = useState("");
  const filters = { page, ...(status ? { status } : {}) };
  const result = useApiQuery({ queryKey: queryKeys.promotions.list(auth.sessionId, "events", filters), meta: { requiresAuth: true }, service: (signal) => getPromotionEvents(filters, { context: auth.requestContext, signal }) }, { refetchInterval: 30_000 });
  const action = useAdminAction(async (input: { id: string; action: "OPEN" | "CANCEL" | "REGISTER" | "WITHDRAW" }, options) => {
    if (input.action === "REGISTER") { const row = await registerForEvent(input.id, options); return `Registration ${row.status.toLowerCase()}.`; }
    if (input.action === "WITHDRAW") { await withdrawFromEvent(input.id, options); return "Registration withdrawn."; }
    await changeEventStatus(input.id, input.action, options); return "Event updated.";
  }, [queryKeys.promotions.root(auth.sessionId)], setNotice);
  return <div className="space-y-6"><AdminPageHeader title={admin ? "Promotions" : "Sale events"} description="Plan campaigns, register shops and manage event participation.">{admin && <button className={sellerPrimary} onClick={() => setEditor("new")}>Create event</button>}</AdminPageHeader>
    <PromotionSelect name="event-status" label="Event status" value={status} values={["", "DRAFT", "REGISTRATION_OPEN", "REGISTRATION_CLOSED", "ACTIVE", "ENDED", "CANCELED"]} onChange={(v) => { setStatus(v); setPage(0); }} />
    <AdminError error={result.error} onRetry={() => void result.refetch()} /><AdminError error={action.error} />{notice && <p role="status" className="text-sm text-success">{notice}</p>}
    {result.isPending && <p role="status">Loading events…</p>}
    <div className="overflow-x-auto rounded-sm border border-border"><table className="w-full min-w-[700px] text-left text-sm"><caption className="sr-only">Sale events</caption><thead className="bg-muted text-xs text-muted-foreground"><tr>{["Event", "Registration", "Event dates", "Status", "Actions"].map((s) => <th key={s} className="p-4">{s}</th>)}</tr></thead><tbody>{result.data?.content.map((event) => <tr key={event.id} className="border-t border-border"><td className="max-w-64 p-4"><p className="font-medium">{event.name}</p><p className="mt-1 break-all font-mono text-xs text-muted-foreground">{event.id}</p><p className="mt-1 break-words text-xs text-muted-foreground">{event.description}</p></td><td className="p-4 text-xs">{new Date(event.registrationStartAt).toLocaleString()}<br />to {new Date(event.registrationEndAt).toLocaleString()}</td><td className="p-4 text-xs">{new Date(event.startAt).toLocaleString()}<br />to {new Date(event.endAt).toLocaleString()}</td><td className="p-4 text-xs">{event.status}{event.registrationOpenRequested && event.status === "DRAFT" && <p>Opening scheduled</p>}</td><td className="p-4"><div className="flex flex-wrap gap-2">{admin ? <>
      {event.status === "DRAFT" && <><button className={sellerButton} onClick={() => setEditor(event)}>Edit</button><button className={sellerButton} disabled={action.isPending || event.registrationOpenRequested} onClick={() => action.run({ id: event.id, action: "OPEN" })}>Open registration</button></>}
      {!["ENDED", "CANCELED"].includes(event.status) && <button className={sellerButton} disabled={action.isPending} onClick={() => { if (window.confirm(`Cancel ${event.name}?`)) action.run({ id: event.id, action: "CANCEL" }); }}>Cancel event</button>}
      <button className={sellerButton} onClick={() => setSelected(event.id)}>Registrations</button>
    </> : <><button className={sellerPrimary} disabled={event.status !== "REGISTRATION_OPEN" || action.isPending} onClick={() => action.run({ id: event.id, action: "REGISTER" })}>Register</button><button className={sellerButton} disabled={action.isPending || ["ACTIVE", "ENDED"].includes(event.status) || event.status === "CANCELED"} onClick={() => { if (window.confirm("Withdraw your event registration?")) action.run({ id: event.id, action: "WITHDRAW" }); }}>Withdraw registration</button></>}</div></td></tr>)}</tbody></table></div>
    {result.data?.content.length === 0 && <AdminEmptyState title="No sale events" />}<AdminPagination page={result.data?.page} onPageChange={setPage} />
    {editor && <EventForm key={editor === "new" ? "new" : editor.id} event={editor === "new" ? undefined : editor} close={() => setEditor(null)} />}
    {admin && selected && <Registrations key={selected} eventId={selected} />}
  </div>;
}
export default PromotionEvents;
