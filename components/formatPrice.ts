export const formatVND = (price: string | null): string | null => {
  if (price === null) return null;

  const match = /^(\d+)(?:\.(\d+))?$/.exec(price);
  if (!match) return null;

  const integer = match[1].replace(/^0+(?=\d)/, "");
  const fraction = match[2];

  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  const decimal = fraction === undefined ? "" : `,${fraction.padEnd(2, "0")}`;

  return `${grouped}${decimal} ₫`;
};

export const formatVNDRange = (
  minPrice: string | null,
  maxPrice: string | null,
): string | null => {
  const min = formatVND(minPrice);
  const max = formatVND(maxPrice);
  if (min === null || max === null || minPrice === null || maxPrice === null) return min;

  const normalize = (price: string): string => {
    const [integer, fraction = ""] = price.split(".");
    return `${integer.replace(/^0+(?=\d)/, "")}.${fraction.replace(/0+$/, "")}`;
  };
  if (normalize(minPrice) === normalize(maxPrice)) return min;
  return `${min} – ${max}`;
};
