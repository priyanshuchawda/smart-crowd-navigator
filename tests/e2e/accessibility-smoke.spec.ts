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
