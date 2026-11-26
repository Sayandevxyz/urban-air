import { expect, test } from "@playwright/test";

test.describe("Urban Air Quality Assistant E2E flow", () => {
  test("verifies security headers, zero console errors, full resident workflow, and keyboard nav", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });
    page.on("pageerror", (err) => {
      consoleErrors.push(err.message);
    });

    const response = await page.goto("/", { waitUntil: "networkidle" });
    expect(response).not.toBeNull();
    const headers = response?.headers() ?? {};
    expect(headers["content-security-policy"]).toContain("script-src");
    expect(headers["content-security-policy"]).not.toContain("script-src 'self' 'unsafe-inline'");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["permissions-policy"]).toContain("geolocation=(self)");

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

    // 7. Language toggle (Hindi -> Tamil -> English)
    await page.getByLabel("Language").selectOption("hi");
    await expect(page.locator("html")).toHaveAttribute("lang", "hi");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("शहरी वायु गुणवत्ता सहायक");

    await page.getByLabel("भाषा").selectOption("ta");
    await expect(page.locator("html")).toHaveAttribute("lang", "ta");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "நகர்ப்புற காற்றின் தர உதவியாளர்",
    );

    await page.getByLabel("மொழி").selectOption("en");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");

    // 8. Check zero horizontal overflow at 320px viewport
    await page.setViewportSize({ width: 320, height: 640 });
    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasOverflow).toBe(false);

    expect(consoleErrors).toEqual([]);
  });
});
