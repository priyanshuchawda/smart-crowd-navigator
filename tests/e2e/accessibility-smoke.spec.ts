import { expect, test } from "@playwright/test";

test("attendee shell exposes core accessibility affordances", async ({
  page,
}) => {
  await page.goto("/");

  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toHaveAttribute("href", "#main-content");

  await expect(
    page.getByRole("log", { name: "Conversation transcript" }),
  ).toBeVisible();
  await expect(page.getByRole("textbox", { name: /^Section/i })).toBeVisible();
  await expect(
    page.getByRole("spinbutton", { name: "Party Size" }),
  ).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Group coordination" }),
  ).toBeVisible();

  await page
    .getByRole("region", { name: "Quick actions" })
    .getByRole("button", { name: /^Food/i })
    .click();

  await expect(
    page.getByRole("region", { name: "Recommendation details" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "Stall B" }),
  ).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Recommendation ready.");
});

test("attendee shell surfaces offline mode status", async ({ page }) => {
  await page.goto("/");

  await page.evaluate(() => {
    window.dispatchEvent(new Event("offline"));
  });

  await expect(page.getByLabel("Offline mode")).toContainText(
    "You're offline.",
  );
});

test("attendee shell preserves accessibility when recommendation requests fail", async ({
  page,
}) => {
  await page.goto("/");

  await page.route("**/assistant-response", async (route) => {
    await route.fulfill({
      body: JSON.stringify({ error: "upstream_failed" }),
      contentType: "application/json",
      status: 500,
    });
  });

  await page.route("**/recommendation", async (route) => {
    await route.fulfill({
      body: JSON.stringify({ error: "deterministic_failed" }),
      contentType: "application/json",
      status: 500,
    });
  });

  await page
    .getByRole("region", { name: "Quick actions" })
    .getByRole("button", { name: /^Food/i })
    .click();

  await expect(page.getByText("Request failed with status 500")).toBeVisible();
  await expect(
    page.getByRole("log", { name: "Conversation transcript" }),
  ).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Ask the assistant" })).toBeVisible();
});
