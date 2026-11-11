"use client";

import { createContext, useContext, useEffect, useState, useSyncExternalStore, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { createBuyerPreviewState, restoreBuyerPreviewState, type BuyerPreviewState } from "../features/buyerPreviewState";

const storageKey = "nexus.buyer-shop-preview.v1";
type PreviewContext = { state: BuyerPreviewState; setState: Dispatch<SetStateAction<BuyerPreviewState>>; ready: boolean };
const BuyerPreviewContext = createContext<PreviewContext | null>(null);

function createPreviewStore() {
  const initial = { state: createBuyerPreviewState(), ready: false };
  let snapshot = initial;
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());
  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => initial,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    restore: () => {
      if (snapshot.ready) return;
      // Storage contains only sample choices, never authentication or real cart
      // state. The stable server snapshot keeps the initial hydration identical.
      let restored: BuyerPreviewState | null = null;
      try { const saved = sessionStorage.getItem(storageKey); if (saved) restored = restoreBuyerPreviewState(JSON.parse(saved)); } catch { /* Use the in-memory sample when storage is blocked or invalid. */ }
      snapshot = { state: restored ?? initial.state, ready: true };
      notify();
    },
    setState: (action: SetStateAction<BuyerPreviewState>) => {
      const state = typeof action === "function" ? action(snapshot.state) : action;
      snapshot = { state, ready: true };
      try { sessionStorage.setItem(storageKey, JSON.stringify(state)); } catch { /* In-memory choices still survive client navigation. */ }
      notify();
    },
  };
}

function BuyerPreviewProvider({ children }: { children: ReactNode }) {
  const [store] = useState(createPreviewStore);
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  useEffect(() => { store.restore(); }, [store]);
  return <BuyerPreviewContext value={{ ...snapshot, setState: store.setState }}>{children}</BuyerPreviewContext>;
}

export function useBuyerPreview() {
  const context = useContext(BuyerPreviewContext);
  if (!context) throw new Error("Buyer previews must be inside BuyerPreviewProvider.");
  return context;
}

export default BuyerPreviewProvider;
