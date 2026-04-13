import { expect, test } from "@playwright/test";

test("operator apply change submits the edited draft values", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("summary").filter({ hasText: "Demo Controls" }).click();

  await page.route("**/operator/state", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }

    const payload = route.request().postDataJSON();

    await route.fulfill({
      body: JSON.stringify({
        states: [
          {
            nodeId: payload.nodeId,
            queueMinutes: payload.queueMinutes,
            crowdPenalty: payload.crowdPenalty,
            queueTrendAfterFiveMinutes: payload.queueTrendAfterFiveMinutes,
            serviceMinutesPerAdditionalPerson:
              payload.serviceMinutesPerAdditionalPerson,
          },
        ],
      }),
      contentType: "application/json",
      status: 200,
    });
  });

  await page.getByLabel("Queue minutes").first().fill("9");
  await page.getByLabel("Crowd penalty").first().fill("4");
  await page.getByLabel("Queue trend / 5 min").first().fill("-2");

  const updateRequest = page.waitForRequest(
    (request) =>
      request.method() === "POST" && request.url().endsWith("/operator/state"),
  );

  await page.getByRole("button", { name: "Apply change" }).first().click();

  const payload = (await updateRequest).postDataJSON();

  expect(payload).toMatchObject({
    crowdPenalty: 4,
    nodeId: "stall-b",
    queueMinutes: 9,
    queueTrendAfterFiveMinutes: -2,
  });
});
