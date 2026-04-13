import { expect, test } from "@playwright/test";

test("initial attendee route defers operator assets until demo controls open", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("requestfinished", (request) => {
    requests.push(request.url());
  });

  await page.goto("/");
  await page.waitForLoadState("networkidle");

  expect(requests.some((url) => url.endsWith("/operator/state"))).toBe(false);
  expect(
    requests.some(
      (url) => url.includes("OperatorExperience-") || url.includes("firebase-"),
    ),
  ).toBe(false);

  const operatorChunkRequest = page.waitForRequest((request) =>
    request.url().includes("OperatorExperience-"),
  );

  await page.locator("summary").filter({ hasText: "Demo Controls" }).click();
  await operatorChunkRequest;
  await page.waitForLoadState("networkidle");

  await expect(page.getByRole("region", { name: "Operator console" })).toBeVisible();
  expect(
    requests.some(
      (url) => url.includes("OperatorExperience-") || url.includes("firebase-"),
    ),
  ).toBe(true);
});
