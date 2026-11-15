"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Plus } from "lucide-react";
import AddressForm from "../components/AddressForm";
import { queryKeys } from "../configs/queryKeys";
import { ACCOUNT_EXTENSIONS_ENABLED } from "../configs/account";
import { useApiMutation, useApiQuery } from "../hooks/useApi";
import { useAuth } from "../hooks/useAuth";
import { deleteAddress, getAddresses, saveAddress, setDefaultAddress, updateAddress } from "../service/addressBookService";
import { getProvinces, getWards } from "../service/checkoutService";
import { ADDRESS_BOOK_LIMIT } from "../types/addressBookType";
import type { AddressBookInput, SavedAddress } from "../types/addressBookType";
import type { CheckoutAddress } from "../types/checkoutType";
import type { ApiError } from "../types/commonResponseType";
import { getAddressBookInput, getAddressBookFieldErrors, validateAddressBookAddress } from "./addressBookSchema";

const actionClass = "inline-flex min-h-11 min-w-11 items-center justify-center rounded-sm border border-border px-4 text-sm font-medium hover:bg-secondary disabled:opacity-60";
type AddressCommand =
  { kind: "save"; id?: string; input: AddressBookInput } |
  { kind: "default"; id: string } |
  { kind: "delete"; id: string };
type AddressOperation = { sessionId: number; controller: AbortController } & AddressCommand;

function AddressesPage() {
  const router = useRouter();
  const { status, user, sessionId, error, retryProfile } = useAuth();
  useEffect(() => {
    if (status === "anonymous") router.replace("/sign-in?returnTo=%2Faddresses");
  }, [status, router]);
  return (
    <div className="min-w-0 space-y-6 pb-12">
      <div><h1 className="text-heading-32">Addresses</h1><p className="mt-2 text-sm text-muted-foreground">Manage your delivery addresses and choose a default for checkout.</p></div>
      {!ACCOUNT_EXTENSIONS_ENABLED ? <p role="status" className="rounded-sm border border-border bg-card p-6 text-muted-foreground">Saved addresses are not available yet. You can enter your delivery address at checkout.</p> : status === "authenticated" && user ? <AddressBook key={sessionId} /> : status === "error" ? (
        <div className="rounded-sm border border-border bg-card p-6"><p role="alert">{error?.detail || "Unable to load your account."}</p><button type="button" onClick={() => void retryProfile()} className={`${actionClass} mt-4`}>Retry account</button></div>
      ) : <p role="status" className="py-8 text-muted-foreground">Loading your account…</p>}
    </div>
  );
}

function AddressBook() {
  const { requestContext, sessionId, isSessionCurrent } = useAuth();
  const [editor, setEditor] = useState<SavedAddress | "new" | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const active = useRef<AddressOperation | null>(null);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; active.current?.controller.abort(); };
  }, []);
  const current = (operation: AddressOperation) => mounted.current && !operation.controller.signal.aborted && isSessionCurrent(operation.sessionId);
  const addresses = useApiQuery({
    queryKey: queryKeys.account.addresses(sessionId), meta: { requiresAuth: true },
    service: (signal) => getAddresses({ context: requestContext, signal }),
  }, { retry: false });
  const mutation = useApiMutation<SavedAddress | void, AddressOperation>({
    mutationKey: ["account", sessionId, "address-write"], isCurrent: current,
    invalidateKey: [queryKeys.account.addresses(sessionId)],
    execute: (operation) => {
      const options = { context: requestContext, signal: operation.controller.signal };
      if (operation.kind === "delete") return deleteAddress(operation.id, options);
      if (operation.kind === "default") return setDefaultAddress(operation.id, options);
      return operation.id ? updateAddress(operation.id, operation.input, options) : saveAddress(operation.input, options);
    },
  }, {
    gcTime: 0,
    onSuccess: (_address, operation) => {
      if (!current(operation)) return;
      setEditor(null); setRemovingId(null);
      setMessage(operation.kind === "delete" ? "Address removed." : operation.kind === "default" ? "Default address updated." : "Address saved.");
    },
    onSettled: (_result, _error, operation) => { if (active.current === operation) active.current = null; },
  });
  const submit = (input: AddressCommand) => {
    if (active.current || !isSessionCurrent(sessionId)) return;
    const operation = { ...input, sessionId, controller: new AbortController() };
    active.current = operation; setMessage(""); mutation.mutate(operation);
  };
  const edit = (address: SavedAddress | "new") => { mutation.reset(); setMessage(""); setRemovingId(null); setEditor(address); };
  const error = mutation.error?.kind !== "aborted" ? mutation.error : null;
  const count = addresses.data?.length ?? 0;
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">{count} of {ADDRESS_BOOK_LIMIT} addresses saved</p>
        <button type="button" disabled={!addresses.isSuccess || count >= ADDRESS_BOOK_LIMIT || mutation.isPending} onClick={() => edit("new")} className={`${actionClass} gap-2 border-primary bg-primary text-primary-foreground hover:bg-primary-hover`}><Plus size={16} aria-hidden="true" />Add address</button>
      </div>
      {count >= ADDRESS_BOOK_LIMIT && <p className="text-sm text-muted-foreground">Your address book is full. Remove an address before adding another.</p>}
      {message && <p role="status" className="rounded-sm bg-muted p-4 text-sm">{message}</p>}
      {error && <p role="alert" className="break-words rounded-sm border border-danger p-4 text-sm text-danger">{error.detail || error.title}</p>}
      {editor && <AddressEditor key={editor === "new" ? "new" : editor.id} address={editor === "new" ? undefined : editor} first={count === 0} busy={mutation.isPending} serverError={error} onSave={(input) => submit({ kind: "save", id: editor === "new" ? undefined : editor.id, input })} onCancel={() => { setEditor(null); mutation.reset(); }} />}
      {addresses.isPending ? <p role="status" className="py-8 text-muted-foreground">Loading addresses…</p> : addresses.isError ? (
        <div className="rounded-sm border border-border bg-card p-6"><p role="alert">{addresses.error.detail || addresses.error.title}</p><button type="button" className={`${actionClass} mt-4`} onClick={() => void addresses.refetch()}>Retry addresses</button></div>
      ) : !count ? (
        <div className="rounded-sm border border-dashed border-border bg-card px-6 py-12 text-center"><MapPin className="mx-auto size-8 text-muted-foreground" aria-hidden="true" /><h2 className="mt-4 text-lg font-semibold">No saved addresses yet</h2><p className="mt-2 text-sm text-muted-foreground">Add a delivery address to use it on your next order.</p></div>
      ) : (
        <ul className="grid min-w-0 gap-4 sm:grid-cols-2">
          {addresses.data!.map((address) => (
            <li key={address.id} className={`min-w-0 rounded-sm border bg-card p-5 ${address.isDefault ? "border-primary" : "border-border"}`}>
              <div className="flex flex-wrap items-start justify-between gap-3"><h2 className="break-words font-semibold">{address.recipientName}</h2>{address.isDefault && <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-primary">Default</span>}</div>
              <p className="mt-3 break-words text-sm text-muted-foreground">{address.phoneNumber}</p>
              <p className="mt-2 break-words text-sm leading-6">{address.addressLine}<br />{address.wardName}, {address.provinceName}</p>
              <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-3">
                <button type="button" className={actionClass} disabled={mutation.isPending} onClick={() => edit(address)} aria-label={`Edit address for ${address.recipientName}`}>Edit</button>
                {!address.isDefault && <button type="button" className={actionClass} disabled={mutation.isPending} onClick={() => submit({ kind: "default", id: address.id })} aria-label={`Set default address for ${address.recipientName}`}>Set default</button>}
                <button type="button" className={`${actionClass} text-danger`} disabled={mutation.isPending} onClick={() => { setRemovingId(address.id); mutation.reset(); }} aria-label={`Remove address for ${address.recipientName}`}>Remove</button>
              </div>
              {removingId === address.id && <div className="mt-3 rounded-sm bg-muted p-3 text-sm"><p>Remove this address?{address.isDefault && count > 1 ? " Another address will become your default." : ""}</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={mutation.isPending} className={`${actionClass} text-danger`} onClick={() => submit({ kind: "delete", id: address.id })}>Confirm removal</button><button type="button" disabled={mutation.isPending} className={actionClass} onClick={() => setRemovingId(null)}>Keep address</button></div></div>}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function AddressEditor({ address, first, busy, serverError, onSave, onCancel }: { address?: SavedAddress; first: boolean; busy: boolean; serverError: ApiError | null; onSave: (input: AddressBookInput) => void; onCancel: () => void }) {
  const { requestContext, sessionId, user } = useAuth();
  const [values, setValues] = useState<CheckoutAddress>(() => address ?? { recipientName: user?.fullName ?? "", phoneNumber: user?.phone ?? "", addressLine: "", provinceCode: "", wardCode: "" });
  const [isDefault, setIsDefault] = useState(first || Boolean(address?.isDefault));
  const [submitted, setSubmitted] = useState(false);
  const provinces = useApiQuery({ queryKey: queryKeys.checkout.provinces(sessionId), meta: { requiresAuth: true }, service: (signal) => getProvinces({ context: requestContext, signal }) }, { retry: false });
  const wards = useApiQuery({ queryKey: queryKeys.checkout.wards(sessionId, values.provinceCode), meta: { requiresAuth: true }, service: (signal) => getWards(values.provinceCode, { context: requestContext, signal }) }, { enabled: Boolean(values.provinceCode), retry: false });
  const errors = { ...(submitted ? validateAddressBookAddress(values) : {}), ...getAddressBookFieldErrors(serverError) };
  const save = () => {
    setSubmitted(true);
    const input = getAddressBookInput(values, provinces.isError ? [] : provinces.data ?? [], wards.isError ? [] : wards.data ?? [], isDefault);
    const firstError = Object.keys(validateAddressBookAddress(values))[0];
    if (firstError) requestAnimationFrame(() => document.getElementById(`checkout-${firstError}`)?.focus());
    if (!input || busy) return;
    onSave(input);
  };
  return (
    <section className="space-y-3" aria-label={address ? "Edit saved address" : "New saved address"}>
      <AddressForm addressLineMaxLength={255} title={address ? "Edit address" : "Add address"} submitLabel={busy ? "Saving…" : "Save address"} busy={busy} values={values} errors={errors} provinces={provinces.data ?? []} wards={wards.data ?? []} provinceState={{ loading: provinces.isFetching, error: provinces.error?.detail || provinces.error?.title }} wardState={{ loading: wards.isFetching, error: wards.error?.detail || wards.error?.title }} onRetry={(level) => void (level === "province" ? provinces : wards).refetch()} onChange={(field, value) => setValues((previous) => ({ ...previous, [field]: value, ...(field === "provinceCode" ? { wardCode: "" } : {}) }))} onSubmit={save} />
      <div className="flex flex-wrap items-center justify-between gap-3"><label className="inline-flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={isDefault} disabled={busy || first || Boolean(address?.isDefault)} onChange={(event) => setIsDefault(event.target.checked)} className="size-4 accent-primary" />Use as my default address</label><button type="button" disabled={busy} onClick={onCancel} className={actionClass}>Cancel</button></div>
    </section>
  );
}

export default AddressesPage;
