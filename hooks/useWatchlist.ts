"use client";

import { useContext } from "react";
import { WatchlistContext } from "@/providers/WatchlistProvider";

export function useWatchlist() {
  return useContext(WatchlistContext);
}
