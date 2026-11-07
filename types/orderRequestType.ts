import type { OrderStatus } from "./orderResponseType";

export type OrderFilters = { status?: OrderStatus; page: number; size: number };
