import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import test from "node:test";
import { isApiError } from "../configs/api";
import { deleteAddress, getAddresses, parseAddressBook, saveAddress, setDefaultAddress, updateAddress } from "../service/addressBookService";
import { getCheckoutPreview } from "../service/checkoutService";
import { getCheckoutDestination } from "../features/checkoutSchema";
import type { AddressBookInput } from "../types/addressBookType";

const input: AddressBookInput = {
  recipientName: "Buyer Name", phoneNumber: "0901234567", addressLine: "12 Nguyen Hue",
  provinceCode: "001", provinceName: "Ho Chi Minh City", wardCode: "00203", wardName: "Ward 4", isDefault: true,
};
const address = { ...input, id: "saved-1" };
const envelope = (data: unknown) => ({ code: 0, message: "response success", data });
const listen = async (server: Server) => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const bound = server.address(); assert.ok(bound && typeof bound !== "string");
  return `http://127.0.0.1:${bound.port}`;
};
const close = async (server: Server) => {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
};

test("address-book HTTP calls use current session, allowlist fields, encode IDs and accept bodyless delete", async () => {
  const seen: Array<{ method?: string; path?: string; auth?: string; body: string }> = [];
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = []; for await (const chunk of request) chunks.push(Buffer.from(chunk));
    seen.push({ method: request.method, path: request.url, auth: request.headers.authorization, body: Buffer.concat(chunks).toString() });
    if (request.method === "DELETE") { response.writeHead(204); response.end(); return; }
    response.writeHead(request.method === "POST" ? 201 : 200, { "Content-Type": "application/json" });
    response.end(JSON.stringify(envelope(request.method === "GET" ? [address] : { ...address, id: request.method === "PATCH" ? "a /?#" : "saved-1" })));
  });
  let token = "first-session";
  const context = { baseUrl: await listen(server), getAccessToken: () => token };
  try {
    assert.deepEqual(await getAddresses({ context, auth: false }), [address]);
    token = "rotated-session";
    const wider = { ...input, recipientName: " Buyer Name ", ...{ userId: "another-buyer", id: "ignored", role: "ADMIN" } };
    assert.deepEqual(await saveAddress(wider, { context }), address);
    await updateAddress("a /?#", wider, { context });
    await setDefaultAddress("a /?#", { context });
    assert.equal(await deleteAddress("a /?#", { context }), undefined);
    assert.equal(seen[0].auth, "Bearer first-session");
    assert.ok(seen.slice(1).every((entry) => entry.auth === "Bearer rotated-session"));
    assert.deepEqual(JSON.parse(seen[1].body), input);
    assert.deepEqual(JSON.parse(seen[2].body), input);
    assert.equal(seen[2].path, "/api/v1/users/me/addresses/a%20%2F%3F%23");
    assert.equal(seen[3].path, "/api/v1/users/me/addresses/a%20%2F%3F%23/default");
    assert.equal(seen[3].method, "PATCH"); assert.equal(seen[4].method, "DELETE");
  } finally { await close(server); }
});

test("address-book parser rejects ambiguous defaults, duplicates, malformed fields and over-limit lists", () => {
  assert.deepEqual(parseAddressBook([]), []);
  const ten = Array.from({ length: 10 }, (_, index) => ({ ...address, id: String(index), isDefault: index === 0 }));
  assert.equal(parseAddressBook(ten).length, 10);
  for (const value of [null, {}, [address, address], [{ ...address, isDefault: false }],
    [address, { ...address, id: "second" }], [{ ...address, wardCode: 203 }], [{ ...address, provinceName: " " }],
    [...ten, { ...address, id: "eleventh", isDefault: false }]])
    assert.throws(() => parseAddressBook(value), (error: unknown) => isApiError(error) && error.kind === "invalid-response");
});

test("address-book preserves server 409 capacity conflicts and ownership 404 without retry or masking", async () => {
  const seen: string[] = [];
  const server = createServer((request, response) => {
    seen.push(request.method!);
    const status = request.method === "POST" ? 409 : 404;
    response.writeHead(status, { "Content-Type": "application/problem+json" });
    response.end(JSON.stringify({ status, title: status === 409 ? "Address limit reached" : "Not found", code: status === 409 ? "ADDRESS_LIMIT_REACHED" : "ADDRESS_NOT_FOUND", detail: status === 409 ? "You may save up to 10 addresses." : "Address not found." }));
  });
  const context = { baseUrl: await listen(server), getAccessToken: () => "buyer-session" };
  try {
    await assert.rejects(saveAddress(input, { context }), (error: unknown) => isApiError(error) && error.status === 409 && error.code === "ADDRESS_LIMIT_REACHED");
    await assert.rejects(updateAddress("other-buyers-address", input, { context }), (error: unknown) => isApiError(error) && error.status === 404 && error.detail === "Address not found.");
    assert.deepEqual(seen, ["POST", "PUT"]);
  } finally { await close(server); }
});

test("saved-address locality codes produce the same preview request as a typed destination", async () => {
  const requests: unknown[] = [];
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = []; for await (const chunk of request) chunks.push(Buffer.from(chunk));
    if (request.method === "GET") { response.writeHead(200); response.end(JSON.stringify(envelope([address]))); return; }
    requests.push(JSON.parse(Buffer.concat(chunks).toString()));
    response.writeHead(200); response.end(JSON.stringify(envelope({ items: [], subtotal: 0, shippingFee: 30000, taxAmount: 0, discountAmount: 0, total: 30000, issues: [] })));
  });
  const context = { baseUrl: await listen(server), getAccessToken: () => "buyer-session" };
  try {
    const saved = (await getAddresses({ context }))[0];
    const provinces = [{ code: "001", name: "Ho Chi Minh City" }];
    const wards = [{ code: "00203", name: "Ward 4" }];
    const fromSaved = getCheckoutDestination(saved, provinces, wards);
    const fromTyped = getCheckoutDestination({ ...input }, provinces, wards);
    assert.ok(fromSaved && fromTyped);
    const savedQuote = await getCheckoutPreview(fromSaved, { context });
    const typedQuote = await getCheckoutPreview(fromTyped, { context });
    assert.deepEqual(savedQuote, typedQuote);
    assert.deepEqual(requests[0], requests[1]);
    assert.deepEqual(requests[0], { shippingAddress: { recipientName: input.recipientName, phoneNumber: input.phoneNumber, addressLine: input.addressLine, provinceCode: "001", wardCode: "00203", countryCode: "VN" }, paymentMethod: "SEPAY" });
  } finally { await close(server); }
});

test("address-book requests forward cancellation and reject malformed create/default responses", async () => {
  const controller = new AbortController();
  const context = { getAccessToken: () => "buyer-session", fetch: async (_url: RequestInfo | URL, init?: RequestInit) => {
    assert.equal(init?.signal?.aborted, false); controller.abort(); assert.equal(init?.signal?.aborted, true);
    return new Response(JSON.stringify(envelope(address)));
  } };
  await assert.rejects(saveAddress(input, { context, signal: controller.signal }), { name: "AbortError" });
  for (const invalid of [{ ...address, phoneNumber: null }, { ...address, isDefault: "true" }])
    await assert.rejects(saveAddress(input, { context: { fetch: async () => new Response(JSON.stringify(envelope(invalid))) } }), (error: unknown) => isApiError(error) && error.kind === "invalid-response");
  await assert.rejects(setDefaultAddress(address.id, { context: { fetch: async () => new Response(JSON.stringify(envelope({ ...address, isDefault: false }))) } }), (error: unknown) => isApiError(error) && error.kind === "invalid-response");
});
