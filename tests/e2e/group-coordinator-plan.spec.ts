import { expect, test } from "@playwright/test";

test("larger food groups get a visible group coordinator plan", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByLabel("Party Size").fill("5");
  await page.getByRole("button", { name: /^Food/i }).click();

  await expect(page.getByText("Group coordinator plan")).toBeVisible();
  await expect(
    page.getByText(
      "Send one runner while the rest of the group holds position.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByText(/Regroup at Section A-12/i).first(),
  ).toBeVisible();
});
