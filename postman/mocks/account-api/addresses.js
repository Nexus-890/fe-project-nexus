/* #210 contract fixture: AddressController/DTOs at 1e480dda. */
const { randomUUID } = require("node:crypto");
const uuid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;

module.exports = async function handleAddresses(req, res, url, helpers) {
  const { json, problem, bodyOf, envelope, state } = helpers;
  const base = "/v1/users/me/addresses";
  if (url.pathname !== base && !url.pathname.startsWith(`${base}/`)) return false;
  if (await state.get("account-api:addressFailure")) {
    problem(res, 503, "SERVICE_UNAVAILABLE", "Saved addresses are temporarily unavailable.");
    return true;
  }
  const all = await state.get("account-api:addresses") || [];
  const persist = async () => state.set("account-api:addresses", all);
  if (url.pathname === base && req.method === "GET") {
    const sorted = [...all].sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
    json(res, envelope(sorted, { number: 0, size: Math.max(1, all.length), totalElements: all.length, totalPages: all.length ? 1 : 0 }));
    return true;
  }
  const fields = ["recipientName", "phone", "addressLine", "provinceCode", "provinceName", "wardCode", "wardName"];
  const parse = () => {
    const body = bodyOf(req);
    const data = Object.fromEntries(fields.map((field) => [field, typeof body[field] === "string" ? body[field].trim() : ""]));
    data.phone = data.phone.replace(/[\s()-]/g, "");
    const limits = { recipientName: 150, addressLine: 255, provinceName: 100, wardName: 100 };
    const errors = fields.filter((field) => !data[field] || (limits[field] && data[field].length > limits[field])).map((field) => ({ field, code: "VALIDATION_SIZE", detail: "Enter a valid value." }));
    if (!/^\+?[0-9]{7,15}$/.test(data.phone)) errors.push({ field: "phone", code: "VALIDATION_PATTERN", detail: "Invalid phone number" });
    for (const field of ["provinceCode", "wardCode"])
      if (!/^[1-9][0-9]{0,8}$/.test(data[field])) errors.push({ field, code: "VALIDATION_PATTERN", detail: "Invalid locality code" });
    if (body.isDefault !== undefined && body.isDefault !== null && typeof body.isDefault !== "boolean") errors.push({ field: "isDefault", code: "VALIDATION_TYPE", detail: "Enter a boolean." });
    return { data: { ...data, isDefault: body.isDefault === true }, errors };
  };
  const invalid = (errors) => problem(res, 400, "VALIDATION_FAILED", "The request data is invalid", errors);
  if (url.pathname === base && req.method === "POST") {
    const { data, errors } = parse();
    if (errors.length) { invalid(errors); return true; }
    if (all.length >= 10) { problem(res, 409, "ADDRESS_LIMIT_REACHED", "An account keeps at most 10 addresses"); return true; }
    const now = new Date().toISOString();
    const address = { ...data, id: randomUUID(), isDefault: all.length === 0 || data.isDefault, createdAt: now, updatedAt: now };
    if (address.isDefault) all.forEach((entry) => { entry.isDefault = false; });
    all.push(address); await persist(); json(res, envelope(address), 201); return true;
  }
  const match = url.pathname.slice(base.length + 1).match(/^([^/]+)(\/default)?$/);
  if (!match) { problem(res, 405, "METHOD_NOT_ALLOWED", "This method is not allowed."); return true; }
  const id = decodeURIComponent(match[1]);
  if (!uuid.test(id)) { problem(res, 400, "INVALID_PARAMETER", "Invalid address id."); return true; }
  if ((match[2] && req.method !== "POST") || (!match[2] && !["PUT", "DELETE"].includes(req.method))) {
    problem(res, 405, "METHOD_NOT_ALLOWED", "This method is not allowed."); return true;
  }
  const index = all.findIndex((entry) => entry.id === id);
  if (index < 0) { problem(res, 404, "ADDRESS_NOT_FOUND", "Address not found"); return true; }
  if (match[2] && req.method === "POST") {
    all.forEach((entry) => { entry.isDefault = entry.id === id; });
    all[index].updatedAt = new Date().toISOString();
    await persist(); json(res, envelope(all[index])); return true;
  }
  if (!match[2] && req.method === "PUT") {
    const { data, errors } = parse();
    if (errors.length) { invalid(errors); return true; }
    const address = { ...data, id, isDefault: all[index].isDefault || data.isDefault, createdAt: all[index].createdAt, updatedAt: new Date().toISOString() };
    if (address.isDefault) all.forEach((entry) => { entry.isDefault = false; });
    all[index] = address; await persist(); json(res, envelope(address)); return true;
  }
  if (!match[2] && req.method === "DELETE") {
    const removed = all.splice(index, 1)[0];
    if (removed.isDefault && all.length) {
      const next = [...all].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.id.localeCompare(a.id))[0];
      next.isDefault = true; next.updatedAt = new Date().toISOString();
    }
    await persist(); res.writeHead(204); res.end(); return true;
  }
  problem(res, 405, "METHOD_NOT_ALLOWED", "This method is not allowed."); return true;
};