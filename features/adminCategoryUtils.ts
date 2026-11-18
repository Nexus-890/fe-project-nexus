import type { CategoryNode } from "../types/catalogResponseType";

export type CategoryChoice = { id: string; name: string; depth: number; ancestors: string[] };
export const flattenAdminCategories = (nodes: CategoryNode[], ancestors: string[] = []): CategoryChoice[] =>
  nodes.flatMap((node) => [{ id: node.id, name: node.name, depth: ancestors.length, ancestors }, ...flattenAdminCategories(node.children, [...ancestors, node.id])]);

export const categorySlug = (name: string) => name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[đĐ]/g, "d")
  .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100).replace(/-+$/, "");
