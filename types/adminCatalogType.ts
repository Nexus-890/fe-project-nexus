import type { components as Catalog } from "./catalogGeneratedType";
import type { components as Inventory } from "./inventoryGeneratedType";

export type AdminCategory = Catalog["schemas"]["Category"];
export type CategoryInput = Catalog["schemas"]["CreateCategory"];
export type CategoryPatch = Catalog["schemas"]["UpdateCategory"];
export type Warehouse = Inventory["schemas"]["Warehouse"];
export type WarehouseInput = Inventory["schemas"]["CreateWarehouseRequest"];
export type WarehouseUpdate = Inventory["schemas"]["UpdateWarehouseRequest"];
export type OwnWarehouseInput = Inventory["schemas"]["UpdateOwnWarehouseRequest"];
export type StockMovement = Inventory["schemas"]["Movement"];
