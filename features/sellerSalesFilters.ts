/** Calendar days in the seller portal use the project's Vietnam timezone. */
export function sellerSalesDates(from: string, to: string): { from?: string; to?: string } | null {
  const valid = (value: string) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
  if (!valid(from) || !valid(to) || from && to && from > to) return null;
  return { ...(from ? { from: `${from}T00:00:00.000+07:00` } : {}), ...(to ? { to: `${to}T23:59:59.999+07:00` } : {}) };
}
