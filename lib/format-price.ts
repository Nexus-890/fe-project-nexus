export function formatVND(price: string | null): string | null {
  if (price === null) return null;

  const match = /^(\d+)(?:\.(\d+))?$/.exec(price);
  if (!match) return null;

  const integer = match[1].replace(/^0+(?=\d)/, "");
  const fraction = match[2];

  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  const decimal =
    fraction === undefined ? "" : `,${fraction.padEnd(2, "0")}`;

  return `${grouped}${decimal} ₫`;
}
