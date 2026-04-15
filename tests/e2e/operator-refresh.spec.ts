import { expect, test } from "@playwright/test";

test("operator update refreshes the attendee recommendation", async ({
  page,
  request,
}) => {
  await request.post("http://127.0.0.1:8080/operator/reset");
  await page.goto("/");

  await page
    .getByRole("region", { name: "Quick actions" })
    .getByRole("button", { name: /^Food/i })
    .click();
  await expect(page.getByRole("heading", { name: "Stall B" })).toBeVisible();

  await page.locator("summary").filter({ hasText: "Demo Controls" }).click();
  await page.getByLabel("Queue minutes").first().fill("20");
  await page.getByLabel("Crowd penalty").first().fill("4");
  await page.getByLabel("Queue trend / 5 min").first().fill("0");
  await page.getByRole("button", { name: "Apply change" }).first().click();

  await expect(page.getByRole("heading", { name: "Stall D" })).toBeVisible();
});
