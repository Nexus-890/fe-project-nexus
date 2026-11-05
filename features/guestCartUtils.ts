import type { CartSnapshot } from "../types/cartResponseType";

export const cartItemCount = (cart: CartSnapshot): number =>
  cart.items.reduce((total, item) => total + item.quantity, 0);
