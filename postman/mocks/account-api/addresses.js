/* Provisional #210 dependency fixture, not a delivered backend implementation. */
const { randomUUID } = require("node:crypto");

module.exports = async function handleAddresses(req, res, url, helpers) {
  const { json, problem, bodyOf, envelope, state } = helpers;
  const base = "/v1/users/me/addresses";
  if (url.pathname !== base && !url.pathname.startsWith(`${base}/`)) return false;
  if (await state.get("account-api:addressFailure")) {
    problem(res, 503, "ADDRESS_BOOK_UNAVAILABLE", "Saved addresses are temporarily unavailable.");
    return true;
  }
  const all = await state.get("account-api:addresses") || [];
  const persist = async () => state.set("account-api:addresses", all);
  if (url.pathname === base && req.method === "GET") {
    json(res, envelope(all)); return true;
  }
  const fields = ["recipientName", "phoneNumber", "addressLine", "provinceCode", "provinceName", "wardCode", "wardName"];
  const parse = () => {
    const body = bodyOf(req);
    if (fields.some((field) => typeof body[field] !== "string" || !body[field].trim()) || typeof body.isDefault !== "boolean") return null;
    return Object.fromEntries([...fields.map((field) => [field, body[field].trim()]), ["isDefault", body.isDefault]]);
  };
  if (url.pathname === base && req.method === "POST") {
    if (all.length >= 10) { problem(res, 409, "ADDRESS_LIMIT_REACHED", "You may save up to 10 addresses."); return true; }
    const body = parse();
    if (!body) { problem(res, 400, "VALIDATION_FAILED", "Complete all address fields."); return true; }
    const address = { ...body, id: randomUUID(), isDefault: all.length === 0 || body.isDefault };
    if (address.isDefault) all.forEach((entry) => { entry.isDefault = false; });
    all.push(address); await persist(); json(res, envelope(address), 201); return true;
  }
  const match = url.pathname.slice(base.length + 1).match(/^([^/]+)(\/default)?$/);
  if (!match) { problem(res, 404, "ADDRESS_NOT_FOUND", "Address not found."); return true; }
  const id = decodeURIComponent(match[1]);
  const index = all.findIndex((entry) => entry.id === id);
  if (index < 0) { problem(res, 404, "ADDRESS_NOT_FOUND", "Address not found."); return true; }
  if (match[2] && req.method === "PATCH") {
    all.forEach((entry) => { entry.isDefault = entry.id === id; });
    await persist(); json(res, envelope(all[index])); return true;
  }
  if (!match[2] && req.method === "PUT") {
    const body = parse();
    if (!body) { problem(res, 400, "VALIDATION_FAILED", "Complete all address fields."); return true; }
    // A current default stays default until another address is selected.
    const address = { ...body, id, isDefault: all[index].isDefault || body.isDefault };
    if (address.isDefault) all.forEach((entry) => { entry.isDefault = false; });
    all[index] = address; await persist(); json(res, envelope(address)); return true;
  }
  if (!match[2] && req.method === "DELETE") {
    const removed = all.splice(index, 1)[0];
    if (removed.isDefault && all.length) all[0].isDefault = true;
    await persist(); res.writeHead(204); res.end(); return true;
  }
  problem(res, 501, "NOT_IMPLEMENTED", "This address operation is not modelled."); return true;
};
