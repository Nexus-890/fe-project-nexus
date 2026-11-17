import assert from "node:assert/strict";
import { test } from "node:test";
import { searchHref } from "../features/catalogUtils";
import { readSearchState, searchFilterChips, SEARCH_MAX_PRICE } from "../features/searchUtils";
import { SEARCH_SORT, isShopSort } from "../types/catalogRequestType";

test("URL sort validation shares the complete typed search sort mapping", () => {
  for (const value of Object.keys(SEARCH_SORT)) {
    assert.equal(isShopSort(value), true);
    assert.equal(readSearchState({ sort: value }).sort, value);
  }
  for (const value of ["unknown", "toString", "__proto__"]) {
    assert.equal(isShopSort(value), false);
    assert.equal(readSearchState({ sort: value }).sort, "relevance");
  }
});

test("search state round-trips all filters and safely normalizes untrusted URL values", () => {
  const state = readSearchState({
    q: "  wireless & wired  ", category: "headphones", sort: "price,asc", page: "2",
    listingType: "auction", trust: ["trusted", "trusted", "invalid", "top-seller"],
    condition: ["used-good", "new"], maxPrice: "1250000", minRating: "4",
  });
  const url = new URL(searchHref(state), "https://nexus.test");
  const query = Object.fromEntries([...new Set(url.searchParams.keys())].map((key) => [
    key, ["trust", "condition"].includes(key) ? url.searchParams.getAll(key) : url.searchParams.get(key)!,
  ]));
  assert.deepEqual(readSearchState(query), state);
  assert.deepEqual(state.trust, []);
  assert.deepEqual(state.condition, []);
  assert.equal(state.minRating, 0);
  assert.equal(state.maxPrice, 1200000);
  assert.equal(state.q, "wireless & wired");
  const invalid = readSearchState({
    sort: "unsafe", page: "-1", listingType: "invalid", trust: "invalid",
    condition: "invalid", maxPrice: "1e10", minRating: "5",
  });
  assert.equal(searchHref(invalid), "/search");
  assert.equal(invalid.maxPrice, SEARCH_MAX_PRICE);
});

test("removing a supported filter preserves search and sorting while unsupported URL values are discarded", () => {
  const state = readSearchState({
    q: "shoes", category: "fashion", sort: "createdAt,desc", page: "3",
    trust: ["trusted", "top-seller"], condition: "new", minRating: "4", listingType: "auction", maxPrice: "200000",
  });
  const chip = searchFilterChips(state).find((item) => item.key === "listingType-auction")!;
  const url = new URL(searchHref({ ...state, ...chip.remove, page: 1 }), "https://nexus.test");
  assert.deepEqual(url.searchParams.getAll("trust"), []);
  assert.equal(url.searchParams.get("condition"), null);
  assert.equal(url.searchParams.has("listingType"), false);
  assert.equal(url.searchParams.get("maxPrice"), "200000");
  assert.equal(url.searchParams.get("q"), "shoes");
  assert.equal(url.searchParams.get("sort"), "createdAt,desc");
  assert.equal(url.searchParams.has("page"), false);
});
