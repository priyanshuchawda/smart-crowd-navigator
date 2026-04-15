import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("attendee shell has no automated axe accessibility violations", async ({
  page,
}) => {
  await page.goto("/");

  await page
    .getByRole("region", { name: "Quick actions" })
    .getByRole("button", { name: /^Food/i })
    .click();

  const accessibilityScan = await new AxeBuilder({ page })
    .include("main")
    .analyze();

  expect(accessibilityScan.violations).toEqual([]);
});
