# Verification — 12 October 2026

## Confirmed

- TypeScript check and production build passed.
- Four automated tests passed: recent verified address gating; Unicode email formatting and header-injection rejection; exact evidence matching; restricted source destinations.
- Convex backend and static frontend deployed successfully to `https://tangible-wren-154.convex.site`.
- Production configuration reports research disabled. An unsigned attempt to start research was rejected with “Sign in to continue.” No provider call ran.
- Published page loaded in a browser with 100 companies. Search narrowed the list to Freshworks. Selecting the company showed its sponsor and source context. Email preview opened three editable sequence steps. A changed subject remained when switching away and back. Unverified draft creation was disabled.

## Still requires a real configured account

- Google sign-in and Gmail permission approval.
- Hunter lookup, enrichment and live verification.
- Paid AI generation and resulting source checks across real pages.
- Actual Gmail draft creation, duplicate prevention across concurrent requests and two signed-in users' isolation.

These are implementation paths, not claimed end-to-end passes. The public deployment stays in preview until Google is configured; research additionally stays off until provider access and costs are approved. No real Gmail draft or outbound message was created during this verification.

## Setup checks

The standard skill validator passed after installing its missing PyYAML dependency in a temporary environment. The published page was also inspected at a 390-pixel mobile width; the account browser stacks above the editor and Gmail setup opens the documented preview handoff.
