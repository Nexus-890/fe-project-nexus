"use client";

import { AdminError } from "../components/AdminPrimitives";
import CartSummary from "../components/CartSummary";
import { queryKeys } from "../configs/queryKeys";
import { useApiQuery } from "../hooks/useApi";
import { useAuth } from "../hooks/useAuth";
import { getVoucherPricing } from "../service/promotionService";
import VoucherPicker, { VoucherQuoteResults } from "./VoucherPicker";
import { useVoucherSelection } from "./useVoucherSelection";

function CartPromotionSummary({ quantity, subtotal, pending, cartSignature }: { quantity: number; subtotal: string; pending: boolean; cartSignature: string }) {
  const auth = useAuth(); const { codes } = useVoucherSelection();
  const pricing = useApiQuery({ queryKey: queryKeys.promotions.list(auth.sessionId, "cart-pricing", { codes, cartSignature }), meta: { requiresAuth: true }, service: (signal) => getVoucherPricing(codes, { context: auth.requestContext, signal }) }, { enabled: !pending, retry: false });
  const quote = !pending && !pricing.isFetching && !pricing.isError ? pricing.data : undefined;
  const blocked = pricing.isFetching || pricing.isError || !quote || quote.vouchers.some((v) => !v.applied);
  return <CartSummary quantity={quantity} subtotal={subtotal} pending={pending} checkoutBlocked={blocked} discountAmount={quote ? String(quote.discountAmount) : undefined} total={quote ? String(quote.total) : undefined}>
    <VoucherPicker disabled={pending} cartSignature={cartSignature} />
    <AdminError error={pricing.error} onRetry={() => void pricing.refetch()} />
    {quote && <VoucherQuoteResults quotes={quote.vouchers} />}
  </CartSummary>;
}
export default CartPromotionSummary;
