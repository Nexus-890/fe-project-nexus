import assert from "node:assert/strict";
import { test } from "node:test";
import { createPasswordAccountUrl } from "../features/oidc";

test("password account navigation opens credential settings and returns only to the profile", () => {
  const destination = new URL(createPasswordAccountUrl("http://localhost:3000"));
  assert.equal(destination.origin, "http://localhost:18080");
  assert.equal(destination.pathname, "/realms/nexus/account/");
  assert.equal(destination.hash, "#/account-security/signing-in");
  assert.deepEqual([...destination.searchParams], [
    ["referrer", "nexus-web"],
    ["referrer_uri", "http://localhost:3000/profile"],
  ]);
});

test("password account navigation rejects origins carrying credentials, paths or script schemes", () => {
  for (const origin of [
    "javascript:alert(1)", "http://example.com", "https://user:secret@nexus.example",
    "https://nexus.example/attacker", "https://nexus.example?redirect=//evil.example",
    "https://nexus.example#//evil.example", "//evil.example",
  ]) assert.throws(() => createPasswordAccountUrl(origin), origin);
});

test("password account navigation respects the deployed provider path and encoded realm", () => {
  const previous = {
    base: process.env.NEXT_PUBLIC_KEYCLOAK_URL,
    realm: process.env.NEXT_PUBLIC_KEYCLOAK_REALM,
    client: process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID,
  };
  try {
    process.env.NEXT_PUBLIC_KEYCLOAK_URL = "https://identity.nexus.example/auth/";
    process.env.NEXT_PUBLIC_KEYCLOAK_REALM = "Nexus realm";
    process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID = "nexus-production";
    const destination = new URL(createPasswordAccountUrl("https://shop.nexus.example"));
    assert.equal(destination.pathname, "/auth/realms/Nexus%20realm/account/");
    assert.equal(destination.searchParams.get("referrer"), "nexus-production");
    assert.equal(destination.searchParams.get("referrer_uri"), "https://shop.nexus.example/profile");
    for (const base of ["http://identity.nexus.example", "https://user:secret@identity.nexus.example", "javascript:alert(1)"]) {
      process.env.NEXT_PUBLIC_KEYCLOAK_URL = base;
      assert.throws(() => createPasswordAccountUrl("https://shop.nexus.example"));
    }
  } finally {
    for (const [key, value] of [
      ["NEXT_PUBLIC_KEYCLOAK_URL", previous.base],
      ["NEXT_PUBLIC_KEYCLOAK_REALM", previous.realm],
      ["NEXT_PUBLIC_KEYCLOAK_CLIENT_ID", previous.client],
    ]) {
      if (value === undefined) delete process.env[key!];
      else process.env[key!] = value;
    }
  }
});
