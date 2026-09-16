import { test, expect, type Page } from "@playwright/test";

const PASSWORD = process.env.SEED_PASSWORD ?? "Password123!";

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
}

test("unauthenticated users are redirected to login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});

test("wrong password is rejected", async ({ page }) => {
  await page.goto("/login");
  await page.fill('input[name="email"]', "admin@school.test");
  await page.fill('input[name="password"]', "nope");
  await page.click('button[type="submit"]');
  await expect(page.getByText("Invalid email or password.")).toBeVisible();
});

test("admin can open every module", async ({ page }) => {
  await login(page, "admin@school.test");
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByText("KHDA compliance findings")).toBeVisible();
  for (const path of ["/students", "/staff", "/academics", "/attendance", "/assessments", "/fees", "/fees/refund", "/compliance", "/compliance/sef", "/settings"]) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(200);
    await expect(page.locator("h1")).toBeVisible();
  }
});

test("admission form enforces KHDA age placement and Emirates ID format", async ({ page }) => {
  await login(page, "registrar@school.test");
  await page.goto("/students/new");
  await page.fill('input[name="firstName"]', "Test");
  await page.fill('input[name="lastName"]', "Child");
  await page.fill('input[name="dateOfBirth"]', "2024-01-01"); // far too young for Year 4
  await page.fill('input[name="nationality"]', "India");
  const year4 = await page.locator('select[name="gradeId"] option', { hasText: "Year 4" }).getAttribute("value");
  await page.selectOption('select[name="gradeId"]', year4!);
  await page.fill('input[name="gFirstName"]', "Parent");
  await page.fill('input[name="gLastName"]', "Child");
  await page.fill('input[name="gPhone"]', "+971500000000");
  await page.click('button:has-text("Submit admission")');
  await expect(page.getByText(/Too young/)).toBeVisible();

  await page.fill('input[name="dateOfBirth"]', "2018-04-01");
  await page.fill('input[name="emiratesId"]', "784-1234-1234567-9"); // bad checksum
  await page.click('button:has-text("Submit admission")');
  await expect(page.getByText(/Emirates ID is not valid/)).toBeVisible();

  await page.fill('input[name="emiratesId"]', "");
  await page.click('button:has-text("Submit admission")');
  await page.waitForURL(/\/students\/[a-z0-9]+$/);
  await expect(page.locator("h1")).toHaveText("Test Child");
  await expect(page.getByText(/KHDA age placement/)).toBeVisible();

  // Enrol into a Year 4 section
  await page.selectOption('select[name="sectionId"]', { index: 1 });
  await page.check('input[name="force"]');
  await page.click('button:has-text("Enrol")');
  await expect(page.getByText("Enrolled", { exact: true }).first()).toBeVisible(); // enrol form unmounts once enrolled
});

test("teacher can save an attendance register", async ({ page }) => {
  await login(page, "aisha.khan@school.test");
  await page.goto("/attendance");
  await expect(page.locator("h1")).toHaveText("Attendance");
  const rows = page.locator("tbody tr");
  expect(await rows.count()).toBeGreaterThan(0);
  await page.locator('input[type="radio"][value="ABSENT"]').first().check();
  await page.click('button:has-text("Save register")');
  await expect(page.getByText(/Register saved for \d+ student/)).toBeVisible();
});

test("accountant can record a payment", async ({ page }) => {
  await login(page, "accounts@school.test");
  await page.goto("/fees");
  const openRow = page.locator("tbody tr").filter({ hasText: /Issued|Partially paid|Overdue/ }).first();
  await openRow.locator('a[href^="/fees/invoices/"]').click();
  await page.fill('input[name="amount"]', "1");
  await page.click('button:has-text("Record")');
  await expect(page.getByText("Payment recorded.")).toBeVisible();
});

test("fee structure rejects a deposit over 10%", async ({ page }) => {
  await login(page, "accounts@school.test");
  await page.goto("/fees");
  await page.selectOption('select[name="gradeId"]', { index: 1 });
  await page.fill('input[name="annualTuition"]', "40000");
  await page.fill('input[name="registrationDeposit"]', "5000");
  await page.click('button:has-text("Save")');
  await expect(page.getByText(/may not exceed 10%/)).toBeVisible();
});

test("registrar can generate and sign a Parent–School Contract", async ({ page }) => {
  await login(page, "registrar@school.test");
  await page.goto("/students");
  await page.locator('tbody a[href^="/students/"]').nth(1).click();
  await page.click('a:has-text("ontract")');
  await page.click('button:has-text("enerate")');
  await expect(page.getByText("PARENT–SCHOOL CONTRACT", { exact: false }).first()).toBeVisible();
  await page.click('button:has-text("Mark signed")');
  await expect(page.getByText(/^Signed \d/)).toBeVisible(); // sign form unmounts once the contract is signed
});

test("parent portal shows linked child only", async ({ page }) => {
  await login(page, "parent@school.test");
  await expect(page).toHaveURL(/\/portal/);
  await expect(page.getByText("Ahmed Al Maktoum")).toBeVisible();
  const res = await page.goto("/students");
  expect(res?.url()).toMatch(/\/forbidden/);
});

test("CSV export requires a staff role and returns rows", async ({ page, request }) => {
  const anon = await request.get("/api/export/students", { maxRedirects: 0 });
  expect(anon.status()).toBe(307);
  await login(page, "admin@school.test");
  const res = await page.request.get("/api/export/students");
  expect(res.status()).toBe(200);
  const body = await res.text();
  expect(body.split("\r\n").length).toBeGreaterThan(5);
  expect(body).toContain("EmiratesID");
});
