// ============================================================================
// tests/e2e/urban-air.spec.ts
// Verifies end-to-end resident workflows, headers, resilience, and WCAG axe.
// ============================================================================

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

function verifySecurityHeaders(headers: Record<string, string>) {
  expect(headers["content-security-policy"]).toContain("script-src");
  expect(headers["content-security-policy"]).toContain("style-src");
  expect(headers["content-security-policy"]).not.toContain("'unsafe-inline'");
  expect(headers["x-nonce"]).toBeUndefined();
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["permissions-policy"]).toContain("geolocation=(self)");
  expect(headers["cross-origin-opener-policy"]).toBe("same-origin");
  expect(headers["cross-origin-resource-policy"]).toBe("same-origin");
  expect(headers["x-dns-prefetch-control"]).toBe("off");
}

async function verifyCoreResidentFlow(page: Page) {
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Urban Air Quality Assistant",
  );
  await expect(page.getByRole("alert").first()).toContainText("Severe Winter Smog Emergency");

  const combobox = page.getByRole("combobox", { name: "Search city" });
  await expect(async () => {
    await combobox.focus();
    await combobox.fill("Coimbatore");
    await expect(
      page
        .getByRole("listbox", { name: "Matching cities" })
        .getByRole("option", { name: /Coimbatore/i }),
    ).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 15_000 });
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(page.locator("#dashboard-heading")).toContainText("Coimbatore");

  await page.getByRole("button", { name: "Delhi", exact: true }).click();
  await page.getByRole("button", { name: "Show data table", exact: true }).click();
  await expect(page.getByRole("table").first()).toBeVisible();

  await page.getByLabel("Household member / persona").selectOption("asthma");
  await expect(page.locator("#guidance")).toContainText("N95/FFP2");

  await page.getByRole("button", { name: "Cycle", exact: true }).click();
  await expect(page.getByRole("button", { name: "Cycle", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await page
    .getByRole("button", { name: /How should my family handle winter smog today/i })
    .click();
  await expect(page.locator("#assistant")).toContainText("224");

  await page.getByLabel("Add city to comparison").selectOption("london");
  await page.getByRole("button", { name: "Add city", exact: true }).click();
  await expect(page.locator("#compare")).toContainText("London");
}

async function verifyLocaleReloadCycle(page: Page) {
  await page.getByLabel("Language").selectOption("hi");
  await expect(page.locator("html")).toHaveAttribute("lang", "hi");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("शहरी वायु गुणवत्ता सहायक");
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator("html")).toHaveAttribute("lang", "hi");

  await page.getByLabel("भाषा").selectOption("ta");
  await expect(page.locator("html")).toHaveAttribute("lang", "ta");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("நகர்ப்புற காற்றின் தர உதவியாளர்");

  await page.getByLabel("மொழி").selectOption("en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
}

async function verifyResilienceAndViewport(page: Page) {
  let mode: "ok" | "rate_limit" | "offline_err" = "ok";
  await page.route("**/api/air-quality*", async (route) => {
    if (mode === "rate_limit") {
      await route.fulfill({
        status: 429,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "RATE_LIMITED", retryAfterSeconds: 22 } }),
      });
      return;
    }
    if (mode === "offline_err") {
      await route.abort("failed");
      return;
    }
    const demoResp = await route.fetch({
      url: route.request().url().replace("demo=false", "demo=true"),
    });
    await route.fulfill({ response: demoResp });
  });

  await page.getByRole("switch").click();
  await expect(page.locator("#dashboard-heading")).toContainText("Delhi");
  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem("urban-air:last-snapshot:v1")))
    .not.toBeNull();

  mode = "offline_err";
  await page.getByRole("button", { name: "Coimbatore", exact: true }).click();
  await expect(page.locator('[role="status"]').filter({ hasText: /Offline mode/i })).toBeVisible();

  mode = "rate_limit";
  await page.getByRole("button", { name: "Mumbai", exact: true }).click();
  await expect(
    page.locator('[role="alert"]').filter({ hasText: /Too many requests right now/i }),
  ).toContainText("22 seconds");
  await page.unroute("**/api/air-quality*");

  await page.getByRole("switch").click();
  await expect(page.getByRole("switch")).toHaveAttribute("aria-checked", "true");

  await page.setViewportSize({ width: 320, height: 640 });
  const hasOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasOverflow).toBe(false);
}

test("verifies security headers, zero console errors, resident workflows, and offline resilience", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => pageErrors.push(err.message));
  await page.addInitScript(() => {
    window.addEventListener("securitypolicyviolation", (event) => {
      window.__cspViolations = [
        ...(window.__cspViolations ?? []),
        `${event.violatedDirective}:${event.blockedURI}`,
      ];
    });
  });

  const response = await page.goto("/", { waitUntil: "networkidle" });
  expect(response).not.toBeNull();
  verifySecurityHeaders(response?.headers() ?? {});
  await verifyCoreResidentFlow(page);
  await verifyLocaleReloadCycle(page);
  expect(consoleErrors).toEqual([]);
  await verifyResilienceAndViewport(page);

  expect(await page.evaluate(() => window.__cspViolations ?? [])).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test("Accessibility audit: has zero axe-core WCAG 2.2 violations in light and dark modes", async ({
  page,
}) => {
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme });
    await page.goto("/");
    await expect(page.locator("#dashboard-heading")).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  }
});

declare global {
  interface Window {
    __cspViolations?: string[];
  }
}
