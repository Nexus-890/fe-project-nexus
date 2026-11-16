"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Building2, Plus, ShieldCheck } from "lucide-react";
import { queryKeys } from "../configs/queryKeys";
import { useAuth } from "../hooks/useAuth";
import { useApiMutation, useApiQuery } from "../hooks/useApi";
import { addSellerBankAccount, getSellerBankAccounts, maskedSellerBankAccount, sellerAccountErrorMessage, setDefaultSellerBankAccount, updateSellerBankAccount } from "../service/sellerBankService";
import { getSellerProfile, updateSellerProfile } from "../service/sellerProfileService";
import { SellerHeading, SellerPanel, sellerButton, sellerInput, sellerPrimary } from "../components/SellerUi";
import { readBackofficeRoles } from "./backofficeAccess";
import type { SellerBankAccount, SellerBankAccountInput } from "../types/sellerBankType";
import type { SellerProfile, SellerProfileInput } from "../types/sellerProfileType";

type ScopedOperation<T> = { body: T; sessionId: number; controller: AbortController };

function SellerProfileForm({ profile }: { profile: SellerProfile }) {
  const auth = useAuth();
  const [companyName, setCompanyName] = useState(profile.companyName);
  const [contactPhone, setContactPhone] = useState(profile.contactPhone);
  const [saved, setSaved] = useState(false);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  const mutation = useApiMutation<SellerProfile, ScopedOperation<SellerProfileInput>>({
    mutationKey: ["seller", auth.sessionId, "save-profile"],
    execute: ({ body, controller }) => updateSellerProfile(body, { context: auth.requestContext, signal: controller.signal }),
    isCurrent: ({ sessionId, controller }) => auth.isSessionCurrent(sessionId) && !controller.signal.aborted,
    invalidateKey: [queryKeys.seller.profile(auth.sessionId)],
  }, { onSuccess: () => setSaved(true), onSettled: (_data, _error, operation) => { if (pending.current === operation.controller) pending.current = null; } });
  return <SellerPanel title="Shop profile"><form className="space-y-5" onSubmit={(event) => {
    event.preventDefault(); if (pending.current) return;
    setSaved(false); const controller = new AbortController(); pending.current = controller;
    mutation.mutate({ body: { companyName, contactPhone }, sessionId: auth.sessionId, controller });
  }}><fieldset disabled={mutation.isPending} className="grid gap-5 sm:grid-cols-2"><label className="text-sm">Company name<input required maxLength={200} value={companyName} onChange={(event) => setCompanyName(event.target.value)} className={`${sellerInput} mt-2`} /></label><label className="text-sm">Contact phone<input required type="tel" maxLength={20} value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} className={`${sellerInput} mt-2`} /></label></fieldset><div className="flex flex-wrap items-center gap-4"><button type="submit" disabled={mutation.isPending} className={sellerPrimary}>{mutation.isPending ? "Saving profile…" : "Save shop profile"}</button><span className="text-xs text-muted-foreground">Seller status: {profile.status}</span></div>{mutation.error && mutation.error.kind !== "aborted" && <p role="alert" className="text-sm text-danger">{sellerAccountErrorMessage(mutation.error)}</p>}{saved && <p role="status" className="text-sm text-success">Shop profile saved.</p>}</form></SellerPanel>;
}

function BankAccountForm({ account, onClose }: { account?: SellerBankAccount; onClose: (saved: boolean) => void }) {
  const auth = useAuth();
  const [bankCode, setBankCode] = useState(account?.bankCode ?? "");
  const [accountHolderName, setAccountHolderName] = useState(account?.accountHolderName ?? "");
  const [accountNumber, setAccountNumber] = useState("");
  const accountNumberId = useId();
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  const mutation = useApiMutation<SellerBankAccount, ScopedOperation<SellerBankAccountInput>>({
    mutationKey: ["seller", auth.sessionId, "save-bank-account", account?.id],
    execute: ({ body, controller }) => account ? updateSellerBankAccount(account.id, body, { context: auth.requestContext, signal: controller.signal }) : addSellerBankAccount(body, { context: auth.requestContext, signal: controller.signal }),
    isCurrent: ({ sessionId, controller }) => auth.isSessionCurrent(sessionId) && !controller.signal.aborted,
    invalidateKey: [queryKeys.seller.bankAccounts(auth.sessionId), queryKeys.seller.payouts(auth.sessionId)],
  }, {
    onSuccess: () => { setAccountNumber(""); onClose(true); },
    onSettled: (_data, _error, operation) => { operation.body.accountNumber = ""; if (pending.current === operation.controller) pending.current = null; },
  });
  return <SellerPanel title={account ? "Edit bank account" : "Add bank account"}><form className="max-w-2xl space-y-5" onSubmit={(event) => {
    event.preventDefault(); if (pending.current) return;
    const controller = new AbortController(); pending.current = controller;
    mutation.mutate({ body: { bankCode, accountHolderName, accountNumber }, sessionId: auth.sessionId, controller });
  }}><fieldset disabled={mutation.isPending} className="grid gap-5 sm:grid-cols-2"><label className="text-sm">Bank code (NAPAS BIN)<input required inputMode="numeric" minLength={6} maxLength={6} pattern="[0-9]{6}" value={bankCode} onChange={(event) => setBankCode(event.target.value)} className={`${sellerInput} mt-2`} placeholder="970436" /></label><label className="text-sm">Account holder name<input required maxLength={100} value={accountHolderName} onChange={(event) => setAccountHolderName(event.target.value)} className={`${sellerInput} mt-2`} autoComplete="off" /></label><div className="text-sm sm:col-span-2"><label htmlFor={accountNumberId}>Account number</label><input id={accountNumberId} aria-describedby={`${accountNumberId}-help`} required type="password" inputMode="numeric" autoComplete="off" minLength={6} maxLength={34} pattern="[0-9]{6,34}" value={accountNumber} onChange={(event) => setAccountNumber(event.target.value)} className={`${sellerInput} mt-2`} /><p id={`${accountNumberId}-help`} className="mt-2 text-xs text-muted-foreground">{account ? "Re-enter the full number to save changes. Changing bank details requires verification again." : "Leading zeroes are preserved. Only the last four digits are shown after saving."}</p></div><div className="flex flex-wrap gap-3 sm:col-span-2"><button type="submit" className={sellerPrimary}>{mutation.isPending ? "Saving account…" : "Save bank account"}</button><button type="button" className={sellerButton} onClick={() => { setAccountNumber(""); onClose(false); }}>Cancel</button></div></fieldset>{mutation.error && mutation.error.kind !== "aborted" && <p role="alert" className="text-sm text-danger">{sellerAccountErrorMessage(mutation.error)}</p>}</form></SellerPanel>;
}

function SellerBankAccountsPage() {
  const auth = useAuth();
  const isSeller = auth.status === "authenticated" && readBackofficeRoles(auth.accessToken).includes("SELLER");
  const [editing, setEditing] = useState<SellerBankAccount | "new" | null>(null);
  const [notice, setNotice] = useState("");
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  const profile = useApiQuery({ queryKey: queryKeys.seller.profile(auth.sessionId), meta: { requiresAuth: true }, service: (signal) => getSellerProfile({ context: auth.requestContext, signal }) }, { enabled: isSeller, retry: false });
  const accounts = useApiQuery({ queryKey: queryKeys.seller.bankAccounts(auth.sessionId), meta: { requiresAuth: true }, service: (signal) => getSellerBankAccounts({ context: auth.requestContext, signal }) }, { enabled: isSeller, retry: false });
  const defaultMutation = useApiMutation<SellerBankAccount, { id: string; sessionId: number; controller: AbortController }>({
    mutationKey: ["seller", auth.sessionId, "default-bank-account"],
    execute: ({ id, controller }) => setDefaultSellerBankAccount(id, { context: auth.requestContext, signal: controller.signal }),
    isCurrent: ({ sessionId, controller }) => auth.isSessionCurrent(sessionId) && !controller.signal.aborted,
    invalidateKey: [queryKeys.seller.bankAccounts(auth.sessionId), queryKeys.seller.payouts(auth.sessionId)],
  }, { onSuccess: () => setNotice("Default bank account updated."), onSettled: (_data, _error, operation) => { if (pending.current === operation.controller) pending.current = null; } });
  if (!isSeller) return <SellerPanel title="403 · Seller access required"><p className="text-sm text-muted-foreground">Shop profile and bank accounts belong to the signed-in seller.</p></SellerPanel>;
  const defaultAccount = accounts.data?.find((row) => row.isDefault && row.active);
  return <>
    <SellerHeading title="Bank accounts" description="Update your shop profile and receiving bank accounts."><button type="button" disabled={defaultMutation.isPending} className={sellerPrimary} onClick={() => { setEditing("new"); setNotice(""); }}><Plus size={16} aria-hidden="true" />Add bank account</button></SellerHeading>
    {profile.isPending ? <p role="status" className="text-sm">Loading shop profile…</p> : profile.error ? <SellerPanel title="Shop profile unavailable"><p role="alert" className="text-sm text-danger">{sellerAccountErrorMessage(profile.error)}</p><button type="button" className={`${sellerButton} mt-4`} onClick={() => void profile.refetch()}>Retry shop profile</button></SellerPanel> : profile.data && <SellerProfileForm key={`${auth.sessionId}:${profile.data.sellerId}`} profile={profile.data} />}
    <div className="flex items-start gap-3 rounded-sm border border-border bg-muted p-4 text-sm"><ShieldCheck className="mt-0.5 shrink-0 text-info" size={18} aria-hidden="true" /><p>Completed orders are paid automatically to your verified default account. Changing bank details requires verification again.</p></div>
    {accounts.isSuccess && defaultAccount?.verificationStatus !== "VERIFIED" && <p role="status" className="rounded-sm border border-warning/30 bg-warning/5 p-4 text-sm text-warning">Payouts stay ON_HOLD until you have an active, verified default bank account. They resume automatically after verification.</p>}
    {notice && <p role="status" className="text-sm text-success">{notice}</p>}
    {editing && <BankAccountForm key={editing === "new" ? "new" : editing.id} account={editing === "new" ? undefined : editing} onClose={(saved) => { setEditing(null); if (saved) setNotice("Bank account saved. Verification is pending."); }} />}
    {defaultMutation.error && defaultMutation.error.kind !== "aborted" && <p role="alert" className="text-sm text-danger">{sellerAccountErrorMessage(defaultMutation.error)}</p>}
    {accounts.isPending ? <p role="status">Loading bank accounts…</p> : accounts.error ? <SellerPanel title="Bank accounts unavailable"><p role="alert" className="text-sm text-danger">{sellerAccountErrorMessage(accounts.error)}</p><button type="button" className={`${sellerButton} mt-4`} onClick={() => void accounts.refetch()}>Retry bank accounts</button></SellerPanel> : accounts.data?.length ? <div className="grid gap-4 xl:grid-cols-2">{accounts.data.map((account) => <SellerPanel key={account.id}><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-sm bg-muted"><Building2 size={21} aria-hidden="true" /></span><div><h2 className="text-sm font-semibold">Bank {account.bankCode}</h2><p className="mt-1 text-xs text-muted-foreground">{account.isDefault && account.active ? "Default receiving account" : account.active ? "Active account" : "Inactive account"}</p></div></div><span className={`rounded-full px-3 py-1 text-xs ${account.verificationStatus === "VERIFIED" ? "bg-success/10 text-success" : account.verificationStatus === "REJECTED" ? "bg-danger/10 text-danger" : "bg-warning/10 text-warning"}`}>{account.verificationStatus}</span></div><p className="mt-6 font-mono text-heading-24 tracking-wide">{maskedSellerBankAccount(account)}</p><p className="mt-3 break-words text-sm text-muted-foreground">{account.accountHolderName}</p><div className="mt-5 flex flex-wrap gap-2"><button type="button" className={sellerButton} disabled={!account.active || defaultMutation.isPending} onClick={() => { setEditing(account); setNotice(""); }}>Edit bank account</button><button type="button" className={sellerButton} disabled={!account.active || account.isDefault || defaultMutation.isPending} onClick={() => {
      if (pending.current) return; setNotice(""); const controller = new AbortController(); pending.current = controller;
      defaultMutation.mutate({ id: account.id, sessionId: auth.sessionId, controller });
    }}>{account.isDefault ? "Default account" : "Set as default"}</button></div></SellerPanel>)}</div> : <SellerPanel><div className="py-8 text-center"><Building2 className="mx-auto text-muted-foreground" size={32} aria-hidden="true" /><h2 className="mt-4 text-heading-20">No bank accounts yet</h2><p className="mt-2 text-sm text-muted-foreground">Add a bank account, set it as default and wait for verification to receive automatic payouts.</p></div></SellerPanel>}
  </>;
}

export default SellerBankAccountsPage;
