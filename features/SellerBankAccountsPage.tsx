"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Building2, Plus, ShieldCheck } from "lucide-react";
import { queryKeys } from "../configs/queryKeys";
import { useAuth } from "../hooks/useAuth";
import { useApiMutation, useApiQuery } from "../hooks/useApi";
import { addSellerBankAccount, getSellerBankAccounts, maskedBankAccount, payoutErrorMessage } from "../service/payoutService";
import { SellerHeading, SellerPanel, sellerButton, sellerInput, sellerPrimary } from "../components/SellerUi";
import { readBackofficeRoles } from "./backofficeAccess";
import type { SellerBankAccount, SellerBankAccountInput } from "../types/payoutType";

type BankOperation = { body: SellerBankAccountInput; sessionId: number; controller: AbortController };

function SellerBankAccountsPage() {
  const auth = useAuth();
  const isSeller = auth.status === "authenticated" && readBackofficeRoles(auth.accessToken).includes("SELLER");
  const [open, setOpen] = useState(false);
  const [bankCode, setBankCode] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [saved, setSaved] = useState(false);
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);
  const accounts = useApiQuery({ queryKey: queryKeys.seller.bankAccounts(auth.sessionId), meta: { requiresAuth: true },
    service: (signal) => getSellerBankAccounts({ context: auth.requestContext, signal }) }, { enabled: isSeller, retry: false });
  const mutation = useApiMutation<SellerBankAccount, BankOperation>({
    mutationKey: ["seller", auth.sessionId, "add-bank-account"],
    execute: ({ body, controller }) => addSellerBankAccount(body, { context: auth.requestContext, signal: controller.signal }),
    isCurrent: ({ sessionId, controller }) => auth.isSessionCurrent(sessionId) && !controller.signal.aborted,
    invalidateKey: [queryKeys.seller.bankAccounts(auth.sessionId)],
  }, {
    onSuccess: () => { setAccountNumber(""); setBankCode(""); setBankName(""); setAccountHolder(""); setOpen(false); setSaved(true); },
    onSettled: (_data, _error, operation) => { operation.body.accountNumber = ""; if (active.current === operation.controller) active.current = null; },
  });

  if (!isSeller) return <SellerPanel title="403 · Seller access required"><p className="text-sm text-muted-foreground">Bank accounts belong to the signed-in seller.</p></SellerPanel>;

  return <>
    <SellerHeading title="Bank accounts" description="Manage the accounts used to receive your sales payouts."><button type="button" className={sellerPrimary} onClick={() => { setOpen(true); setSaved(false); mutation.reset(); }}><Plus size={16} aria-hidden="true" />Add bank account</button></SellerHeading>
    <SellerPanel title="Seller profile"><div className="flex flex-wrap items-center justify-between gap-4"><div className="min-w-0"><p className="break-words text-sm font-medium">{auth.user?.fullName}</p><p className="mt-1 break-words text-sm text-muted-foreground">{auth.user?.email}</p>{auth.user?.phone && <p className="mt-1 text-sm text-muted-foreground">{auth.user.phone}</p>}</div><Link href="/profile" className={sellerButton}>Edit profile</Link></div></SellerPanel>
    <div className="flex items-start gap-3 rounded-sm border border-border bg-muted p-4 text-sm"><ShieldCheck className="mt-0.5 shrink-0 text-info" size={18} aria-hidden="true" /><p>Only the last four digits are shown after an account is saved. Payouts require a verified bank account.</p></div>
    {saved && <p role="status" className="text-sm text-success">Bank account added. Verification is pending.</p>}
    {open && <SellerPanel title="Add bank account"><form className="max-w-2xl space-y-5" onSubmit={(event) => {
      event.preventDefault(); if (active.current) return;
      const controller = new AbortController(); active.current = controller;
      mutation.mutate({ body: { bankCode, bankName, accountHolder, accountNumber }, sessionId: auth.sessionId, controller });
    }}><fieldset disabled={mutation.isPending} className="grid gap-5 sm:grid-cols-2">
      <label className="text-sm">Bank name<input required maxLength={100} value={bankName} onChange={(event) => setBankName(event.target.value)} className={`${sellerInput} mt-2`} placeholder="e.g. Vietcombank" /></label>
      <label className="text-sm">Bank code<input required maxLength={32} pattern="[A-Za-z0-9_\-]+" value={bankCode} onChange={(event) => setBankCode(event.target.value)} className={`${sellerInput} mt-2`} placeholder="e.g. VCB" /></label>
      <label className="text-sm">Account holder<input required maxLength={100} value={accountHolder} onChange={(event) => setAccountHolder(event.target.value)} className={`${sellerInput} mt-2`} autoComplete="off" placeholder="Full name on the bank account" /></label>
      <label className="text-sm">Account number<input required type="password" inputMode="numeric" autoComplete="off" minLength={6} maxLength={34} pattern="[0-9]{6,34}" value={accountNumber} onChange={(event) => setAccountNumber(event.target.value)} className={`${sellerInput} mt-2`} /></label>
      <div className="flex flex-wrap gap-3 sm:col-span-2"><button type="submit" className={sellerPrimary}>{mutation.isPending ? "Saving account…" : "Save bank account"}</button><button type="button" className={sellerButton} onClick={() => { setOpen(false); setAccountNumber(""); mutation.reset(); }}>Cancel</button></div>
    </fieldset>{mutation.error && mutation.error.kind !== "aborted" && <p role="alert" className="text-sm text-danger">{payoutErrorMessage(mutation.error)}</p>}</form></SellerPanel>}
    {accounts.isPending ? <p role="status">Loading bank accounts…</p> : accounts.error ? <SellerPanel title="Bank accounts unavailable"><p role="alert" className="text-sm text-danger">{payoutErrorMessage(accounts.error)}</p><button type="button" className={`${sellerButton} mt-4`} onClick={() => void accounts.refetch()}>Retry bank accounts</button></SellerPanel> : accounts.data?.length ? <div className="grid gap-4 xl:grid-cols-2">{accounts.data.map((account) => <SellerPanel key={account.id}><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-sm bg-muted"><Building2 size={21} aria-hidden="true" /></span><div className="min-w-0"><h2 className="break-words text-sm font-semibold">{account.bankName}</h2><p className="mt-1 break-words text-xs text-muted-foreground">{account.bankCode}</p></div></div><span className={`shrink-0 rounded-full px-3 py-1 text-xs ${account.verified ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>{account.verified ? "Verified" : "Pending verification"}</span></div><p className="mt-6 font-mono text-heading-24 tracking-wide">{maskedBankAccount(account)}</p><p className="mt-3 break-words text-sm text-muted-foreground">{account.accountHolder}</p></SellerPanel>)}</div> : <SellerPanel><div className="py-8 text-center"><Building2 className="mx-auto text-muted-foreground" size={32} aria-hidden="true" /><h2 className="mt-4 text-heading-20">No bank accounts yet</h2><p className="mt-2 text-sm text-muted-foreground">Add a bank account to receive payouts for completed orders.</p></div></SellerPanel>}
  </>;
}

export default SellerBankAccountsPage;
