import { formatAuctionMoney } from "../features/auctionRoomUtils";

function PriceDisplay({ amount, currency }: { amount: string; currency: string }) {
  return <span className="break-words text-[36px] font-semibold leading-tight tracking-tight text-primary sm:text-[44px]" data-testid="auction-current-price">{formatAuctionMoney(amount, currency)}</span>;
}

export default PriceDisplay;
