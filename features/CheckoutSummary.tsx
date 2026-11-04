"use client";

import OrderSummary, { CheckoutItem, type OrderSummaryProps } from "../components/OrderSummary";
import { queryKeys } from "../configs/queryKeys";
import { useApiQuery } from "../hooks/useApi";
import { getProduct } from "../service/catalogService";
import type { CartItem } from "../types/cartResponseType";

function CheckoutItemWithDetails({ item }: { item: CartItem }) {
  const product = useApiQuery({
    queryKey: queryKeys.catalog.product(item.productId),
    service: (signal) => getProduct(item.productId, { signal }),
  }, { staleTime: 60_000, retry: false });
  return <CheckoutItem item={item} product={product.data} />;
}

function CheckoutSummary(props: OrderSummaryProps) {
  return <OrderSummary {...props}>{props.items.map((item) => <CheckoutItemWithDetails key={item.id} item={item} />)}</OrderSummary>;
}

export default CheckoutSummary;
