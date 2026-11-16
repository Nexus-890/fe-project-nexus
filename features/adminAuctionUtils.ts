import { z } from "zod";
import { AUCTION_CANCEL_REASON_LIMIT } from "../service/auctionService";
import type { AuctionRoom, AuctionStatus } from "../types/auctionRoomType";

export const auctionStatusLabels: Record<AuctionStatus, string> = {
  CREATED: "Draft", SCHEDULED: "Scheduled", ACTIVE: "Active", ENDED: "Ended", WON: "Won",
  SETTLED: "Settled", FAILED: "Failed", PAYMENT_TIMEOUT: "Payment timeout", CANCELLED: "Cancelled",
};
export const auctionStatusTabs: readonly AuctionStatus[] = ["CREATED", "SCHEDULED", "ACTIVE", "ENDED", "SETTLED", "PAYMENT_TIMEOUT", "CANCELLED"];
export const isAuctionEditable = (status: AuctionStatus) => status === "CREATED" || status === "SCHEDULED";
export const isAuctionCancellable = (status: AuctionStatus) => ["CREATED", "SCHEDULED", "ACTIVE", "ENDED", "WON"].includes(status);

const vietnamTime = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" });
const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000;
export const formatVietnamTime = (instant: string) => vietnamTime.format(new Date(instant));
export const toVietnamInput = (instant: string) => new Date(Date.parse(instant) + VIETNAM_OFFSET_MS).toISOString().slice(0, 16);

const amount = (label: string) => z.string().trim()
  .regex(/^\d+(?:\.\d{1,2})?$/, `Enter the ${label} as a number with up to two decimals.`)
  .refine((value) => Number(value) > 0, `The ${label} must be greater than zero.`);
const vietnamInput = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Choose a date and time.")
  .transform((value, context) => {
    const time = Date.parse(`${value}:00+07:00`);
    if (Number.isNaN(time)) {
      context.addIssue({ code: "custom", message: "Choose a date and time." });
      return z.NEVER;
    }
    return new Date(time).toISOString();
  });

export const auctionUpdateSchema = z.object({
  startingPrice: amount("starting price"), bidIncrement: amount("bid increment"), startAt: vietnamInput, endAt: vietnamInput,
}).refine((value) => Date.parse(value.endAt) > Date.parse(value.startAt), { path: ["endAt"], message: "The end must be after the start." });
export type AuctionUpdateFormValues = z.input<typeof auctionUpdateSchema>;

export const toAuctionUpdateValues = (auction: AuctionRoom): AuctionUpdateFormValues => ({
  startingPrice: auction.startingPrice, bidIncrement: auction.bidIncrement,
  startAt: toVietnamInput(auction.startAt), endAt: toVietnamInput(auction.endAt),
});

export const auctionCancelReasonSchema = z.string().trim().min(1, "Enter a cancellation reason.")
  .refine((value) => [...value].length <= AUCTION_CANCEL_REASON_LIMIT, `Use ${AUCTION_CANCEL_REASON_LIMIT} characters or fewer.`);
