"use client";

import { AdminError } from "../components/AdminPrimitives";
import CartSummary from "../components/CartSummary";
import { queryKeys } from "../configs/queryKeys";
import { useApiQuery } from "../hooks/useApi";
import { useAuth } from "../hooks/useAuth";
import { getVoucherPricing } from "../service/promotionService";
import VoucherPicker from "./VoucherPicker";
import { useVoucherSelection } from "./useVoucherSelection";

type CartPromotionSummaryProps = {
  quantity: number;
  subtotal: string;
  pending: boolean;
  cartSignature: string;
  stockBlocked?: boolean;
  checking?: boolean;
  checkoutLabel?: string;
  onCheckout?: () => void;
};

function CartPromotionSummary({ quantity, subtotal, pending, cartSignature, stockBlocked = false, checking, checkoutLabel, onCheckout }: CartPromotionSummaryProps) {
  const auth = useAuth(); const { codes } = useVoucherSelection();
  const pricing = useApiQuery({ queryKey: queryKeys.promotions.list(auth.sessionId, "cart-pricing", { codes, cartSignature }), meta: { requiresAuth: true }, service: (signal) => getVoucherPricing(codes, { context: auth.requestContext, signal }) }, { enabled: !pending, retry: false });
  const quote = !pending && !pricing.isFetching && !pricing.isError ? pricing.data : undefined;
  const blocked = stockBlocked || pricing.isFetching || pricing.isError || !quote || quote.vouchers.some((v) => !v.applied);
  return <CartSummary quantity={quantity} subtotal={subtotal} pending={pending} checkoutBlocked={blocked} checking={checking} checkoutLabel={checkoutLabel} onCheckout={onCheckout} discountAmount={quote ? String(quote.discountAmount) : undefined} total={quote ? String(quote.total) : undefined}>
    <VoucherPicker disabled={pending} cartSignature={cartSignature} />
    <AdminError error={pricing.error} onRetry={() => void pricing.refetch()} />
  </CartSummary>;
}
export default CartPromotionSummary;
