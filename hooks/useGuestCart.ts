"use client";

import { useContext } from "react";
import { CartContext } from "../providers/CartProvider";

export function useGuestCart() {
  const cart = useContext(CartContext);
  if (!cart) throw new Error("useGuestCart must be used inside CartProvider");
  return cart;
}
