"use client";

import { useEffect, useRef, useState } from "react";
import { queryKeys } from "../configs/queryKeys";
import { useAuth } from "../hooks/useAuth";
import { useApiMutation, useApiQuery } from "../hooks/useApi";
import { getAdminBankAccounts, maskedSellerBankAccount, sellerAccountErrorMessage, verifySellerBankAccount } from "../service/sellerBankService";
import { SellerPanel, sellerButton, sellerInput, sellerPrimary } from "../components/SellerUi";
import { readBackofficeRoles } from "./backofficeAccess";
import type { BankVerificationStatus, SellerBankAccount, VerifySellerBankAccountInput } from "../types/sellerBankType";

type VerificationOperation = { id: string; body: VerifySellerBankAccountInput; sessionId: number; controller: AbortController };

function AdminBankAccountsPanel() {
  const auth = useAuth();
  const isAdmin = auth.status === "authenticated" && readBackofficeRoles(auth.accessToken).includes("ADMIN");
  const [status, setStatus] = useState<BankVerificationStatus | "">("UNVERIFIED");
  const [sellerInput, setSellerInput] = useState("");
  const [sellerId, setSellerId] = useState<string | undefined>();
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<SellerBankAccount | null>(null);
  const [decision, setDecision] = useState<"VERIFIED" | "REJECTED">("VERIFIED");
  const [reason, setReason] = useState("");
  const [validation, setValidation] = useState("");
  const [notice, setNotice] = useState("");
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  const filters = { sellerId, verificationStatus: status || undefined, page, size: 10 };
  const result = useApiQuery({ queryKey: queryKeys.backoffice.bankAccounts(auth.sessionId, filters), meta: { requiresAuth: true },
    service: (signal) => getAdminBankAccounts(filters, { context: auth.requestContext, signal }) }, { enabled: isAdmin, retry: false });
  const mutation = useApiMutation<SellerBankAccount, VerificationOperation>({
    mutationKey: ["backoffice", auth.sessionId, "verify-bank-account"],
    execute: ({ id, body, controller }) => verifySellerBankAccount(id, body, { context: auth.requestContext, signal: controller.signal }),
    isCurrent: ({ sessionId, controller }) => auth.isSessionCurrent(sessionId) && !controller.signal.aborted,
    invalidateKey: [queryKeys.backoffice.bankAccounts(auth.sessionId), queryKeys.seller.bankAccounts(auth.sessionId), ["backoffice", auth.sessionId, "payouts"], queryKeys.seller.payouts(auth.sessionId)],
  }, { onSuccess: (account) => { setSelected(null); setReason(""); setValidation(""); setNotice(account.verificationStatus === "VERIFIED" ? "Bank account verified. Eligible held payouts will resume automatically." : "Bank account rejected."); },
    onError: async (error) => {
      if (error.status === 409) {
        setSelected(null); setReason(""); setNotice("");
        setValidation("Bank details changed since you opened this review. Review the updated account before submitting again.");
        await result.refetch();
      }
    },
    onSettled: (_data, _error, operation) => { if (pending.current === operation.controller) pending.current = null; } });
  if (!isAdmin) return null;
  return <SellerPanel title="Bank account verification">
    <p className="mb-5 text-sm text-muted-foreground">Review masked bank details. Verifying a seller’s default account releases eligible ON_HOLD payouts automatically.</p>
    <form className="mb-5 flex flex-wrap items-end gap-3" onSubmit={(event) => {
      event.preventDefault(); setValidation("");
      if (sellerInput.trim() && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sellerInput.trim())) { setValidation("Enter a valid seller UUID or leave it blank."); return; }
      setSellerId(sellerInput.trim() || undefined); setPage(0);
    }}><label className="grid min-w-0 gap-2 text-xs">Seller UUID<input value={sellerInput} onChange={(event) => setSellerInput(event.target.value)} className={sellerInputClass} /></label><label className="grid gap-2 text-xs">Verification status<select value={status} onChange={(event) => { setStatus(event.target.value as BankVerificationStatus | ""); setPage(0); }} className={sellerInputClass}><option value="UNVERIFIED">Unverified</option><option value="VERIFIED">Verified</option><option value="REJECTED">Rejected</option><option value="">All statuses</option></select></label><button type="submit" className={sellerButton}>Filter bank accounts</button></form>
    {validation && <p role="alert" className="mb-4 text-sm text-danger">{validation}</p>}{notice && <p role="status" className="mb-4 text-sm text-success">{notice}</p>}
    {selected && <form className="mb-5 space-y-4 rounded-sm border border-border p-4" onSubmit={(event) => {
      event.preventDefault(); if (pending.current) return;
      const controller = new AbortController(); pending.current = controller;
      mutation.mutate({ id: selected.id, body: { verificationStatus: decision, expectedVersion: selected.version,
        ...(reason.trim() ? { reason: reason.trim() } : {}) }, sessionId: auth.sessionId, controller });
    }}><p className="text-sm">Bank {selected.bankCode} · {maskedSellerBankAccount(selected)} · {selected.accountHolderName}</p><fieldset disabled={mutation.isPending} className="space-y-4"><label className="grid gap-2 text-sm">Verification decision<select value={decision} onChange={(event) => setDecision(event.target.value as "VERIFIED" | "REJECTED")} className={sellerInputClass}><option value="VERIFIED">Verify account</option><option value="REJECTED">Reject account</option></select></label><label className="grid gap-2 text-sm">Verification reason{decision === "REJECTED" ? " (required)" : " (optional)"}<textarea required={decision === "REJECTED"} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} className={`${sellerInputClass} min-h-24`} /></label><div className="flex flex-wrap gap-3"><button type="submit" className={sellerPrimary}>{mutation.isPending ? "Saving decision…" : "Confirm bank verification"}</button><button type="button" className={sellerButton} onClick={() => setSelected(null)}>Cancel verification</button></div></fieldset>{mutation.error && mutation.error.kind !== "aborted" && <p role="alert" className="text-sm text-danger">{sellerAccountErrorMessage(mutation.error)}</p>}</form>}
    {result.isPending ? <p role="status" className="text-sm">Loading bank verification queue…</p> : result.error ? <div><p role="alert" className="text-sm text-danger">{sellerAccountErrorMessage(result.error)}</p><button type="button" className={`${sellerButton} mt-3`} onClick={() => void result.refetch()}>Retry bank verification queue</button></div> : <><div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><caption className="sr-only">Bank accounts awaiting verification</caption><thead className="bg-muted text-xs text-muted-foreground"><tr>{["Seller", "Bank / account", "Account holder", "Status", "Action"].map((name) => <th key={name} scope="col" className="px-3 py-3 font-normal">{name}</th>)}</tr></thead><tbody>{result.data?.content.map((account) => <tr key={account.id} className="border-t border-border"><th scope="row" className="px-3 py-4 font-mono text-xs font-normal" title={account.sellerId}>{account.sellerId.slice(0, 8)}</th><td className="px-3 py-4 text-xs"><p>{account.bankCode}</p><p className="mt-1 font-mono">{maskedSellerBankAccount(account)}</p>{account.isDefault && <p className="mt-1 text-primary">Default</p>}</td><td className="max-w-48 break-words px-3 py-4">{account.accountHolderName}</td><td className="px-3 py-4 text-xs">{account.verificationStatus}</td><td className="px-3 py-4"><button type="button" className={sellerButton} disabled={!account.active || mutation.isPending} onClick={() => { setSelected(account); setDecision("VERIFIED"); setReason(""); setValidation(""); mutation.reset(); setNotice(""); }}>Review bank account</button></td></tr>)}</tbody></table>{!result.data?.content.length && <p role="status" className="py-8 text-center text-sm text-muted-foreground">No bank accounts match these filters.</p>}</div><nav aria-label="Bank verification pagination" className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm"><span>{result.data?.totalElements ?? 0} accounts · Page {page + 1}</span><div className="flex gap-2"><button type="button" className={sellerButton} disabled={page === 0 || result.isFetching} onClick={() => setPage((value) => value - 1)}>Previous bank accounts</button><button type="button" className={sellerButton} disabled={result.isFetching || page + 1 >= (result.data?.totalPages ?? 0)} onClick={() => setPage((value) => value + 1)}>Next bank accounts</button></div></nav></>}
  </SellerPanel>;
}

const sellerInputClass = sellerInput;
export default AdminBankAccountsPanel;
