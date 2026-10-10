import type { CategoryNode } from "../types/catalog/response/type";

export const CATALOG_PAGE_SIZE = 12;

export function parsePage(value: string | string[] | undefined): number {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) return 1;
  const page = Number(value);
  return Number.isSafeInteger(page) && page <= 2147483647 ? page : 1;
}
export function findCategory(nodes: CategoryNode[], slug: string): CategoryNode | undefined {
  for (const node of nodes) {
    // Routes normally use the public slug, but accepting the API id keeps
    // shared links such as /categories/1 working while the backend migrates.
    if (node.slug === slug || node.id === slug) return node;
    const child = findCategory(node.children, slug);
    if (child) return child;
  }
}

export interface FlatCategory extends CategoryNode {
  depth: number;
}

/** Flatten the API tree for select controls without duplicating category data in the UI. */
export function flattenCategories(nodes: CategoryNode[], depth = 0): FlatCategory[] {
  return nodes.flatMap((node) => [
    { ...node, depth },
    ...flattenCategories(node.children, depth + 1),
  ]);
}

export function readQueryValue(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value ?? "").trim();
}
