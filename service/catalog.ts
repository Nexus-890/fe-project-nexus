import { API_BASE_URL } from "../configs/api";
import { createApiClient, createInvalidResponseError } from "../lib/api-client";
import type { ApiResult, Page } from "../types/common/response/type";
import type { CategoryNode, ProductSummary } from "../types/catalog/response/type";
import type { ProductFilters } from "../types/catalog/request/type";
import type { ApiClient } from "../types/api/type";
import { isCategoryTree, isProductPage } from "../lib/catalog-validation";

const CATEGORY_TREE_PATH = "/api/v1/categories/tree";
const PRODUCTS_PATH = "/api/v1/products";

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

  async function getCategoryTree(signal?: AbortSignal): Promise<ApiResult<CategoryNode[]>> {
    return validate(await client.get<unknown>(CATEGORY_TREE_PATH, { signal, auth: false }), isCategoryTree);
  }

  async function getProducts(filters: ProductFilters = {}, signal?: AbortSignal): Promise<ApiResult<Page<ProductSummary>>> {
    return validate(await client.get<unknown>(PRODUCTS_PATH, {
      params: { ...filters },
      signal,
      auth: false,
    }), isProductPage);
  }

  return { getCategoryTree, getProducts };
}

const defaultCatalogService = createCatalogService();
export const getCategoryTree = defaultCatalogService.getCategoryTree;
export const getProducts = defaultCatalogService.getProducts;
