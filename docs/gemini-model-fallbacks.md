# Gemini Model Fallbacks

## Default order

Smart Crowd Navigator keeps this model order for standard assistant requests:

1. `gemini-3.1-flash-lite-preview`
2. `gemini-3-flash-preview`
3. `gemini-2.5-flash`

## Why this order

- **`gemini-3.1-flash-lite-preview`** stays first because it has the higher-limit
  footprint the project prefers for normal operation.
- **`gemini-3-flash-preview`** is the first fallback when the primary model hits
  transient high-demand or availability issues.
- **`gemini-2.5-flash`** is the final fallback when the newer flash models are
  temporarily unavailable.

## Retry boundary

The fallback chain is only used for retry-worthy provider pressure errors, such
as:
- HTTP `429`
- HTTP `503`
- temporary availability / high-demand responses

It is **not** used for non-retryable issues like:
- invalid credentials
- malformed requests
- deterministic application-level validation failures

## Important rule

Model fallback changes **which Gemini model answers the request**, but it does
not change the product's source of truth for routing/timing:
- deterministic recommendation payloads still come from the venue engine
- Gemini still only explains or grounds those results
