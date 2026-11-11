import { createInvalidResponseError, isRecord, requestApi } from "../configs/api";
import type { ServiceRequestOptions } from "../types/commonRequestType";
import type { StockBalance, StockIntakeInput } from "../types/backofficeType";

const isUuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const quantityFields = ["total", "available", "reserved", "unavailable"] as const;
const validQuantity = (value: unknown): value is number => Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 2147483647;

export const parseStockBalance = (value: unknown): StockBalance => {
  if (!isRecord(value) || !isUuid(value.skuId) || !isUuid(value.warehouseId) ||
    !quantityFields.every((key) => validQuantity(value[key])) ||
    Number(value.total) !== Number(value.available) + Number(value.reserved) + Number(value.unavailable))
    throw createInvalidResponseError("Invalid stock balance");
  return { skuId: value.skuId, warehouseId: value.warehouseId, total: Number(value.total),
    available: Number(value.available), reserved: Number(value.reserved), unavailable: Number(value.unavailable) };
};

export const intakeStock = async (input: StockIntakeInput, options: ServiceRequestOptions = {}): Promise<StockBalance> => {
  if (!isUuid(input.skuId) || !Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > 2147483647 ||
    (input.warehouseId !== undefined && !isUuid(input.warehouseId)))
    throw createInvalidResponseError("Choose a SKU, a valid optional warehouse UUID and a positive whole quantity (maximum 2147483647).");
  const body: StockIntakeInput = { skuId: input.skuId, quantity: input.quantity,
    ...(input.warehouseId ? { warehouseId: input.warehouseId } : {}) };
  const { data } = await requestApi("POST", "/api/v1/inventory/intake", body, { ...options, auth: true });
  const balance = parseStockBalance(data);
  if (balance.skuId !== input.skuId || input.warehouseId && balance.warehouseId !== input.warehouseId)
    throw createInvalidResponseError("Stock intake returned a different SKU or warehouse");
  return balance;
};

/** ADMIN sees all warehouses; the backend scopes SELLER reads to owned SKUs. */
export const getStockBalances = async (skuId: string, warehouseId: string | undefined, options: ServiceRequestOptions = {}): Promise<StockBalance[]> => {
  if (!isUuid(skuId) || warehouseId !== undefined && !isUuid(warehouseId)) throw createInvalidResponseError("Invalid stock balance reference");
  const rows: StockBalance[] = [];
  let number = 0;
  let pages = 1;
  do {
    const { data, page } = await requestApi("GET", "/api/v1/inventory/balances", undefined, {
      ...options, auth: true, params: { skuId, ...(warehouseId ? { warehouseId } : {}), page: number, size: 100 },
    });
    if (!Array.isArray(data) || !page || page.number !== number) throw createInvalidResponseError("Invalid stock balance page");
    const parsed = data.map(parseStockBalance);
    if (parsed.some((row) => row.skuId !== skuId || warehouseId && row.warehouseId !== warehouseId))
      throw createInvalidResponseError("Stock balances returned a different SKU or warehouse");
    rows.push(...parsed);
    pages = page.totalPages;
    number++;
  } while (number < pages);
  if (new Set(rows.map((row) => row.warehouseId)).size !== rows.length) throw createInvalidResponseError("Duplicate stock balances");
  return rows;
};
