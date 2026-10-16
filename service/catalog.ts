import { API_BASE_URL } from "../configs/api";
import { createApiClient, createInvalidResponseError } from "../lib/api-client";
import type { ApiResult, Page } from "../types/common/response/type";
import type { CategoryNode, ProductDetail, ProductSummary } from "../types/catalog/response/type";
import type { ProductFilters } from "../types/catalog/request/type";
import type { ApiClient } from "../types/api/type";
import { isCategoryTree, parseProductDetail, parseProductPage } from "../lib/catalog-validation";
import { getMockProductDetail, USE_PRODUCT_DETAIL_MOCK } from "../mocks/product-detail";

const CATEGORY_TREE_PATH = "/api/v1/categories/tree";
const PRODUCTS_PATH = "/api/v1/products";
const PRODUCT_DETAIL_PATH = (productId: string) => `${PRODUCTS_PATH}/${encodeURIComponent(productId)}`;

export interface CatalogServiceOptions {
  /** Allows transport tests and local emulators to provide their own client. */
  client?: ApiClient;
}

function validate<T>(result: ApiResult<unknown>, guard: (value: unknown) => value is T): ApiResult<T> {
  if (!result.ok) return result;
  return guard(result.data) ? { ok: true, data: result.data }
    : { ok: false, error: createInvalidResponseError("Catalog response does not match the expected contract") };
}

export function createCatalogService(options: CatalogServiceOptions = {}) {
  const client = options.client ?? createApiClient({ baseUrl: API_BASE_URL });
  const useProductMock = !options.client && USE_PRODUCT_DETAIL_MOCK;

  async function getCategoryTree(signal?: AbortSignal): Promise<ApiResult<CategoryNode[]>> {
    return validate(await client.get<unknown>(CATEGORY_TREE_PATH, { signal, auth: false }), isCategoryTree);
  }

  async function getProducts(filters: ProductFilters = {}, signal?: AbortSignal): Promise<ApiResult<Page<ProductSummary>>> {
    const result = await client.get<unknown>(PRODUCTS_PATH, {
      params: { ...filters },
      signal,
      auth: false,
    });
    if (!result.ok) return result;
    const data = parseProductPage(result.data);
    return data ? { ok: true, data } : {
      ok: false,
      error: createInvalidResponseError("Catalog response does not match the expected contract"),
    };
  }

  async function getProduct(productId: string, signal?: AbortSignal): Promise<ApiResult<ProductDetail>> {
    if (!productId.trim()) {
      return { ok: false, error: createInvalidResponseError("Product id is required") };
    }
    // MOCK START: comment/remove this branch when the catalog API is available.
    if (useProductMock) return { ok: true, data: getMockProductDetail(productId) };
    // MOCK END: the real GET below already matches the BE contract.

    const result = await client.get<unknown>(PRODUCT_DETAIL_PATH(productId), {
      signal,
      auth: false,
    });
    if (!result.ok) return result;
    const data = parseProductDetail(result.data);
    return data ? { ok: true, data } : {
      ok: false,
      error: createInvalidResponseError("Product detail response does not match the expected contract"),
    };
  }

  return { getCategoryTree, getProducts, getProduct };
}

const defaultCatalogService = createCatalogService();
export const getCategoryTree = defaultCatalogService.getCategoryTree;
export const getProducts = defaultCatalogService.getProducts;
export const getProduct = defaultCatalogService.getProduct;
