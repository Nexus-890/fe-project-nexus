"use client";

import { useContext } from "react";
import { CartContext } from "../providers/CartProvider";

export function useGuestCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useGuestCart must be used within CartProvider");
  return context;
}
