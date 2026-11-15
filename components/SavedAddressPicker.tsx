"use client";

import Link from "next/link";
import type { SavedAddress } from "../types/addressBookType";

type SavedAddressPickerProps = {
  addresses: SavedAddress[];
  selectedId: string;
  loading: boolean;
  error?: string;
  disabled: boolean;
  onSelect: (id: string) => void;
  onRetry: () => void;
};

function SavedAddressPicker({ addresses, selectedId, loading, error, disabled, onSelect, onRetry }: SavedAddressPickerProps) {
  return (
    <section className="rounded-sm border border-border bg-card p-4 sm:p-6" aria-labelledby="saved-address-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="saved-address-title" className="text-sm font-semibold">Your saved addresses</h2>
        <Link href="/addresses" className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline underline-offset-4">Manage addresses</Link>
      </div>
      {loading ? <p role="status" className="text-sm text-muted-foreground">Loading saved addresses…</p> : error ? (
        <div className="text-sm">
          <p role="alert" className="break-words text-danger">{error}</p>
          <p className="mt-2 text-muted-foreground">You can still enter a delivery address below.</p>
          <button type="button" onClick={onRetry} disabled={disabled} className="min-h-11 text-primary underline underline-offset-4">Retry saved addresses</button>
        </div>
      ) : (
        <>
          <label htmlFor="checkout-saved-address" className="mb-2 block text-sm">Deliver to</label>
          <select id="checkout-saved-address" value={selectedId} disabled={disabled} onChange={(event) => onSelect(event.target.value)} className="min-h-11 w-full min-w-0 rounded-sm border border-input bg-background px-3 text-sm disabled:opacity-60">
            <option value="">Enter a new address</option>
            {addresses.map((address) => <option key={address.id} value={address.id}>{address.isDefault ? "Default · " : ""}{address.recipientName} · {address.addressLine}, {address.wardName}, {address.provinceName}</option>)}
          </select>
          {!addresses.length && <p className="mt-2 text-sm text-muted-foreground">Save your first address for a faster checkout next time.</p>}
        </>
      )}
    </section>
  );
}

export default SavedAddressPicker;
