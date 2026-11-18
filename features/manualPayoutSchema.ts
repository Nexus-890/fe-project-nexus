import { sellerSalesDates } from "./sellerSalesFilters";
import { isUuid } from "../service/manualPayoutService";
import { evidenceContentTypes, manualProblemKinds, manualResolutionOutcomes, disputeReviewDecisions, maxEvidenceBytes, maxEvidenceFiles,
  type DisputeReviewInput, type ManualConfirmationInput, type ManualPayoutFilters, type ManualProblemInput, type ManualResolutionInput } from "../types/manualPayoutType";
import { disputeReasons, receiptStatuses, unresolvedDisputeStatuses, type ReceiptDispute, type ReceiptDisputeInput } from "../types/payoutReceiptType";
import { payoutStatuses, type PayoutStatus } from "../types/payoutType";

type Result<T> = { ok: true; value: T } | { ok: false; error: string };
const success = <T>(value: T): Result<T> => ({ ok: true, value });
const failure = <T>(error: string): Result<T> => ({ ok: false, error });

export const manualQueueViews = [
  { id: "REVIEW", label: "Needs review", filters: { needsReview: true } },
  { id: "READY", label: "Ready to claim", filters: { status: ["PENDING"] } },
  { id: "MINE", label: "Claimed by me", filters: { claimedBy: "me" } },
  { id: "HELD", label: "On hold", filters: { status: ["ON_HOLD"] } },
  { id: "DISPUTES", label: "Seller disputes", filters: { hasOpenDispute: true } },
  { id: "ALL", label: "All manual payouts", filters: {} },
] as const satisfies readonly { id: string; label: string; filters: ManualPayoutFilters }[];
export type ManualQueueView = typeof manualQueueViews[number]["id"];

export type ManualQueueForm = { sellerId: string; from: string; to: string; statuses: PayoutStatus[]; receiptStatus: string };
export const emptyQueueForm: ManualQueueForm = { sellerId: "", from: "", to: "", statuses: [], receiptStatus: "" };

export const parseQueueForm = (form: ManualQueueForm): Result<ManualPayoutFilters> => {
  const range = sellerSalesDates(form.from, form.to);
  const sellerId = form.sellerId.trim();
  if (!range) return failure("Enter a valid date range; the start date cannot be after the end date.");
  if (sellerId && !isUuid(sellerId)) return failure("Seller must be a full seller UUID.");
  if (form.statuses.some((status) => !payoutStatuses.includes(status)) || new Set(form.statuses).size !== form.statuses.length) return failure("Choose each payout status once.");
  if (form.receiptStatus && !receiptStatuses.some((status) => status === form.receiptStatus)) return failure("Choose a valid seller receipt state.");
  return success({ ...range, ...(sellerId ? { sellerId } : {}), ...(form.statuses.length ? { status: form.statuses } : {}),
    ...(form.receiptStatus ? { receiptStatus: form.receiptStatus as ManualPayoutFilters["receiptStatus"] } : {}) });
};

export const combineQueueFilters = (view: ManualQueueView, applied: ManualPayoutFilters, page: number): ManualPayoutFilters => {
  const preset: ManualPayoutFilters = manualQueueViews.find((entry) => entry.id === view)?.filters ?? {};
  const status = applied.status?.length ? applied.status : preset.status;
  return { ...preset, ...applied, ...(status ? { status } : {}), page, size: 20 };
};

export const evidenceFileError = (file: File, alreadyAttached: number): string | null => {
  if (alreadyAttached >= maxEvidenceFiles) return `An attempt can hold at most ${maxEvidenceFiles} evidence files.`;
  if (!evidenceContentTypes.some((type) => type === file.type)) return `${file.name} is not a JPEG, PNG or PDF file.`;
  if (file.size < 1) return `${file.name} is empty.`;
  if (file.size > maxEvidenceBytes) return `${file.name} is larger than 10 MiB.`;
  return null;
};

const offsetLocal = (value: string) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ? `${value}:00+07:00` : null;
const reasonText = (value: string, label: string): Result<string> => {
  const trimmed = value.trim();
  return !trimmed ? failure(`${label} is required.`) : trimmed.length > 1000 ? failure(`${label} must be 1000 characters or fewer.`) : success(trimmed);
};

export type ConfirmationForm = { sourceAccountId: string; amount: string; reference: string; transferredAt: string; evidenceIds: string[]; attested: boolean };
export const parseConfirmationForm = (form: ConfirmationForm, netAmount: string, sourceIds: readonly string[], serverNow: number): Result<ManualConfirmationInput> => {
  const transferredAt = offsetLocal(form.transferredAt);
  const reference = form.reference.trim();
  if (!sourceIds.includes(form.sourceAccountId)) return failure("Choose the platform source account the transfer was sent from.");
  if (!/^\d{1,17}\.\d{2}$/.test(form.amount)) return failure("Enter the transferred amount exactly with two decimals, for example 95000.00.");
  if (form.amount !== netAmount) return failure(`The transferred amount must equal the frozen net amount ${netAmount}. Report a problem instead if a different amount was sent.`);
  if (!/^[A-Za-z0-9._-]{4,64}$/.test(reference)) return failure("Enter the bank transfer reference from the banking app (4-64 letters, digits, dot, dash or underscore).");
  if (!transferredAt || !Number.isFinite(Date.parse(transferredAt))) return failure("Enter when the transfer was made.");
  if (Date.parse(transferredAt) > serverNow + 60_000) return failure("The transfer time cannot be in the future.");
  if (form.evidenceIds.length < 1 || form.evidenceIds.length > maxEvidenceFiles) return failure("Attach 1-3 evidence files uploaded for this attempt.");
  if (!form.attested) return failure("Confirm that you checked the recipient and the amount in the banking app.");
  return success({ sourceAccountId: form.sourceAccountId, amount: form.amount, bankTransferReference: reference, transferredAt: new Date(transferredAt).toISOString(), evidenceIds: [...form.evidenceIds] });
};

export const parseProblemForm = (kind: string, reason: string, evidenceIds: string[]): Result<ManualProblemInput> => {
  if (!manualProblemKinds.some((entry) => entry === kind)) return failure("Choose what went wrong.");
  const text = reasonText(reason, "An explanation");
  return text.ok ? success({ kind: kind as ManualProblemInput["kind"], reason: text.value, evidenceIds: [...evidenceIds] }) : failure(text.error);
};

export const resolutionNeedsProof = (outcome: string) => outcome !== "" && outcome !== "CONFIRMED_SENT";
export const parseResolutionForm = (outcome: string, reason: string, evidenceIds: string[], dispute: ReceiptDispute | null): Result<ManualResolutionInput> => {
  if (!manualResolutionOutcomes.some((entry) => entry === outcome)) return failure("Choose the reconciled outcome.");
  const text = reasonText(reason, "A reconciliation reason");
  if (!text.ok) return failure(text.error);
  if (resolutionNeedsProof(outcome) && !evidenceIds.length) return failure("This outcome needs proof attached to the attempt.");
  if (outcome === "CONFIRMATION_RECORDED_IN_ERROR") {
    if (!dispute || !unresolvedDisputeStatuses.some((status) => status === dispute.status)) return failure("A correction needs the seller's open case.");
    return success({ outcome, reason: text.value, evidenceIds: [...evidenceIds], disputeId: dispute.id, expectedDisputeVersion: dispute.version });
  }
  return success({ outcome: outcome as ManualResolutionInput["outcome"], reason: text.value, evidenceIds: [...evidenceIds] });
};

export const parseReviewForm = (decision: string, note: string, dispute: ReceiptDispute): Result<DisputeReviewInput> => {
  if (!disputeReviewDecisions.some((entry) => entry === decision)) return failure("Choose a review decision.");
  const text = reasonText(note, "A review note");
  return text.ok ? success({ decision: decision as DisputeReviewInput["decision"], note: text.value, expectedDisputeVersion: dispute.version }) : failure(text.error);
};

export const parseRetryForm = (reason: string): Result<{ reason: string }> => {
  const text = reasonText(reason, "A retry authorization reason");
  return text.ok ? success({ reason: text.value }) : failure(text.error);
};

export const parseSellerDisputeForm = (reason: string, explanation: string): Result<ReceiptDisputeInput> => {
  if (!disputeReasons.some((entry) => entry === reason)) return failure("Choose why you are requesting a review.");
  const text = reasonText(explanation, "An explanation");
  return text.ok ? success({ reason: reason as ReceiptDisputeInput["reason"], explanation: text.value }) : failure(text.error);
};

export const serverOffset = (serverTime: string, receivedAt: number) => Date.parse(serverTime) - receivedAt;
export const secondsUntil = (deadline: string | null, offset: number, now: number) => deadline === null ? null : Math.max(0, Math.floor((Date.parse(deadline) - (now + offset)) / 1000));
export const formatCountdown = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
