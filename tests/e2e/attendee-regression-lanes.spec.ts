import { expect, test } from "@playwright/test";

test("attendee flow keeps chat, maps, and group-plan lanes working together", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByLabel("Party Size").fill("5");
  await page.getByRole("button", { name: /^Food/i }).click();

  await expect(page.getByText("Group coordinator plan")).toBeVisible();

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
              "Backed by high-confidence live telemetry.",
            ],
            tradeoffs: ["Queue is still meaningful even on the best route."],
          },
          groupPlan: {
            workflowType: "meet-up",
            headline:
              "Regroup first, then move together on the step-free route.",
            regroupSpot: "Concourse Center",
            regroupEtaMinutes: 4,
            splitRecommended: false,
            steps: [
              "Bring everyone together at Concourse Center.",
              "Take the calmer shared route to Exit South.",
            ],
          },
          operationalAdvisory: {
            headline: "All exits are under heavy load.",
            detail:
              "Every exit is currently congested, so the safest move is to hold position briefly and avoid pushing into the crowd peak.",
            recommendedAction:
              "Hold position, regroup near Concourse Center, then retry the exit flow in a few minutes.",
            severity: "warning",
          },
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
  await expect(page.getByText("Group coordinator plan")).toBeVisible();
  await expect(
    page.getByText(/Regroup first, then move together/i),
  ).toBeVisible();
});
