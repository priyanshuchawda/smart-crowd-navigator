import { expect, test } from "@playwright/test";

test("attendee food flow renders recommendation content", async ({ page }) => {
  await page.goto("/");

  await page
    .getByRole("region", { name: "Quick actions" })
    .getByRole("button", { name: /^Food/i })
    .click();

  const recommendationRegion = page.getByRole("region", {
    name: "Recommendation details",
  });

  await expect(recommendationRegion).toBeVisible();
  await expect(page.getByRole("heading", { level: 2 })).toBeVisible();
  await expect(recommendationRegion.getByText(/Decision/i)).toBeVisible();
  await expect(recommendationRegion.getByText(/Recommended route/i)).toBeVisible();
});
