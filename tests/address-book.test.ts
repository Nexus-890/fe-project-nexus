import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import test from "node:test";
import { isApiError } from "../configs/api";
import { deleteAddress, getAddresses, parseAddressBook, saveAddress, setDefaultAddress, updateAddress } from "../service/addressBookService";
import { getCheckoutPreview } from "../service/checkoutService";
import { getCheckoutDestination } from "../features/checkoutSchema";
import { addressBookSchema, getAddressBookFieldErrors, getAddressBookInput, validateAddressBookAddress } from "../features/addressBookSchema";
import type { AddressBookInput } from "../types/addressBookType";
import type { components } from "../types/account210GeneratedType";

const input: AddressBookInput = {
  recipientName: "Buyer Name", phoneNumber: "0901234567", addressLine: "12 Nguyen Hue",
  provinceCode: "202", provinceName: "Ho Chi Minh City", wardCode: "20308", wardName: "Ward 4", isDefault: true,
};
const wireInput: components["schemas"]["AddressRequest"] = {
  recipientName: input.recipientName, phone: input.phoneNumber, addressLine: input.addressLine,
  provinceCode: input.provinceCode, provinceName: input.provinceName, wardCode: input.wardCode, wardName: input.wardName, isDefault: true,
};
const id = "68000000-0000-4000-8000-000000000101";
const createdAt = "2026-11-13T12:00:00+07:00";
const updatedAt = "2026-11-14T01:00:00.123456+07:00";
const address = { ...input, id, createdAt, updatedAt };
const wireAddress: components["schemas"]["Address"] = {
  ...wireInput, isDefault: true, id, createdAt, updatedAt,
};
const envelope = (data: unknown) => ({ code: 0, message: "response success", data });
const listEnvelope = (data: unknown[]) => ({ ...envelope(data), page: { number: 0, size: Math.max(1, data.length), totalElements: data.length, totalPages: data.length ? 1 : 0 } });
const listen = async (server: Server) => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const bound = server.address(); assert.ok(bound && typeof bound !== "string");
  return `http://127.0.0.1:${bound.port}`;
};
const close = async (server: Server) => {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
};

test("#210 address HTTP maps phone to UI phoneNumber, retains timestamps, sends POST default and bodyless delete", async () => {
  const seen: Array<{ method?: string; path?: string; auth?: string; body: string }> = [];
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = []; for await (const chunk of request) chunks.push(Buffer.from(chunk));
    seen.push({ method: request.method, path: request.url, auth: request.headers.authorization, body: Buffer.concat(chunks).toString() });
    if (request.method === "DELETE") { response.writeHead(204); response.end(); return; }
    if (request.url?.endsWith("/default") && request.method !== "POST") { response.writeHead(405); response.end(); return; }
    response.writeHead(request.method === "POST" && !request.url?.endsWith("/default") ? 201 : 200, { "Content-Type": "application/json" });
    response.end(JSON.stringify(request.method === "GET" ? listEnvelope([wireAddress]) : envelope(wireAddress)));
  });
  let token = "first-session";
  const context = { baseUrl: await listen(server), getAccessToken: () => token };
  try {
    assert.deepEqual(await getAddresses({ context, auth: false }), [address]);
    token = "rotated-session";
    const wider = { ...input, recipientName: " Buyer Name ", phoneNumber: "090 123-4567", ...{ phone: "ignored", userId: "another-buyer", id: "ignored", role: "ADMIN" } };
    assert.deepEqual(await saveAddress(wider, { context }), address);
    assert.deepEqual(await updateAddress("a /?#", wider, { context }), address);
    assert.deepEqual(await setDefaultAddress(id, { context }), address);
    assert.equal(await deleteAddress("a /?#", { context }), undefined);
    assert.equal(seen[0].auth, "Bearer first-session");
    assert.ok(seen.slice(1).every((entry) => entry.auth === "Bearer rotated-session"));
    assert.deepEqual(JSON.parse(seen[1].body), wireInput);
    assert.deepEqual(JSON.parse(seen[2].body), wireInput);
    assert.equal(seen[2].path, "/api/v1/users/me/addresses/a%20%2F%3F%23");
    assert.equal(seen[3].path, `/api/v1/users/me/addresses/${id}/default`);
    assert.equal(seen[3].method, "POST"); assert.equal(seen[3].body, "");
    assert.equal(seen[4].method, "DELETE"); assert.equal(seen[4].body, "");
  } finally { await close(server); }
});

test("address parser rejects obsolete phoneNumber wire DTO, missing dates, ambiguous defaults and over-limit lists", async () => {
  assert.deepEqual(parseAddressBook([]), []);
  const ten = Array.from({ length: 10 }, (_, index) => ({ ...wireAddress, id: `68000000-0000-4000-8000-${String(index).padStart(12, "0")}`, isDefault: index === 0 }));
  assert.equal(parseAddressBook(ten).length, 10);
  for (const value of [null, {}, [address], [wireAddress, wireAddress], [{ ...wireAddress, isDefault: false }],
    [wireAddress, { ...wireAddress, id: "68000000-0000-4000-8000-000000000102" }],
    [{ ...wireAddress, phone: null }], [{ ...wireAddress, wardCode: 203 }], [{ ...wireAddress, provinceName: " " }],
    [{ ...wireAddress, createdAt: undefined }], [{ ...wireAddress, updatedAt: "2026-11-14" }], [{ ...wireAddress, id: "not-a-uuid" }],
    [...ten, { ...wireAddress, id: "68000000-0000-4000-8000-000000000111", isDefault: false }]])
    assert.throws(() => parseAddressBook(value), (error: unknown) => isApiError(error) && error.kind === "invalid-response");
  await assert.rejects(getAddresses({ context: { fetch: async () => new Response(JSON.stringify(envelope([wireAddress]))) } }), (error: unknown) => isApiError(error) && error.kind === "invalid-response");
});

test("address-book preserves #210 409 capacity conflicts, ownership 404 and phone validation errors", async () => {
  const seen: string[] = [];
  const server = createServer((request, response) => {
    seen.push(request.method!);
    const status = request.method === "POST" ? 409 : request.method === "PUT" ? 404 : 400;
    response.writeHead(status, { "Content-Type": "application/problem+json" });
    response.end(JSON.stringify({ status, title: "Address request rejected", code: status === 409 ? "ADDRESS_LIMIT_REACHED" : status === 404 ? "ADDRESS_NOT_FOUND" : "VALIDATION_FAILED", detail: status === 409 ? "An account keeps at most 10 addresses" : status === 404 ? "Address not found" : "The request data is invalid", ...(status === 400 ? { errors: [{ field: "phone", code: "VALIDATION_PATTERN", detail: "Invalid phone number" }] } : {}) }));
  });
  const context = { baseUrl: await listen(server), getAccessToken: () => "buyer-session" };
  try {
    await assert.rejects(saveAddress(input, { context }), (error: unknown) => isApiError(error) && error.status === 409 && error.code === "ADDRESS_LIMIT_REACHED");
    await assert.rejects(updateAddress(id, input, { context }), (error: unknown) => isApiError(error) && error.status === 404 && error.detail === "Address not found");
    await assert.rejects(getAddresses({ context }), (error: unknown) => {
      assert.ok(isApiError(error)); assert.deepEqual(getAddressBookFieldErrors(error), { phoneNumber: "Invalid phone number" }); return true;
    });
    assert.deepEqual(seen, ["POST", "PUT", "GET"]);
  } finally { await close(server); }
});

test("saved #210 address maps to exactly the same checkout preview request and quote as typed values", async () => {
  const requests: unknown[] = [];
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = []; for await (const chunk of request) chunks.push(Buffer.from(chunk));
    if (request.method === "GET") { response.writeHead(200); response.end(JSON.stringify(listEnvelope([wireAddress]))); return; }
    requests.push(JSON.parse(Buffer.concat(chunks).toString()));
    response.writeHead(200); response.end(JSON.stringify(envelope({ items: [], subtotal: 0, shippingFee: 30000, taxAmount: 0, discountAmount: 0, total: 30000, issues: [] })));
  });
  const context = { baseUrl: await listen(server), getAccessToken: () => "buyer-session" };
  try {
    const saved = (await getAddresses({ context }))[0];
    const provinces = [{ code: input.provinceCode, name: input.provinceName }];
    const wards = [{ code: input.wardCode, name: input.wardName }];
    const fromSaved = getCheckoutDestination(saved, provinces, wards);
    const fromTyped = getCheckoutDestination({ ...input }, provinces, wards);
    assert.ok(fromSaved && fromTyped);
    const savedQuote = await getCheckoutPreview(fromSaved, { context });
    const typedQuote = await getCheckoutPreview(fromTyped, { context });
    assert.deepEqual(savedQuote, typedQuote); assert.deepEqual(requests[0], requests[1]);
    assert.deepEqual(requests[0], { shippingAddress: { recipientName: input.recipientName, phoneNumber: input.phoneNumber, addressLine: input.addressLine, provinceCode: "202", wardCode: "20308", countryCode: "VN" }, paymentMethod: "SEPAY" });
  } finally { await close(server); }
});

test("address requests retain cancellation and reject malformed create/default responses", async () => {
  const controller = new AbortController();
  const context = { getAccessToken: () => "buyer-session", fetch: async (_url: RequestInfo | URL, init?: RequestInit) => {
    assert.equal(init?.signal?.aborted, false); controller.abort(); assert.equal(init?.signal?.aborted, true);
    return new Response(JSON.stringify(envelope(wireAddress)));
  } };
  await assert.rejects(saveAddress(input, { context, signal: controller.signal }), { name: "AbortError" });
  for (const invalid of [{ ...wireAddress, phone: null }, { ...wireAddress, isDefault: "true" }, { ...wireAddress, createdAt: undefined }])
    await assert.rejects(saveAddress(input, { context: { fetch: async () => new Response(JSON.stringify(envelope(invalid))) } }), (error: unknown) => isApiError(error) && error.kind === "invalid-response");
  await assert.rejects(setDefaultAddress(id, { context: { fetch: async () => new Response(JSON.stringify(envelope({ ...wireAddress, isDefault: false }))) } }), (error: unknown) => isApiError(error) && error.kind === "invalid-response");
});

test("saved address form enforces #210 limits and normalizes supported phone punctuation", () => {
  assert.equal(addressBookSchema.parse({ ...input, phoneNumber: "+84 (90) 123-4567" }).phoneNumber, "+84901234567");
  assert.equal(addressBookSchema.safeParse({ ...input, phoneNumber: "1234567" }).success, true);
  assert.equal(addressBookSchema.safeParse({ ...input, addressLine: "a".repeat(255) }).success, true);
  assert.deepEqual(validateAddressBookAddress({ ...input, addressLine: "a".repeat(256) }), { addressLine: "Use 255 characters or fewer" });
  for (const provinceCode of ["001", "-1", "1e2", "1234567890"])
    assert.ok(validateAddressBookAddress({ ...input, provinceCode }).provinceCode);
  const provinces = [{ code: input.provinceCode, name: input.provinceName }];
  const wards = [{ code: input.wardCode, name: input.wardName }];
  assert.deepEqual(getAddressBookInput({ ...input }, provinces, wards, true), input);
  assert.equal(getAddressBookInput({ ...input }, provinces, [], true), null);
  assert.equal(getAddressBookInput({ ...input }, [{ code: input.provinceCode, name: "a".repeat(101) }], wards, true), null);
});