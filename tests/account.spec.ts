import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const api = "http://127.0.0.1:3921/api";
const provider = "http://127.0.0.1:3921/keycloak";
const pending = { id: "seller-1", companyName: "Nexus Books", phone: "0901234567", note: "Pre-loved books for everyone.", status: "PENDING" };
type Evidence = { sellerSubmissions: number; phoneSends: number; phoneConfirms: number; emailSends: number; requests: { path: string; method: string; authorized: boolean; body: unknown }[] };
async function control(request: APIRequestContext, body: Record<string, unknown>) {
  expect((await request.post(`${api}/test/account/control`, { data: body })).ok()).toBe(true);
}
async function evidence(request: APIRequestContext): Promise<Evidence> {
  const response = await request.get(`${api}/test/account/evidence`);
  expect(response.ok()).toBe(true);
  return response.json();
}
async function providerSignIn(page: Page) {
  await expect(page.getByRole("heading", { name: "Keycloak sign in", exact: true })).toBeVisible();
  await page.getByLabel("Email", { exact: true }).fill("buyer@nexus.local");
  await page.getByLabel("Password", { exact: true }).fill("Fixture-pass-123!");
  await page.getByRole("button", { name: "Sign in at Keycloak", exact: true }).click();
}
async function signIn(page: Page, route = "/become-a-seller") {
  await page.goto(`/sign-in?returnTo=${encodeURIComponent(route)}`);
  await page.getByRole("button", { name: "Continue to sign in", exact: true }).click();
  await providerSignIn(page);
  await expect(page).toHaveURL(new RegExp(`${route}$`));
}
async function fillApplication(page: Page) {
  await page.getByLabel("Company name", { exact: true }).fill(pending.companyName);
  await page.getByLabel("Contact phone", { exact: true }).fill(pending.phone);
  await page.getByLabel("Application note", { exact: true }).fill(pending.note);
}

test.beforeEach(async ({ request }) => {
  for (const path of [`${provider}/test/reset`, `${api}/test/reset`, `${api}/test/account/reset`]) expect((await request.get(path)).ok()).toBe(true);
});

test("anonymous seller application redirects without protected requests", async ({ page, request }) => {
  await page.goto("/become-a-seller");
  await expect(page).toHaveURL(/\/sign-in\?returnTo=%2Fbecome-a-seller$/);
  expect((await evidence(request)).requests.filter((entry) => entry.path.includes("sellers/applications"))).toEqual([]);
});

test("buyer validates contact phone, submits exact issue body and never reads the admin list", async ({ page, request }, info) => {
  await signIn(page);
  await page.getByRole("button", { name: "Submit application", exact: true }).click();
  await expect(page.getByText("Company name must have at least 2 characters.", { exact: true })).toBeVisible();
  expect((await evidence(request)).sellerSubmissions).toBe(0);
  await fillApplication(page);
  await page.getByLabel("Contact phone", { exact: true }).fill("letters");
  await page.getByRole("button", { name: "Submit application", exact: true }).click();
  await expect(page.getByText("Enter a valid contact phone number.", { exact: true })).toBeVisible();
  expect((await evidence(request)).sellerSubmissions).toBe(0);
  await page.getByLabel("Contact phone", { exact: true }).fill(pending.phone);
  await page.screenshot({ path: info.outputPath("seller-application-mobile.png"), fullPage: true, style: "nextjs-portal { visibility: hidden !important; }" });
  await page.getByRole("button", { name: "Submit application", exact: true }).click();
  await expect(page.getByText("Pending review", { exact: true })).toBeVisible();
  await expect(page.getByRole("form", { name: "Seller application" })).toHaveCount(0);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: info.outputPath("seller-application-desktop.png"), fullPage: true, style: "nextjs-portal { visibility: hidden !important; }" });
  const actual = await evidence(request);
  expect(actual.sellerSubmissions).toBe(1);
  const sellerCalls = actual.requests.filter((entry) => entry.path.includes("sellers/applications"));
  expect(sellerCalls).toEqual([{ path: "/v1/sellers/applications", method: "POST", authorized: true, body: { companyName: pending.companyName, phone: pending.phone, note: pending.note } }]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("duplicate application after reload shows the defined conflict without an admin-only read", async ({ page, request }) => {
  await control(request, { sellerApplication: pending });
  await signIn(page);
  await fillApplication(page);
  await page.getByRole("button", { name: "Submit application", exact: true }).click();
  await expect(page.getByText("Pending review", { exact: true })).toBeVisible();
  expect((await evidence(request)).sellerSubmissions).toBe(1);
  await expect(page.getByRole("heading", { name: "You already have an open application", exact: true })).toBeVisible();
  expect((await evidence(request)).requests.filter((entry) => entry.path.includes("sellers/applications")).map((entry) => entry.method)).toEqual(["POST"]);
});

test("failed seller POST preserves the form and supports an explicit retry", async ({ page, request }) => {
  await control(request, { sellerFailure: true });
  await signIn(page);
  await fillApplication(page);
  await page.getByRole("button", { name: "Submit application", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Applications are temporarily unavailable." })).toBeVisible();
  await expect(page.getByLabel("Company name", { exact: true })).toHaveValue(pending.companyName);
  await control(request, { sellerFailure: false });
  await page.getByRole("button", { name: "Submit application", exact: true }).click();
  await expect(page.getByText("Pending review", { exact: true })).toBeVisible();
  expect((await evidence(request)).sellerSubmissions).toBe(1);
});

test("an existing seller token opens back office without reading applications", async ({ page, request }) => {
  expect((await request.get(`${provider}/test/control?roles=BUYER,SELLER`)).ok()).toBe(true);
  await signIn(page);
  await expect(page.getByRole("link", { name: "Open seller back office", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Open seller back office", exact: true }).click();
  await expect(page).toHaveURL(/\/backoffice$/);
  expect((await evidence(request)).requests.filter((entry) => entry.path.includes("sellers/applications"))).toEqual([]);
});

test("phone rejects an incorrect code, accepts the right code and a changed phone needs verification", async ({ page, request }, info) => {
  await signIn(page, "/profile");
  await page.getByRole("button", { name: "Send verification code", exact: true }).click();
  await expect(page.getByRole("button", { name: "Resend in 60s", exact: true })).toBeDisabled();
  await page.getByLabel("Verification code", { exact: true }).fill("000000");
  await page.getByRole("button", { name: "Verify phone", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "The code was rejected." })).toBeVisible();
  await page.getByLabel("Verification code", { exact: true }).fill("123456");
  await page.getByRole("button", { name: "Verify phone", exact: true }).click();
  await expect(page.getByText("Verified phone number", { exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath("phone-verified-mobile.png"), fullPage: true, style: "nextjs-portal { visibility: hidden !important; }" });
  await page.getByLabel("Phone to verify", { exact: true }).fill("0902222222");
  await expect(page.getByText("Verified phone number", { exact: true })).toHaveCount(0);
  await page.getByRole("button",{name:"Save phone number",exact:true}).click();
  await expect(page.getByLabel("Phone to verify",{exact:true})).toHaveValue("0902222222");
  await expect.poll(async()=>(await evidence(request)).requests.filter(x=>x.path==="/v1/users/me"&&x.method==="PUT").length).toBe(1);
  await expect(page.getByText("Verified phone number",{exact:true})).toHaveCount(0);
  const actual = await evidence(request);
  expect(actual.phoneSends).toBe(1);
  expect(actual.phoneConfirms).toBe(2);
  expect(actual.requests.find(x=>x.path==="/v1/users/me/phone/verification"&&x.method==="POST")?.body).toEqual({});
  expect(actual.requests.find(x=>x.path.endsWith("/phone/verification/confirm"))?.body).toEqual({});
  expect(actual.requests.find(x=>x.path==="/v1/users/me"&&x.method==="PUT")?.body).toEqual({phone:"0902222222"});
  expect(actual.requests.filter((entry) => entry.path.includes("/phone/verification")).every((entry) => entry.authorized)).toBe(true);
});

test("sixth incorrect phone attempt shows the rate limit", async ({ page, request }) => {
  await signIn(page, "/profile");
  await page.getByRole("button", { name: "Send verification code", exact: true }).click();
  for (let index = 1; index <= 6; index += 1) {
    await page.getByLabel("Verification code", { exact: true }).fill("000000");
    await page.getByRole("button", { name: "Verify phone", exact: true }).click();
    await expect.poll(async () => (await evidence(request)).phoneConfirms).toBe(index);
    await expect(page.getByRole("button", { name: "Verify phone", exact: true })).toBeEnabled();
  }
  await expect(page.getByRole("alert").filter({ hasText: "Too many requests or attempts." })).toBeVisible();
});

test("a new phone challenge clears the previous incorrect-code error", async ({ page, request }) => {
  await signIn(page, "/profile");
  await page.clock.install();
  await page.getByRole("button", { name: "Send verification code", exact: true }).click();
  await page.getByLabel("Verification code", { exact: true }).fill("000000");
  await page.getByRole("button", { name: "Verify phone", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "The code was rejected." })).toBeVisible();
  await control(request, { advanceMs: 61000 });
  await page.clock.fastForward(61000);
  await page.getByRole("button", { name: "Resend code", exact: true }).click();
  await expect.poll(async () => (await evidence(request)).phoneSends).toBe(2);
  await expect(page.getByRole("alert").filter({ hasText: "The code was rejected." })).toHaveCount(0);
});

test("fourth phone send is refused and an expired code cannot be submitted", async ({ page, request }) => {
  await signIn(page, "/profile");
  await page.clock.install();
  await page.getByRole("button", { name: "Send verification code", exact: true }).click();
  for (let index = 0; index < 3; index += 1) {
    await control(request, { advanceMs: 61000 });
    await page.clock.fastForward(61000);
    await page.getByRole("button", { name: "Resend code", exact: true }).click();
    if (index < 2) await expect.poll(async () => (await evidence(request)).phoneSends).toBe(index + 2);
  }
  await expect(page.getByRole("alert").filter({ hasText: "Too many requests or attempts." })).toBeVisible();
  expect((await evidence(request)).phoneSends).toBe(3);
  await page.clock.fastForward(300001);
  await expect(page.getByText("This code has expired. Request a new code.", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Verify phone", exact: true })).toBeDisabled();
});

test("check-email screen enforces a minute cooldown and sends a public resend", async ({ page, request }, info) => {
  await page.clock.install();
  await page.goto("/check-email?email=buyer%40nexus.local");
  await expect(page.getByRole("heading", { name: "Check your email", exact: true })).toBeVisible();
  await expect(page.getByLabel("Email address", { exact: true })).toHaveValue("buyer@nexus.local");
  await expect(page.getByRole("button", { name: "Resend in 60s", exact: true })).toBeDisabled();
  expect((await evidence(request)).emailSends).toBe(0);
  await page.screenshot({ path: info.outputPath("check-email-mobile.png"), fullPage: true, style: "nextjs-portal { visibility: hidden !important; }" });
  await page.clock.fastForward(61000);
  await page.getByRole("button", { name: "Resend verification email", exact: true }).click();
  await expect(page.getByText("If this account needs verification, a new link has been sent.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Resend in/ })).toBeDisabled();
  const actual = await evidence(request);
  expect(actual.emailSends).toBe(1);
  expect(actual.requests.find((entry) => entry.path.includes("verification-email"))?.authorized).toBe(false);
});

test("registration opens the check-email screen without creating a signed-in session", async ({ page, request }) => {
  await page.goto("/sign-up");
  for (const [label, value] of [
    ["Full Name", "New Nexus Buyer"], ["Email", "new.buyer@example.test"], ["Phone Number", "0905555555"],
    ["Identity Number", "079203004599"], ["Date of Birth", "2000-01-01"], ["Address", "12 Nguyen Hue"],
    ["Password", "Fixture-pass-123!"], ["Confirm Password", "Fixture-pass-123!"],
  ]) await page.getByLabel(label, { exact: true }).fill(value);
  await page.getByRole("combobox", { name: "Gender", exact: true }).selectOption("OTHER");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create Account", exact: true }).click();
  await expect(page).toHaveURL(/\/check-email\?email=new.buyer%40example.test$/);
  await expect(page.getByRole("heading", { name: "Check your email", exact: true })).toBeVisible();
  const calls = (await evidence(request)).requests;
  expect(calls.filter((entry) => entry.path === "/v1/auth/register")).toHaveLength(1);
  expect(calls.find((entry) => entry.path === "/v1/auth/register")?.authorized).toBe(false);
  expect((await page.context().cookies()).some((cookie) => cookie.name === "nexus_rt")).toBe(false);
});


test("registration email-send failure keeps the account and offers resend without registering twice", async ({page,request}) => {
  await control(request,{registrationEmailFailure:true});
  await page.goto("/sign-up");
  for(const [label,value] of [["Full Name","New Nexus Buyer"],["Email","retry.buyer@example.test"],["Phone Number","0905555555"],["Identity Number","079203004599"],["Date of Birth","2000-01-01"],["Address","12 Nguyen Hue"],["Password","Fixture-pass-123!"],["Confirm Password","Fixture-pass-123!"]]) await page.getByLabel(label,{exact:true}).fill(value);
  await page.getByRole("combobox",{name:"Gender",exact:true}).selectOption("OTHER");
  await page.getByRole("checkbox").check();
  await page.getByRole("button",{name:"Create Account",exact:true}).click();
  await expect(page).toHaveURL(/check-email.*delivery=failed/);
  await expect(page.getByText("Your account was created, but we could not send the verification email.",{exact:false})).toBeVisible();
  await page.clock.install(); await page.clock.fastForward(61000);
  const response=page.waitForResponse(r=>r.url().endsWith("/api/v1/auth/verification-email")&&r.request().method()==="POST");
  await page.getByRole("button",{name:"Resend verification email",exact:true}).click();
  expect((await response).status()).toBe(204);
  await expect(page.getByText("If this account needs verification, a new link has been sent.",{exact:true})).toBeVisible();
  expect((await evidence(request)).requests.filter(x=>x.path==="/v1/auth/register")).toHaveLength(1);
});
