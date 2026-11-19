import assert from "node:assert/strict";
import { test } from "node:test";
import { isApiError } from "../configs/api";
import { penaltyImpact, penaltyReference, averageRatingText } from "../features/reputationFormat";
import { avatarFileError, uploadAvatar } from "../service/accountService";
import { isUserResponse } from "../service/authService";
import { getMyPenalties, getMyReputation } from "../service/ratingService";
import type { ServiceRequestOptions } from "../types/commonRequestType";

const reputation = { score: 62, trustLevel: "TRUSTED", totalTransaction: 9, successfulTransaction: 7, failedTransaction: 1,
  ratingCount: 4, averageRating: 4.3, successfulAuctions: 2, failedAuctions: 1, penaltyCount: 2, policyVersion: "reputation-policy-1" };
const penalty = { id: "0f9a4a6c-8a43-4d65-9d5c-7a1ef0d2c001", changeType: "AUCTION_PAYMENT_TIMEOUT",
  sourceId: "5b1c2d3e-4f50-4a61-8b72-9c83d94e0a11", delta: -10, previousScore: 72, newScore: 62,
  previousLevel: "TRUSTED", newLevel: "TRUSTED", reason: "Auction payment deadline missed", changedAt: "2026-11-18T03:00:00Z" };
const user = { id: "64fba061-3a91-4a35-a853-221798344510", email: "me@nexus.local", phone: "0900000001", fullName: "Me",
  gender: null, address: null, dateOfBirth: null, roles: ["BUYER"], status: "ACTIVE", createdAt: "2026-11-01T00:00:00Z" };
const invalid = (error: unknown) => isApiError(error) && error.kind === "invalid-response";
const fixture = (data: unknown, page?: unknown) => {
  const calls: { method: string; path: string; headers: Headers; body: unknown }[] = [];
  const options: ServiceRequestOptions = { context: { getAccessToken: () => "buyer", fetch: async (input, init) => {
    calls.push({ method: init?.method ?? "GET", path: String(input), headers: new Headers(init?.headers), body: init?.body });
    return Response.json({ code: 0, message: "response success", data, ...(page ? { page } : {}) });
  } } };
  return { calls, options };
};

test("own reputation reads the private path and keeps a null average without ratings", async () => {
  const { calls, options } = fixture(reputation);
  assert.deepEqual(await getMyReputation(options), reputation);
  assert.equal(new URL(calls[0].path, "http://x").pathname, "/api/v1/users/me/reputation");
  assert.equal(calls[0].headers.get("authorization"), "Bearer buyer");
  const fresh = { ...reputation, score: 50, trustLevel: "NEW", ratingCount: 0, averageRating: null, totalTransaction: 0,
    successfulTransaction: 0, failedTransaction: 0, penaltyCount: 0 };
  assert.equal((await getMyReputation(fixture(fresh).options)).averageRating, null);
});

test("own reputation rejects impossible counters, levels and averages", async () => {
  for (const bad of [
    { ...reputation, score: 101 }, { ...reputation, trustLevel: "GOLD" }, { ...reputation, successfulTransaction: 9 },
    { ...reputation, averageRating: 5.5 }, { ...reputation, averageRating: null }, { ...reputation, ratingCount: 0 },
    { ...reputation, penaltyCount: -1 }, { ...reputation, policyVersion: " " },
  ]) await assert.rejects(getMyReputation(fixture(bad).options), invalid);
});

test("penalties send page and size and reject entries that did not lower the score", async () => {
  const { calls, options } = fixture([penalty], { number: 1, size: 10, totalElements: 11, totalPages: 2 });
  const page = await getMyPenalties(1, options);
  assert.equal(page.content[0].delta, -10);
  assert.equal(page.totalPages, 2);
  const url = new URL(calls[0].path, "http://x");
  assert.equal(url.pathname, "/api/v1/users/me/penalties");
  assert.equal(url.searchParams.get("page"), "1");
  assert.equal(url.searchParams.get("size"), "10");
  const info = { number: 0, size: 10, totalElements: 1, totalPages: 1 };
  for (const bad of [{ ...penalty, delta: 5, newScore: 77 }, { ...penalty, newScore: 60 }, { ...penalty, changeType: "OTHER" },
    { ...penalty, actorId: penalty.id }, { ...penalty, sourceId: "x" }, { ...penalty, reason: "" }])
    await assert.rejects(getMyPenalties(0, fixture([bad], info).options), invalid);
  await assert.rejects(getMyPenalties(0, fixture([penalty, penalty], { ...info, totalElements: 2 }).options), invalid);
  await assert.rejects(getMyPenalties(0, fixture([penalty], { ...info, number: 1 }).options), invalid);
  await assert.rejects(getMyPenalties(-1, options), invalid);
});

test("penalty rows show the reference kind, short id and the score change", () => {
  assert.equal(penaltyReference(penalty as never), "Auction 5B1C2D3E");
  assert.equal(penaltyReference({ changeType: "ADMIN_ADJUSTMENT", sourceId: null }), "—");
  assert.equal(penaltyImpact(penalty), "-10 (72 → 62)");
  assert.equal(averageRatingText(4.25), "4.3");
  assert.equal(averageRatingText(null), "—");
});

test("avatar upload checks the file first, posts multipart and needs the new avatar url back", async () => {
  assert.equal(avatarFileError({ size: 10, type: "image/gif" }), "Use a JPEG, PNG or WebP image.");
  assert.equal(avatarFileError({ size: 2 * 1024 * 1024 + 1, type: "image/png" }), "The image must be 2 MB or smaller.");
  assert.equal(avatarFileError({ size: 0, type: "image/png" }), "Choose an image file.");
  assert.equal(avatarFileError({ size: 2 * 1024 * 1024, type: "image/webp" }), null);
  const file = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "me.png", { type: "image/png" });
  const { calls, options } = fixture({ ...user, avatarUrl: "https://storage.example/avatars/me.png" });
  assert.equal((await uploadAvatar(file, options)).avatarUrl, "https://storage.example/avatars/me.png");
  assert.equal(calls[0].method, "POST");
  assert.equal(new URL(calls[0].path, "http://x").pathname, "/api/v1/users/me/avatar");
  assert.ok(calls[0].body instanceof FormData);
  assert.equal(((calls[0].body as FormData).get("file") as File).name, "me.png");
  await assert.rejects(uploadAvatar(file, fixture({ ...user, avatarUrl: null }).options), invalid);
  const gif = fixture(user);
  await assert.rejects(uploadAvatar(new File(["GIF89a"], "me.gif", { type: "image/gif" }), gif.options), invalid);
  assert.equal(gif.calls.length, 0);
});

test("profiles accept a missing or null avatar but not a non-string one", () => {
  assert.ok(isUserResponse(user));
  assert.ok(isUserResponse({ ...user, avatarUrl: null }));
  assert.ok(isUserResponse({ ...user, avatarUrl: "https://storage.example/a.png" }));
  assert.ok(!isUserResponse({ ...user, avatarUrl: 3 }));
});
