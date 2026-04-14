import { expect, test } from "@playwright/test";

test("quick actions seed the conversation and typed follow-ups stay in the same chat", async ({
  page,
}) => {
  await page.goto("/");

  await page
    .getByRole("region", { name: "Quick actions" })
    .getByRole("button", { name: /^Food/i })
    .click();

  await expect(
    page.getByText(/Find the best food option for SECTION-A12/i),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Stall B" })).toBeVisible();

  await page
    .getByLabel("Ask the assistant")
    .fill("Why is that the best food option?");
  await page.getByRole("button", { name: "Send question" }).click();

  await expect(
    page.locator(".message-bubble.user").filter({
      hasText: "Why is that the best food option?",
    }),
  ).toBeVisible();
  await expect(page.getByText(/Best total score:/)).toBeVisible();
});
