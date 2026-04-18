import { z } from "zod";

class MapsPlacesError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

type PlaceEnrichmentPayload = {
  displayName?: string;
  openNow?: boolean | null;
  rating?: number;
  reviewCount?: number;
};

type FetchGroundedPlaceEnrichmentOptions = {
  apiKey?: string | null;
  fetchImpl?: typeof fetch;
};

const googlePlaceDetailsSchema = z
  .object({
    displayName: z
      .object({
        text: z.string().optional(),
      })
      .optional(),
    rating: z.number().optional(),
    regularOpeningHours: z
      .object({
        openNow: z.boolean().optional(),
      })
      .optional(),
    userRatingCount: z.number().int().nonnegative().optional(),
  })
  .passthrough();

function normalizeOptionalValue(value: string | undefined) {
  const trimmed = value?.trim();

  if (!trimmed || trimmed.length === 0) {
    return null;
  }

  if (trimmed === "undefined" || trimmed === "null") {
    return null;
  }

  return trimmed;
}

function resolveGoogleMapsApiKey() {
  return (
    normalizeOptionalValue(process.env.GOOGLE_MAPS_API_KEY) ??
    normalizeOptionalValue(process.env.VITE_GOOGLE_MAPS_API_KEY)
  );
}

function validatePlaceId(placeId: string) {
  const trimmed = placeId.trim();

  if (!/^[A-Za-z0-9._:-]{3,200}$/.test(trimmed)) {
    throw new MapsPlacesError(
      400,
      "bad_place_id",
      "Place identifier is invalid",
    );
  }

  return trimmed;
}

async function fetchGroundedPlaceEnrichment(
  placeId: string,
  {
    apiKey = resolveGoogleMapsApiKey(),
    fetchImpl = fetch,
  }: FetchGroundedPlaceEnrichmentOptions = {},
): Promise<PlaceEnrichmentPayload> {
  const validatedPlaceId = validatePlaceId(placeId);

  if (!apiKey) {
    throw new MapsPlacesError(
      503,
      "maps_not_configured",
      "Google Places enrichment is not configured",
    );
  }

  let detailsResponse: Response;

  try {
    detailsResponse = await fetchImpl(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(validatedPlaceId)}`,
      {
        headers: {
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask":
            "displayName,rating,userRatingCount,regularOpeningHours.openNow",
        },
      },
    );
  } catch {
    throw new MapsPlacesError(
      502,
      "places_unavailable",
      "Unable to reach Google Places API",
    );
  }

  if (!detailsResponse.ok) {
    throw new MapsPlacesError(
      502,
      "places_unavailable",
      `Google Places API returned ${detailsResponse.status}`,
    );
  }

  const parsedPayload = googlePlaceDetailsSchema.safeParse(
    await detailsResponse.json(),
  );

  if (!parsedPayload.success) {
    throw new MapsPlacesError(
      502,
      "places_invalid_payload",
      "Google Places API returned an unexpected payload",
    );
  }

  return {
    displayName: parsedPayload.data.displayName?.text,
    openNow: parsedPayload.data.regularOpeningHours?.openNow ?? null,
    rating: parsedPayload.data.rating,
    reviewCount: parsedPayload.data.userRatingCount,
  };
}

export {
  fetchGroundedPlaceEnrichment,
  MapsPlacesError,
  resolveGoogleMapsApiKey,
  validatePlaceId,
};
export type { FetchGroundedPlaceEnrichmentOptions, PlaceEnrichmentPayload };
