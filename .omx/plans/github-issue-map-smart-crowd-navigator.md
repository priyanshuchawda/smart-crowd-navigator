# GitHub Issue Map: Smart Crowd Navigator

## Labels to Create
- phase:planning
- phase:scaffold
- phase:engine
- phase:api
- phase:web
- phase:operator
- phase:firebase
- phase:polish
- type:doc
- type:feature
- type:test
- type:infra
- priority:p0
- priority:p1
- priority:p2
- status:blocked
- status:ready
- status:in-progress

## Initial Issues
1. Initialize monorepo scaffold and toolchain
2. Add shared package schemas and contracts
3. Implement venue graph fixtures and ranking engine
4. Implement timing advice and fallback logic with unit tests
5. Build assistant API skeleton with structured response schema
6. Integrate Gemini tool-calling flow behind mockable backend boundary
7. Build attendee chat UI shell with quick action chips
8. Render recommendation cards and structured response states
9. Build operator console for live updates
10. Wire live updates into recommendation refresh path
11. Add CI checks for lint/typecheck/test/build
12. Firebase integration placeholder tracking issue (blocked until user provides details)
13. Submission polish: README, demo script, screenshots, final QA

## Workflow Rule
No implementation issue is merged until:
- linked tests pass
- manual verification is recorded
- PR links the issue
- merge happens only after green checks
