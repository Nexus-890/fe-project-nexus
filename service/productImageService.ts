import { createInvalidResponseError, isRecord, requestApi } from "../configs/api";
import type { ServiceRequestOptions } from "../types/commonRequestType";
import type { ProductImage } from "../types/catalogResponseType";

/** Multipart goes to the catalog API; Storage credentials stay on the backend. */
export const uploadProductImage = async (
  productId: string,
  file: File,
  options: ServiceRequestOptions = {},
): Promise<ProductImage> => {
  const body = new FormData();
  body.append("file", file);
  const { data } = await requestApi<unknown>("POST", `/api/v1/products/${encodeURIComponent(productId)}/images`, body, { ...options, auth: true });
  if (!isRecord(data) || typeof data.id !== "string" || typeof data.imageUrl !== "string" || !Number.isSafeInteger(data.sortOrder))
    throw createInvalidResponseError("Invalid uploaded product image");
  let url: URL;
  try { url = new URL(data.imageUrl); } catch { throw createInvalidResponseError("Invalid uploaded image URL"); }
  if (!["https:", "http:"].includes(url.protocol)) throw createInvalidResponseError("Invalid uploaded image URL");
  return { id: data.id, imageUrl: data.imageUrl, sortOrder: Number(data.sortOrder) };
};
