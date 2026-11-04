import type { components } from "./commerceGeneratedType";
export type AddCartItemRequest = components["schemas"]["AddCartItem"];
/** UI command combines the item path parameter with the quantity body. */
export type UpdateCartItemRequest = {
  itemId: string;
  quantity: AddCartItemRequest["quantity"];
};
