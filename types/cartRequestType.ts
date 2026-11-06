import type { components, operations } from "./commerceGeneratedType";
export type AddCartItemRequest = components["schemas"]["AddCartItem"];
/** UI command combines the item path parameter with the quantity body. */
export type UpdateCartItemRequest = operations["updateOwnCartItem"]["requestBody"]["content"]["application/json"] & {
  itemId: string;
};
