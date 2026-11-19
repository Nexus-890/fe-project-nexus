import { createInvalidResponseError, isRecord, requestApi } from "../configs/api";
import type { ServiceRequestOptions } from "../types/commonRequestType";
import type { AdminCategory, CategoryInput, CategoryPatch, Warehouse, WarehouseInput, WarehouseUpdate, StockMovement } from "../types/adminCatalogType";
import type { ApiResponse, Page } from "../types/commonResponseType";

export const isAdminUuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const nullableString = (value: unknown) => value === null || typeof value === "string";
const parseCategory = (value: unknown): AdminCategory => {
  if (!isRecord(value) || !isAdminUuid(value.id) || !(value.parentId === null || isAdminUuid(value.parentId)) ||
    typeof value.name !== "string" || typeof value.slug !== "string" || !Number.isInteger(value.level) ||
    typeof value.path !== "string" || !nullableString(value.description)) throw createInvalidResponseError("Invalid category details.");
  return { id: value.id, parentId: value.parentId, name: value.name, slug: value.slug, level: Number(value.level), path: value.path, description: value.description as string | null };
};
const categoryPath = (id: string) => {
  if (!isAdminUuid(id)) throw createInvalidResponseError("Invalid category reference.");
  return `/api/v1/categories/${id}`;
};
export const getAdminCategory = async (id: string, options: ServiceRequestOptions = {}): Promise<AdminCategory> => {
  const { data } = await requestApi("GET", categoryPath(id), undefined, { ...options, auth: false });
  const category = parseCategory(data);
  if (category.id !== id) throw createInvalidResponseError("Category reference does not match.");
  return category;
};
export const createAdminCategory = async (body: CategoryInput, options: ServiceRequestOptions = {}): Promise<AdminCategory> => {
  const { name, slug, description, parentId } = body;
  const { data } = await requestApi("POST", "/api/v1/categories", { name, slug, description, parentId }, { ...options, auth: true });
  return parseCategory(data);
};
export const updateAdminCategory = async (id: string, body: CategoryPatch, options: ServiceRequestOptions = {}): Promise<AdminCategory> => {
  // Keep explicit null (move to root / clear description); omitted fields stay omitted.
  const { name, slug, description, parentId } = body;
  const { data } = await requestApi("PATCH", categoryPath(id), { name, slug, description, parentId }, { ...options, auth: true });
  const category = parseCategory(data);
  if (category.id !== id) throw createInvalidResponseError("Category reference does not match.");
  return category;
};
export const deleteAdminCategory = async (id: string, options: ServiceRequestOptions = {}): Promise<void> => {
  await requestApi("DELETE", categoryPath(id), undefined, { ...options, auth: true });
};

const warehouseStatuses = ["ACTIVE", "INACTIVE", "MAINTENANCE"];
export const parseWarehouse = (value: unknown): Warehouse => {
  if (!isRecord(value) || !isAdminUuid(value.id) || typeof value.code !== "string" || typeof value.name !== "string" ||
    !(value.address === undefined || nullableString(value.address)) || typeof value.status !== "string" || !warehouseStatuses.includes(value.status))
    throw createInvalidResponseError("Invalid warehouse details.");
  return { id: value.id, code: value.code, name: value.name, address: value.address as string | null | undefined, status: value.status as Warehouse["status"] };
};
export const getAdminWarehouses = async (options: ServiceRequestOptions = {}): Promise<Warehouse[]> => {
  const { data } = await requestApi("GET", "/api/v1/warehouses", undefined, { ...options, auth: true });
  if (!Array.isArray(data)) throw createInvalidResponseError("Invalid warehouse list.");
  const rows = data.map(parseWarehouse);
  if (new Set(rows.map((row) => row.id)).size !== rows.length) throw createInvalidResponseError("Duplicate warehouses.");
  return rows;
};
export const getAdminWarehouse = async (id: string, options: ServiceRequestOptions = {}): Promise<Warehouse> => {
  if (!isAdminUuid(id)) throw createInvalidResponseError("Invalid warehouse reference.");
  const { data } = await requestApi("GET", `/api/v1/warehouses/${id}`, undefined, { ...options, auth: true });
  const warehouse = parseWarehouse(data);
  if (warehouse.id !== id) throw createInvalidResponseError("Warehouse reference does not match.");
  return warehouse;
};
export const createAdminWarehouse = async (body: WarehouseInput, options: ServiceRequestOptions = {}): Promise<Warehouse> => {
  const { code, name, address } = body;
  const { data } = await requestApi("POST", "/api/v1/warehouses", { code, name, address }, { ...options, auth: true });
  return parseWarehouse(data);
};
export const updateAdminWarehouse = async (id: string, body: WarehouseUpdate, options: ServiceRequestOptions = {}): Promise<Warehouse> => {
  if (!isAdminUuid(id)) throw createInvalidResponseError("Invalid warehouse reference.");
  const { name, address, status } = body;
  const { data } = await requestApi("PUT", `/api/v1/warehouses/${id}`, { name, address, status }, { ...options, auth: true });
  const warehouse = parseWarehouse(data);
  if (warehouse.id !== id) throw createInvalidResponseError("Warehouse reference does not match.");
  return warehouse;
};
export const parseMovement = (value: unknown): StockMovement => {
  if (!isRecord(value) || !isAdminUuid(value.id) || !isAdminUuid(value.skuId) || !isAdminUuid(value.warehouseId) ||
    !["INTAKE", "RESERVE", "RELEASE", "COMMIT", "ADJUSTMENT", "RETURN", "PICK", "SHIP"].includes(String(value.movementType)) ||
    !Number.isInteger(value.quantity) || Number(value.quantity) < -2147483648 || Number(value.quantity) > 2147483647 ||
    !(value.referenceId === null || isAdminUuid(value.referenceId)) || !nullableString(value.reason) ||
    typeof value.createdAt !== "string" || !Number.isFinite(Date.parse(value.createdAt))) throw createInvalidResponseError("Invalid stock movement.");
  return { id: value.id, skuId: value.skuId, warehouseId: value.warehouseId, movementType: value.movementType as StockMovement["movementType"],
    quantity: Number(value.quantity), referenceId: value.referenceId, reason: value.reason as string | null, createdAt: value.createdAt };
};
export const getAdminMovements = async (skuId: string, warehouseId: string | undefined, pageNumber: number, options: ServiceRequestOptions = {}): Promise<Page<StockMovement>> => {
  if (!isAdminUuid(skuId) || warehouseId !== undefined && !isAdminUuid(warehouseId) || !Number.isInteger(pageNumber) || pageNumber < 0)
    throw createInvalidResponseError("Invalid movement filters.");
  const response: ApiResponse<unknown> = await requestApi("GET", "/api/v1/inventory/movements", undefined, {
    ...options, auth: true, params: { skuId, warehouseId, page: pageNumber, size: 10 },
  });
  if (!Array.isArray(response.data) || !response.page || response.page.number !== pageNumber) throw createInvalidResponseError("Invalid movement page.");
  const content = response.data.map(parseMovement);
  if (content.some((row) => row.skuId !== skuId || warehouseId !== undefined && row.warehouseId !== warehouseId))
    throw createInvalidResponseError("Movement filters do not match the response.");
  return { content, page: response.page.number, size: response.page.size, totalPages: response.page.totalPages, totalElements: response.page.totalElements };
};
