import { parsePage, readQueryValue, SEARCH_MAX_PRICE, type SearchState } from "./catalogUtils";
import { formatVND } from "../components/formatPrice";

export { SEARCH_MAX_PRICE } from "./catalogUtils";
export const searchFilterGroups = [
  { title: "Listing Type", key: "listingType", options: [
    { value: "all", label: "All listings" },
    { value: "buy-now", label: "Buy Now" },
    { value: "auction", label: "Auction" },
  ] },
  { title: "Seller Trust Level", key: "trust", options: [
    { value: "top-seller", label: "Top Seller" },
    { value: "trusted", label: "Trusted" },
    { value: "standard", label: "Standard" },
    { value: "new", label: "New" },
  ] },
  { title: "Condition", key: "condition", options: [
    { value: "new", label: "New" },
    { value: "like-new", label: "Like New" },
    { value: "used-good", label: "Used — Good" },
    { value: "for-parts", label: "For parts" },
  ] },
] as const;

type RawSearchQuery = Record<string, string | string[] | undefined>;

/** Parse shareable URL state; preview filters are never treated as delivered API fields. */
export const readSearchState = (query: RawSearchQuery): SearchState => {
  const readOptions = (key: "trust" | "condition") => {
    const values = query[key];
    const selected = Array.isArray(values) ? values : values ? [values] : [];
    return searchFilterGroups.find((group) => group.key === key)!.options
      .filter((option) => selected.includes(option.value))
      .map((option) => option.value);
  };
  const sort = readQueryValue(query.sort);
  const listingType = readQueryValue(query.listingType);
  const rawPrice = readQueryValue(query.maxPrice);
  const maxPrice = /^\d+$/.test(rawPrice) ? Number(rawPrice) : SEARCH_MAX_PRICE;
  const minRating = Number(readQueryValue(query.minRating));
  return {
    q: readQueryValue(query.q),
    category: readQueryValue(query.category),
    sort: ["createdAt,desc", "price,asc", "price,desc"].includes(sort) ? sort : "relevance",
    page: parsePage(query.page),
    listingType: ["buy-now", "auction"].includes(listingType) ? listingType : "all",
    trust: readOptions("trust"),
    condition: readOptions("condition"),
    maxPrice: Number.isSafeInteger(maxPrice) && maxPrice >= 0 && maxPrice <= SEARCH_MAX_PRICE
      ? Math.floor(maxPrice / 100000) * 100000 : SEARCH_MAX_PRICE,
    minRating: [2, 3, 4].includes(minRating) ? minRating : 0,
  };
};

export const searchFilterChips = (state: SearchState) => [
  ...searchFilterGroups.flatMap((group) => group.options
    .filter((option) => group.key === "listingType"
      ? option.value !== "all" && option.value === state.listingType
      : state[group.key]?.includes(option.value))
    .map((option) => ({
      key: `${group.key}-${option.value}`,
      label: `${group.title}: ${option.label}`,
      remove: group.key === "listingType"
        ? { listingType: "all" }
        : { [group.key]: state[group.key]?.filter((value) => value !== option.value) },
    }))),
  ...(state.maxPrice !== undefined && state.maxPrice < SEARCH_MAX_PRICE
    ? [{ key: "maxPrice", label: `Up to ${formatVND(String(state.maxPrice))}`, remove: { maxPrice: SEARCH_MAX_PRICE } }] : []),
  ...(state.minRating ? [{ key: "minRating", label: `${state.minRating} stars & up`, remove: { minRating: 0 } }] : []),
];
