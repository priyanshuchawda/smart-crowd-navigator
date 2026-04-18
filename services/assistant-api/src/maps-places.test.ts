import { afterEach, describe, expect, it, vi } from "vitest";

import {
  MapsPlacesError,
  fetchGroundedPlaceEnrichment,
  resolveGoogleMapsApiKey,
  validatePlaceId,
} from "./maps-places.js";

afterEach(() => {
  process.env.GOOGLE_MAPS_API_KEY = undefined;
  process.env.VITE_GOOGLE_MAPS_API_KEY = undefined;
});

describe("validatePlaceId", () => {
  it("accepts valid place ids", () => {
    expect(validatePlaceId("ChIJOwg_06VPwokRYv534QaPC8g")).toBe(
      "ChIJOwg_06VPwokRYv534QaPC8g",
    );
  });

  it("rejects invalid place ids", () => {
    expect(() => validatePlaceId("invalid place id")).toThrow(MapsPlacesError);
  });
});

describe("resolveGoogleMapsApiKey", () => {
  it("prefers GOOGLE_MAPS_API_KEY", () => {
    process.env.GOOGLE_MAPS_API_KEY = "server-key";
    process.env.VITE_GOOGLE_MAPS_API_KEY = "client-key";

    expect(resolveGoogleMapsApiKey()).toBe("server-key");
  });

  it("falls back to VITE_GOOGLE_MAPS_API_KEY", () => {
    process.env.GOOGLE_MAPS_API_KEY = undefined;
    process.env.VITE_GOOGLE_MAPS_API_KEY = "client-key";

    expect(resolveGoogleMapsApiKey()).toBe("client-key");
  });
});

describe("fetchGroundedPlaceEnrichment", () => {
  it("returns normalized place enrichment fields", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          displayName: { text: "Demo Pickup Zone" },
          rating: 4.6,
          regularOpeningHours: { openNow: true },
          userRatingCount: 128,
        }),
        {
          status: 200,
        },
      ),
    );

    const payload = await fetchGroundedPlaceEnrichment("demo-place-id", {
      apiKey: "maps-key",
      fetchImpl,
    });

    expect(payload).toEqual({
      displayName: "Demo Pickup Zone",
      openNow: true,
      rating: 4.6,
      reviewCount: 128,
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://places.googleapis.com/v1/places/demo-place-id",
      expect.objectContaining({
        headers: expect.objectContaining({
          "X-Goog-Api-Key": "maps-key",
        }),
      }),
    );
  });

  it("throws when maps key is not configured", async () => {
    await expect(
      fetchGroundedPlaceEnrichment("demo-place-id", {
        apiKey: null,
      }),
    ).rejects.toMatchObject({
      code: "maps_not_configured",
      statusCode: 503,
    });
  });

  it("throws when upstream places api request fails", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
      }),
    );

    await expect(
      fetchGroundedPlaceEnrichment("demo-place-id", {
        apiKey: "maps-key",
        fetchImpl,
      }),
    ).rejects.toMatchObject({
      code: "places_unavailable",
      statusCode: 502,
    });
  });

  it("throws when upstream response payload is invalid", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ displayName: "bad-shape" }), {
        status: 200,
      }),
    );

    await expect(
      fetchGroundedPlaceEnrichment("demo-place-id", {
        apiKey: "maps-key",
        fetchImpl,
      }),
    ).rejects.toMatchObject({
      code: "places_invalid_payload",
      statusCode: 502,
    });
  });
});
