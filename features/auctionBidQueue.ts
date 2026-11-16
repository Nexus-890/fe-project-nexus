import { createCanceledError } from "../configs/api";
import { getAuctionBidStatus } from "../service/auctionService";
import type { AuctionBidResult } from "../types/auctionRoomType";
import type { ServiceRequestOptions } from "../types/commonRequestType";
import type { ApiError } from "../types/commonResponseType";

/** Dừng cả thời gian nghỉ khi rời trang/đổi tài khoản, không gửi thêm GET bằng phiên cũ. */
const pause = (milliseconds: number, signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
  if (signal?.aborted) { reject(createCanceledError()); return; }
  const finish = () => { signal?.removeEventListener("abort", abort); resolve(); };
  const timer = setTimeout(finish, milliseconds);
  const abort = () => { clearTimeout(timer); signal?.removeEventListener("abort", abort); reject(createCanceledError()); };
  signal?.addEventListener("abort", abort, { once: true });
});

/** Chờ kết quả thật; quá hạn giữ bidId/khóa cũ để nút retry tiếp tục kiểm tra cùng yêu cầu. */
export const waitForAuctionBidResult = async (
  auctionId: string, bidId: string, options: ServiceRequestOptions,
  polling: { timeoutMs: number; intervalMs: number } = { timeoutMs: 30_000, intervalMs: 250 },
): Promise<Exclude<AuctionBidResult, { status: "QUEUED" }>> => {
  const deadline = performance.now() + polling.timeoutMs;
  while (true) {
    if (options.signal?.aborted) throw createCanceledError();
    const remaining = deadline - performance.now();
    const result = await getAuctionBidStatus(auctionId, bidId, {
      ...options, config: { ...options.config, timeout: Math.max(1, Math.min(15_000, remaining)) },
    });
    if (result.status !== "QUEUED") return result;
    if (performance.now() >= deadline) throw {
      kind: "network", status: 0, title: "Bid is still being processed", code: "AUCTION_BID_PENDING",
      detail: "Your bid is still queued. Retry the same bid to check its result.",
    } satisfies ApiError;
    await pause(Math.min(polling.intervalMs, Math.max(0, deadline - performance.now())), options.signal);
  }
};
