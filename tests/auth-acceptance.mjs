/**
 * Browser regression suite. Pass a Playwright Page after preparing the smoke
 * route and starting Next dev. No Playwright package is added to the application.
 * Can also be executed by the Codex Playwright runner.
 */
export default async function runAuthAcceptance(
  page,
  baseUrl = "http://localhost:3101",
) {
  const errors = [];
  const captureError = (error) => errors.push(error.message);
  const captureConsole = (message) => {
    if (message.type() === "error") errors.push(message.text());
  };
  page.on("pageerror", captureError);
  page.on("console", captureConsole);
  const checks = [];
  const read = async (id) => JSON.parse(await page.getByTestId(id).innerText());
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  const stateMatches = async (expected) => {
    await page.waitForFunction((fields) => {
      const element = document.querySelector('[data-testid="state"]');
      if (!element) return false;
      const state = JSON.parse(element.textContent);
      return Object.entries(fields).every(
        ([key, value]) => state[key] === value,
      );
    }, expected);
    return read("state");
  };
  const click = async (name) =>
    page.getByRole("button", { name, exact: true }).click();
  const anonymous = () =>
    stateMatches({ status: "anonymous", hasToken: false, userEmail: null });
  const settle = async () => {
    await page.waitForFunction(() => {
      const element = document.querySelector('[data-testid="evidence"]');
      return element && JSON.parse(element.textContent).mutationCount === 0;
    });
  };
  const readStorage = () => page.evaluate(() => {
    const marker = sessionStorage.getItem("nexus.auth.logged-out");
    return {
      validLogoutMarker: marker === null || marker === "1",
      entries: [
        ...Object.entries(localStorage).map(([key, value]) => ["local", key, value]),
        ...Object.entries(sessionStorage)
          .filter(([key]) => key !== "nexus.auth.logged-out")
          .map(([key, value]) => ["session", key, value]),
      ].sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))),
    };
  });
  let storageBaseline;
  const assertStorage = async () => {
    const storage = await readStorage();
    assert(storage.validLogoutMarker, "Logout marker must contain only the token-free value 1");
    assert(
      JSON.stringify(storage.entries) === JSON.stringify(storageBaseline.entries),
      "Auth changed web storage outside its token-free logout marker",
    );
  };

  try {
    await page.goto(`${baseUrl}/auth-smoke`);
    await page.getByTestId("state").waitFor();
    await anonymous();
    assert(
      (await read("evidence")).requestCount === 0,
      "Anonymous /me ran unexpectedly",
    );
    checks.push("anonymous GET disabled");

    // Existing unrelated storage entries must survive every auth operation.
    await page.evaluate(() => {
      localStorage.setItem("auth-test-unrelated", "keep-local");
      sessionStorage.setItem("auth-test-unrelated", "keep-session");
    });
    await page.reload();
    await page.getByTestId("state").waitFor();
    storageBaseline = await readStorage();
    assert(storageBaseline.validLogoutMarker, "Unexpected initial logout marker value");

    await click("register");
    await settle();
    await anonymous();
    await assertStorage();
    checks.push("register does not sign in");

    await click("login");
    const primary = await stateMatches({
      status: "authenticated",
      hasToken: true,
    });
    await settle();
    const loginEvidence = await read("evidence");
    assert(
      loginEvidence.bearerMeMatchesLatestLogin === true,
      "GET /me lacked the current Bearer token",
    );
    assert(
      loginEvidence.publicLoginHasAuthorization === false,
      "Public login sent a token",
    );
    await assertStorage();
    assert(loginEvidence.storageHasToken === false, "Auth persisted a credential in web storage");
    assert(
      !loginEvidence.cacheKeysContainRawToken &&
        !loginEvidence.mutationDataContainsRawToken,
      "Token leaked into TanStack cache",
    );
    checks.push(
      "login GET Bearer",
      "only the token-free session logout marker may change in web storage",
      "no token in query keys/mutation data",
    );

    await click("invalid register 400");
    const invalid = await stateMatches({ lastErrorStatus: 400 });
    assert(
      Array.isArray(invalid.fieldErrors?.email),
      "Caller did not receive a typed email field error",
    );
    checks.push("typed 400 field error");

    await click("signout");
    await anonymous();
    await settle();
    await assertStorage();
    assert(
      (await read("evidence")).privateCachedDataCount === 0,
      "Logout kept private profile data",
    );
    await click("me after logout");
    await stateMatches({
      lastErrorStatus: 401,
      hasToken: false,
      userEmail: null,
    });
    checks.push("signOut clears Context/cache/Bearer");

    await click("delayed login ignoring abort");
    await page.waitForTimeout(250);
    const superseded = await stateMatches({
      status: "authenticated",
      hasToken: true,
    });
    assert(
      superseded.userEmail.startsWith("secondary-"),
      "Old login replaced the newer account",
    );
    checks.push("superseded login cannot restore old session");

    await click("delayed me ignoring abort");
    await page.waitForTimeout(250);
    await anonymous();
    assert(
      (await read("evidence")).privateCachedDataCount === 0,
      "Late /me repopulated private cache",
    );
    checks.push("logout during pending /me");

    await click("delayed login ignoring abort");
    await page.waitForTimeout(20);
    await click("signout");
    await page.waitForTimeout(250);
    await anonymous();
    checks.push("logout during pending login");

    await click("login");
    await stateMatches({ status: "authenticated" });
    await click("account switch second fixture");
    await page.waitForTimeout(100);
    const secondary = await stateMatches({ status: "authenticated" });
    assert(
      secondary.userEmail !== primary.userEmail &&
        secondary.userEmail.startsWith("secondary-"),
      "Profile cache crossed accounts",
    );
    checks.push("account switch isolates cache");
    await assertStorage();

    await click("expired me 401 query invalidation");
    await anonymous();
    checks.push("current-session 401 clears auth");

    await click("transient me 503 during login");
    await stateMatches({
      status: "error",
      hasToken: true,
      userEmail: null,
      lastErrorStatus: 503,
    });
    await click("retry profile");
    await stateMatches({ status: "authenticated", hasToken: true });
    checks.push("transient profile failure retains token and can recover");

    await page.reload();
    await page.getByTestId("state").waitFor();
    await anonymous();
    checks.push("isolated fixture has no SSO session after full refresh");
    await assertStorage();
    const preserved = await page.evaluate(() => ({
      local: localStorage.getItem("auth-test-unrelated"),
      session: sessionStorage.getItem("auth-test-unrelated"),
    }));
    assert(
      preserved.local === "keep-local" && preserved.session === "keep-session",
      "Auth removed unrelated storage",
    );
    assert(errors.length === 0, `Browser errors: ${errors.join("; ")}`);
    return { passed: checks.length, checks, browserErrors: errors };
  } finally {
    page.off("pageerror", captureError);
    page.off("console", captureConsole);
    await page.evaluate(() => {
      localStorage.removeItem("auth-test-unrelated");
      sessionStorage.removeItem("auth-test-unrelated");
    });
  }
}
