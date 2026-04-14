# Maps Grounding Guidance

## Why Maps grounding exists

Smart Crowd Navigator uses a deterministic venue engine for **indoor**
movement decisions, but some attendee questions are better answered with
Google Maps grounding, especially around the venue perimeter.

Examples:
- rideshare pickup after the event
- parking / drop-off context
- nearby landmarks outside the venue
- venue-adjacent food or meeting-point questions

## Decision boundary

### Use the venue engine for
- in-venue food stall choice
- in-venue washroom choice
- best entry gate
- best exit
- wait-vs-go timing decisions
- route summaries inside the venue graph

### Use Google Maps grounding for
- nearby pickup/drop-off context
- parking-related questions
- “nearby” / “outside the venue” place questions
- perimeter guidance that depends on real-world place data

## Current implementation

When the attendee question contains venue-perimeter keywords like:
- `parking`
- `rideshare`
- `pickup`
- `nearby`
- `outside`

the backend can use Gemini Maps grounding and return:
- a normal assistant message
- the deterministic recommendation payload
- optional Maps grounding metadata (`places`, `widgetContextToken`)

## Source-of-truth rule

Maps grounding may supply **nearby place context**, but it does **not**
replace the deterministic indoor recommendation.

Indoor route/timing claims must still come from the venue engine.

## Required environment for location-aware grounding

To give Gemini Maps grounding the venue context, set:

```env
VENUE_CONTEXT_LATITUDE=
VENUE_CONTEXT_LONGITUDE=
```

If those values are absent, the backend can still function, but Maps-grounded
answers are less venue-specific.

## Manual smoke example

Example venue-adjacent question:

> Where is the best rideshare pickup near the south exit after the event?

This is the kind of question that should:
1. keep the indoor recommendation deterministic
2. use Google Maps grounding for nearby place context
3. return grounding metadata for later citation rendering
