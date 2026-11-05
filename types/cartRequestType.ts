import type { components } from "./commerceGeneratedType";
export type AddCartItemRequest = components["schemas"]["AddCartItem"];

/** App input for the pending #111 contract; not a delivered/generated wire DTO. */
export type UpdateCartItemRequest = {
  itemId: string;
  quantity: number;
};
