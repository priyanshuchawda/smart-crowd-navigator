import { expect, test } from "@playwright/test";

test("maps-grounded answers render citations and widget guidance", async ({
  page,
}) => {
  await page.goto("/");

  await page.route("**/assistant-response", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      status: 200,
      body: JSON.stringify({
        grounding: {
          places: [
            {
              title: "Demo Pickup Zone",
              uri: "https://maps.google.com/?cid=demo",
            },
          ],
          source: "google-maps",
          widgetContextToken: "widget-token",
        },
        message:
          "Use Exit South, then head to the nearby Demo Pickup Zone for the clearest rideshare pickup.",
        recommendation: {
          intent: "exit",
          timingDecision: "go_now",
          waitOrGoReason:
            "Leaving now is still the fastest option once wait time is included.",
          primaryOption: {
            id: "exit-south",
            label: "Exit South",
            kind: "exit",
          },
          primaryReason: "Best total score: 6 minutes.",
          etaMinutes: 3,
          waitMinutes: 3,
          timeSavedMinutes: 0,
          routeSummary: "Section A-12 → South Hall → Exit South",
          crowdWarning: null,
          fallbackOption: null,
          decisionReasons: {
            strengths: [
              "Lower congestion pressure than the main fallback route.",
              "Destination is open and fully available right now.",
            ],
            tradeoffs: ["Queue is still meaningful even on the best route."],
          },
          operationalAdvisory: null,
          confidence: "high",
        },
        source: "gemini",
      }),
    });
  });

  await page
    .getByLabel("Ask the assistant")
    .fill("Where is the best rideshare pickup near the south exit?");
  await page.getByRole("button", { name: "Send question" }).click();

  const groundingRegion = page.getByRole("region", {
    name: "Google Maps grounding",
  });

  await expect(groundingRegion).toBeVisible();
  await expect(
    groundingRegion.getByRole("link", { name: /Demo Pickup Zone/i }),
  ).toBeVisible();
  await expect(page.getByText(/VITE_GOOGLE_MAPS_API_KEY/)).toBeVisible();
});
