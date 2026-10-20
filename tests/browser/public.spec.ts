import { test, expect } from "@playwright/test";

test("public pages hydrate without mismatches across browser locales", async ({ browser }) => {
  const context = await browser.newContext({
    locale: "uk-UA",
    timezoneId: "Asia/Tokyo",
    viewport: { width: 390, height: 844 },
  });
  try {
    const page = await context.newPage();
    const errors: string[] = [];
    const recordHydrationError = (message: string) => {
      if (/hydrat|server rendered|did not match|Minified React error #(418|423|425)/i.test(message)) {
        errors.push(message);
      }
    };
    page.on("console", (message) => {
      if (message.type() === "error") recordHydrationError(message.text());
    });
    page.on("pageerror", (error) => recordHydrationError(error.message));

    await page.goto("/");
    await page.locator('a[href="/demo"]').first().click();
    await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
    // This interaction also proves React has hydrated the client shell.
    await page.getByRole("button", { name: "Open navigation" }).click();
    const navigation = page.getByRole("dialog", { name: "Main navigation" });
    await expect(navigation).toBeVisible();
    await navigation.getByRole("link", { name: "Fleet", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Fleet", exact: true })).toBeVisible();
    expect(errors, "React hydration errors").toEqual([]);
  } finally {
    await context.close();
  }
});

test("public landing and signup configuration", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Your rental business/ })).toBeVisible();
  await page.getByRole("link", { name: "Create your workspace" }).click();
  await expect(page).toHaveURL(/\/setup|\/sign-up/);
});
test("sample workspace has functional navigation and no write forms", async ({ page }) => {
  await page.goto("/demo");
  await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
  await expect(page.getByText("Read-only preview", { exact: false })).toBeVisible();
  await page.getByRole("link", { name: "Fleet", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Fleet", exact: true })).toBeVisible();
  await expect(page.locator("form[method=post i]")).toHaveCount(0);
  await page.getByRole("link", { name: "Finance", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Finance", exact: true })).toBeVisible();
});
test("preview works on mobile without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/demo");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: "test-results/demo-mobile.png", fullPage: true });
});
test("protected resources do not expose data without configured authentication", async ({
  page,
}) => {
  for (const route of [
    "/dashboard",
    "/vehicles",
    "/api/export?type=invoices",
    "/api/files/not-owned",
    "/api/documents/invoice/not-owned",
  ]) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/setup|\/sign-in/);
  }
});
test("desktop preview", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1080 });
  await page.goto("/demo");
  await page.screenshot({ path: "test-results/demo-desktop.png", fullPage: true });
});

test("mobile navigation supports Escape and closes after navigation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/demo");
  const toggle = page.getByRole("button", { name: "Open navigation" });
  await toggle.click();
  const navigation = page.getByRole("dialog", { name: "Main navigation" });
  await expect(navigation).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(navigation).not.toBeVisible();
  await expect(toggle).toBeFocused();
  await toggle.click();
  await navigation.getByRole("link", { name: "Fleet", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Fleet", exact: true })).toBeVisible();
  await expect(navigation).not.toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: "test-results/fleet-mobile.png", fullPage: true });
});

test("fleet search filters results and retains filters when changing view", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1080 });
  await page.goto("/demo");
  await page.getByRole("textbox", { name: "Search fleet" }).fill("Toyota");
  await page.getByRole("textbox", { name: "Search fleet" }).press("Enter");
  await expect(page.getByRole("heading", { name: "Fleet", exact: true })).toBeVisible();
  await expect(page.locator("main tbody tr")).toHaveCount(1);
  await expect(page.locator("main")).toContainText("Toyota Corolla");
  await expect(page.locator("main")).not.toContainText("Kia Sportage");
  await page.getByRole("link", { name: "Card view", exact: true }).click();
  await expect(page.locator(".vehicle-card")).toHaveCount(1);
  await expect(page).toHaveURL(/q=Toyota/);
  await page.getByRole("link", { name: "Table view", exact: true }).click();
  await expect(page.locator("main tbody tr")).toHaveCount(1);
});

test("landing and fleet layouts fit common viewport sizes", async ({ page }) => {
  for (const width of [360, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 950 });
    for (const route of ["/", "/demo?view=vehicles", "/demo?view=vehicles&layout=cards"]) {
      await page.goto(route);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
    }
  }
  await page.goto("/");
  await page.screenshot({ path: "test-results/landing-desktop.png", fullPage: true });
  await page.goto("/demo?view=vehicles");
  await page.screenshot({ path: "test-results/fleet-desktop.png", fullPage: true });
});
