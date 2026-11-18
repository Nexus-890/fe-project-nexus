import { sellerSalesDates } from "./sellerSalesFilters";
import { bankReferencePattern, isUuid } from "../service/manualPayoutService";
import { disputeReviewActions, evidenceContentTypes, manualResolutionOutcomes, maxEvidenceBytes, maxEvidenceFiles,
  type DisputeReviewInput, type ManualCase, type ManualConfirmationInput, type ManualPayoutFilters, type ManualProblemInput, type ManualResolutionInput, type ManualResolutionOutcome } from "../types/manualPayoutType";
import { disputeReasons, receiptStatuses, type ReceiptDisputeInput } from "../types/payoutReceiptType";
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

export type TransferFacts = { sourceAccountId: string; amount: string; reference: string; transferredAt: string };
export const emptyTransferFacts: TransferFacts = { sourceAccountId: "", amount: "", reference: "", transferredAt: "" };
const parseTransferFacts = (form: TransferFacts, netAmount: string, sourceIds: readonly string[], serverNow: number, issuedAt: string | null): Result<Omit<ManualConfirmationInput, "evidenceIds">> => {
  const transferredAt = offsetLocal(form.transferredAt);
  const reference = form.reference.trim();
  if (!sourceIds.includes(form.sourceAccountId)) return failure("Choose the platform source account the transfer was sent from.");
  if (!/^\d{1,17}\.\d{2}$/.test(form.amount)) return failure("Enter the transferred amount exactly with two decimals, for example 95000.00.");
  if (form.amount !== netAmount) return failure(`The transferred amount must equal the frozen net amount ${netAmount}. Report a problem instead if a different amount was sent.`);
  if (!bankReferencePattern.test(reference)) return failure("Enter the bank transfer reference from the banking app (up to 120 letters, digits, dot, slash, dash or underscore).");
  if (!transferredAt || !Number.isFinite(Date.parse(transferredAt))) return failure("Enter when the transfer was made.");
  if (Date.parse(transferredAt) > serverNow + 60_000) return failure("The transfer time cannot be in the future.");
  const issued = issuedAt ? Date.parse(issuedAt) : Number.NaN;
  const issuedMinute = issued - issued % 60_000;
  if (Number.isFinite(issued) && Date.parse(transferredAt) < issuedMinute) return failure("The transfer time cannot be before the QR was issued.");
  const sent = Number.isFinite(issued) && Date.parse(transferredAt) < issued ? Math.min(issuedMinute + 59_999, serverNow + 30_000) : Date.parse(transferredAt);
  return success({ sourceAccountId: form.sourceAccountId, amount: form.amount, bankTransferReference: reference, transferredAt: new Date(sent).toISOString() });
};

export type ConfirmationForm = TransferFacts & { evidenceIds: string[]; attested: boolean };
export const parseConfirmationForm = (form: ConfirmationForm, netAmount: string, sourceIds: readonly string[], serverNow: number, issuedAt: string | null = null): Result<ManualConfirmationInput> => {
  const facts = parseTransferFacts(form, netAmount, sourceIds, serverNow, issuedAt);
  if (!facts.ok) return failure(facts.error);
  if (form.evidenceIds.length < 1 || form.evidenceIds.length > maxEvidenceFiles) return failure("Attach 1-3 evidence files uploaded for this attempt.");
  if (!form.attested) return failure("Confirm that you checked the recipient and the amount in the banking app.");
  return success({ ...facts.value, evidenceIds: [...form.evidenceIds] });
};

export const parseProblemForm = (reason: string, evidenceIds: string[]): Result<ManualProblemInput> => {
  const text = reasonText(reason, "An explanation");
  if (!text.ok) return failure(text.error);
  if (evidenceIds.length > maxEvidenceFiles) return failure("Choose at most 3 evidence files.");
  return success({ reason: text.value, evidenceIds: [...evidenceIds] });
};

export const resolutionOutcomes = (attemptState: string | undefined, payoutStatus: PayoutStatus, selected: ManualCase | null): ManualResolutionOutcome[] =>
  attemptState === "UNKNOWN" ? ["CONFIRMED_SENT", "CONFIRMED_NOT_SENT"] :
  attemptState === "SUCCEEDED" && payoutStatus === "SUCCEEDED" ? [...(selected?.kind === "STAFF_EXCEPTION" ? ["CONFIRMED_SENT" as const] : []), "CONFIRMED_RETURNED", "CONFIRMATION_RECORDED_IN_ERROR"] : [];
export const resolutionNeedsFacts = (outcome: string, attemptState: string | undefined) => outcome === "CONFIRMED_SENT" && attemptState === "UNKNOWN";

export type ResolutionForm = { caseId: string; outcome: string; reason: string; evidenceIds: string[]; facts: TransferFacts };
export const parseResolutionForm = (form: ResolutionForm, context: { attemptState: string | undefined; payoutStatus: PayoutStatus; openCases: readonly ManualCase[]; netAmount: string; sourceIds: readonly string[]; serverNow: number; issuedAt?: string | null }): Result<ManualResolutionInput> => {
  const selected = context.openCases.find((entry) => entry.id === form.caseId) ?? null;
  if (!selected) return failure("Choose the open case this outcome resolves.");
  if (!manualResolutionOutcomes.some((entry) => entry === form.outcome) || !resolutionOutcomes(context.attemptState, context.payoutStatus, selected).some((entry) => entry === form.outcome))
    return failure("Choose an outcome that fits this attempt.");
  const outcome = form.outcome as ManualResolutionOutcome;
  const text = reasonText(form.reason, "A reconciliation reason");
  if (!text.ok) return failure(text.error);
  if (form.evidenceIds.length < 1 || form.evidenceIds.length > maxEvidenceFiles) return failure("Attach 1-3 proof files from this attempt.");
  const base = { caseId: selected.id, expectedCaseVersion: selected.version, outcome, reason: text.value, evidenceIds: [...form.evidenceIds] };
  if (!resolutionNeedsFacts(outcome, context.attemptState)) return success(base);
  const facts = parseTransferFacts(form.facts, context.netAmount, context.sourceIds, context.serverNow, context.issuedAt ?? null);
  return facts.ok ? success({ ...base, ...facts.value }) : failure(facts.error);
};

export const parseReviewForm = (action: string, reason: string, evidenceIds: string[], dispute: ManualCase): Result<DisputeReviewInput> => {
  if (!disputeReviewActions.some((entry) => entry === action)) return failure("Choose a review decision.");
  const text = reasonText(reason, "A review note");
  if (!text.ok) return failure(text.error);
  if (action === "TRANSFER_EVIDENCE_PROVIDED" && evidenceIds.length < 1) return failure("Attach the transfer evidence you are pointing the seller to.");
  if (evidenceIds.length > maxEvidenceFiles) return failure("Choose at most 3 evidence files.");
  return success({ action: action as DisputeReviewInput["action"], reason: text.value, evidenceIds: [...evidenceIds], expectedCaseVersion: dispute.version });
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

const evidenceKinds: Record<string, string> = { "image/jpeg": "JPEG", "image/png": "PNG", "application/pdf": "PDF" };
export const attemptOwner = (payout: { status: string; currentAttempt: { claimedBy: string } | null }) =>
  payout.currentAttempt && !["PENDING", "ON_HOLD"].includes(payout.status) ? payout.currentAttempt.claimedBy : null;
export const qrIssuedAt = (payout: { history: readonly { event: string; attemptId: string | null; occurredAt: string }[] }, attemptId: string | undefined) =>
  [...payout.history].reverse().find((entry) => entry.event === "QR_ISSUED" && entry.attemptId === attemptId)?.occurredAt ?? null;
export const evidenceLabel = (file: { contentType: string; size: number }, index: number) => `Evidence ${index + 1} · ${evidenceKinds[file.contentType] ?? file.contentType} · ${(file.size / 1024).toFixed(1)} KiB`;
export const evidenceFileName = (file: { id: string; contentType: string }) => `payout-evidence-${file.id.slice(0, 8)}.${file.contentType === "application/pdf" ? "pdf" : file.contentType === "image/png" ? "png" : "jpg"}`;
