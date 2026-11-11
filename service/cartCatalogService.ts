import { getProduct } from "./catalogService";
import type { ProductDetail } from "../types/catalogResponseType";
import type { ServiceRequestOptions } from "../types/commonRequestType";

/** Catalog decoration is optional; it must never replace Cart snapshot prices. */
export const getCartProducts = async (productIds: string[], options: ServiceRequestOptions = {}): Promise<Record<string, ProductDetail>> => {
  const uniqueIds = [...new Set(productIds)];
  const results = await Promise.allSettled(uniqueIds.map((id) => getProduct(id, options)));
  options.signal?.throwIfAborted();
  return Object.fromEntries(results.flatMap((result, index) => result.status === "fulfilled" ? [[uniqueIds[index], result.value]] : []));
};
