import { expect, test } from "@playwright/test";

test.describe("Urban Air Quality Assistant E2E flow", () => {
  test("verifies security headers, zero console errors, full resident workflow, and keyboard nav", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });
    page.on("pageerror", (err) => {
      pageErrors.push(err.message);
    });

    const cspViolations: string[] = [];
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
    const headers = response?.headers() ?? {};
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

    // Ensure main purpose is visible immediately
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Urban Air Quality Assistant",
    );
    await expect(page.getByRole("alert").first()).toContainText("Severe Winter Smog Emergency");

    // 1. Search city via keyboard-only combobox flow
    const combobox = page.getByRole("combobox", { name: "Search city" });
    await combobox.focus();
    await combobox.fill("Coimbatore");
    await page
      .getByRole("listbox", { name: "Matching cities" })
      .getByRole("option", { name: /Coimbatore/i })
      .waitFor({ state: "visible" });
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(page.locator("#dashboard-heading")).toContainText("Coimbatore");

    // Switch back to Delhi via quick chip to verify smog guidance + planner
    await page.getByRole("button", { name: "Delhi", exact: true }).click();
    await expect(page.locator("#dashboard-heading")).toContainText("Delhi");

    // 2. Toggle forecast table view
    await page.getByRole("button", { name: "Show data table", exact: true }).click();
    await expect(page.getByRole("table").first()).toBeVisible();

    // 3. Change persona
    await page.getByLabel("Household member / persona").selectOption("asthma");
    await expect(page.locator("#guidance")).toContainText("N95/FFP2");

    // 4. Activity planner
    await page.getByRole("button", { name: "Cycle", exact: true }).click();
    await expect(page.getByRole("button", { name: "Cycle", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    // 5. Ask AI Assistant (zero-key deterministic fallback)
    await page
      .getByRole("button", { name: /How should my family handle winter smog today/i })
      .click();
    await expect(page.locator("#assistant")).toContainText("224");

    // 6. Compare 3rd city
    await page.getByLabel("Add city to comparison").selectOption("london");
    await page.getByRole("button", { name: "Add city", exact: true }).click();
    await expect(page.locator("#compare")).toContainText("London");

    // 7. Language toggle persistence across full reload (Hindi -> reload -> Tamil -> English)
    await page.getByLabel("Language").selectOption("hi");
    await expect(page.locator("html")).toHaveAttribute("lang", "hi");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("शहरी वायु गुणवत्ता सहायक");
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.locator("html")).toHaveAttribute("lang", "hi");

    await page.getByLabel("भाषा").selectOption("ta");
    await expect(page.locator("html")).toHaveAttribute("lang", "ta");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "நகர்ப்புற காற்றின் தர உதவியாளர்",
    );

    await page.getByLabel("மொழி").selectOption("en");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    expect(consoleErrors).toEqual([]);

    // 8. Check 429 rate-limited banner and cached offline snapshot resilience in Live Mode
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
    await expect(page.getByRole("switch")).toHaveAttribute("aria-checked", "false");
    await expect(page.locator("#dashboard-heading")).toContainText("Delhi");
    await expect
      .poll(() => page.evaluate(() => window.localStorage.getItem("urban-air:last-snapshot:v1")))
      .not.toBeNull();

    mode = "offline_err";
    await page.getByRole("button", { name: "Coimbatore", exact: true }).click();
    await expect(
      page.locator('[role="status"]').filter({ hasText: /Offline mode/i }),
    ).toBeVisible();

    mode = "rate_limit";
    await page.getByRole("button", { name: "Mumbai", exact: true }).click();
    const rateBanner = page
      .locator('[role="alert"]')
      .filter({ hasText: /Too many requests right now/i });
    await expect(rateBanner).toBeVisible();
    await expect(rateBanner).toContainText("22 seconds");
    await page.unroute("**/api/air-quality*");

    // Switch back to Demo Mode so desktop/mobile view check finishes cleanly
    await page.getByRole("switch").click();
    await expect(page.getByRole("switch")).toHaveAttribute("aria-checked", "true");
    await expect(page.locator("#dashboard-heading")).toContainText("Mumbai");

    // 9. Check zero horizontal overflow at 320px viewport
    await page.setViewportSize({ width: 320, height: 640 });
    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasOverflow).toBe(false);

    const recordedViolations = await page.evaluate(() => window.__cspViolations ?? []);
    expect([...cspViolations, ...recordedViolations]).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});

declare global {
  interface Window {
    __cspViolations?: string[];
  }
}
