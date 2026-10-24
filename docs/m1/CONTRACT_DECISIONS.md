# M1 contract reconciliation and decision record
**Current E2-01 update, 2026-10-23:** E1 is accepted as a local checkpoint. E2 permits explicit traveler-confirmed scheduled meals or clearly costed/unscheduled meals, synthetic service evidence, bounded day utilization and lossless compact input. Historical phase stops below are superseded only within E2; all live and production gates stay held. [E2-01](DECISION_REGISTER.md#13-e2-local-development-authorization) records authority. Necessary portions and PD-01–PD-04 are unchanged.


Date: 2026-10-22. Authority: the user's M1 approval and later scoped authorizations. This records historical documentation and isolated synthetic feasibility work, not M2/production implementation. DEVB1-01/DEVB2-01 established the reported core/editing preview; current [DEVB3-01](DECISION_REGISTER.md#9-controlled-local-phase-b3-authorization) permits synthetic mock AI recommendation readiness, preserving those contracts, then a stop after B3 for review. Curator 20+ hours/week is confirmed; independent reviewer remains unassigned and sustainable capacity unproven. [PRD](../PRD.md) owns behavior; [Data Model](../DATA_MODEL.md) owns schemas. No real source is independently approved here.

**2026-10-23 product decision update:** PD-01–PD-04 directions and Option A remain approved only within the [decision register](DECISION_REGISTER.md) boundaries. Competent measurement/access, independent real taxonomy/classification/source review, rights, staffing capacity, storage and live runtime evidence remain pending. Historical DEVA-01/DEVB1-01/DEVB2-01 record local Phase A/B1/B2; current DEVB3-01 permits versioned mock ranking/allowlists, checked reasons and deterministic fallback while preserving all core/edit/history/lock contracts and ceilings. Retain historical [B1](../../README.md#phase-b1-results)/[B2](../../README.md#phase-b2-results) evidence separately from actual B3 results; stop after B3 for review. No real AI/provider configuration, authentication, production saving, editorial administration or held external action is authorized. M1 stays OPEN; M2 acceptance is not granted.

## C-01 — Necessary meals cannot be excluded by changing budget scope

E2 local scheduling supplement: unscheduled is explicit and compatible with complete cost coverage. A requested slot requires the traveler's confirmed window plus applicable service duration, location, exact portions/source, suitability, charge and route evidence. A culinary visit alone proves no meal fulfillment. Provided/prepaid quantities exempt only exact purchase costs, never diet/access/scheduling checks. Known contradictions block; missing essential evidence yields draft. Additional service charges remain separate ledger rows, including explicitly evidenced fixture zero or unknown null. No universal meal clock or new food-venue repetition policy is introduced. Real methods and service proof still require scoped human review.

**Change:** Remove `explicit_out_of_budget_scope` and generic meal exclusion from the schema. All necessary meals remain budgeted except specifically documented traveler-provided or prepaid portions. A culinary opt-out, free day, short window, missing food venue or low budget never removes necessary food costs.

For each day, record the confirmed necessary meal inventory and anonymous party portions. For each meal, the required portions equal disjoint included portions plus explicitly exempt provided/prepaid portions. Included portions need a sourced cost or reviewed deterministic allowance, even if no venue is scheduled. A partial exemption leaves the remaining portions, mandatory taxes/drinks/charges and other necessary purchases budgeted. Exemption records contain basis, scope, quantities, declaration and confirmation, not receipts or names.

Provided/prepaid means no additional modeled purchase for those declared portions. Show it as a traveler assumption with an exemption reason, never as a zero verified destination price. Sum remaining included activity/meal/local-transport costs, then add 10% contingency rounded upward in integer rupiah. Unknown required upper bounds propagate to unknown total and draft status; a known excessive upper total is blocked. `included_in_budget=false` cannot be a general user or model escape hatch: necessary food requires the explicit exemption contract, and required activities/transport remain included.

**Rationale:** PRD and User Flows already promised provided/prepaid exceptions; the former schema's general out-of-budget exception weakened that promise. The user's M1 instruction resolves the conflict explicitly.

**Tests:** absent allowance; unscheduled meal; partial party exemption; unconfirmed exemption; duplicate portion; prepaid with remaining mandatory charge; free day with meals; general exclusion rejected; unknown never zero; total/contingency arithmetic.

**PD-01 — product direction APPROVED 2026-10-23:** confirm the daily necessary-meal inventory, including partial arrival/departure days, exact provided/prepaid portions and explicit coverage of every remaining necessary purchase/charge. Suggested breakfast/lunch/dinner rows prompt confirmation and additional necessary occasions; they do not invent nutritional needs, child portions or a universal snack rule. No generic exclusion or default of “zero necessary meals” may establish feasibility. Incomplete/unconfirmed inventory stays draft. Real tariffs/allowance methods and portion/charge evidence remain pending; synthetic fixtures do not approve them.

## C-02 — Walking is a complete per-traveler daily upper bound

**Change:** Express limits in integer meters: relaxed 2,000, balanced 4,000, active 8,000 per traveler/day, alongside 3/4/5 stop caps. Retain the baseline's reducible user limits. The same rule applies to walking, private-car and taxi/ride-hail plans.

Daily walking includes walking route legs, venue interiors, walking transfers, pickup/drop-off or parking access, rest connectors where planned, and origin/end-anchor connectors. A routed span that already includes an entrance connector must not be counted again. Distinct occurrences of the same physical route do count separately. Driving meters are not walking meters. Compare the sum of conservative upper bounds against the cap; do not multiply by party size. A common group itinerary uses the strictest declared traveler limit, without collecting names or health histories.

Each component records scope/endpoints, occurrence, lower/upper meters, source/estimate policy, observation/review state, applicability and permitted retention. Do not derive venue walking from dwell time, straight-line proximity or an AI guess. Distance does not prove step-free access, safe pedestrian passage or time required; those have separate evidence and timing checks. Unknown required components make walking compliance unproven and the plan draft. Known excessive totals are blocked.

Changing an entrance, anchor, mode, order or departure assumption invalidates affected walking and travel evidence. Extra provider calls needed to measure access segments consume the same 42-computation envelope; labeling them connectors does not create free calls. Independent approved access measurements can avoid an extra provider call, but are not available merely because a fixture supplies them.

**Rationale:** The baseline declared daily walking limits but had no schema for interior/access distances. Ignoring those distances particularly overstates feasibility for driving plans and travelers with mobility limits.

**Tests:** exact cap and one meter over; unknown interior; car distance excluded; taxi access included; return anchor included; duplicate span within one occurrence rejected; repeated occurrence counted; group total not multiplied; separate accessibility failure.

**PD-02 — product direction APPROVED 2026-10-23:** retain 2,000/4,000/8,000-meter walking presets and existing3/4/5-stop pace caps. Actual measurement methodology, uncertainty bounds, access-point scope and accessibility suitability still require competent human review. Numeric policy approval and synthetic success do not establish physical calibration or safety.

## C-03 — Mandatory interests are explicit trip-wide coverage requirements

**Change:** Keep soft preferences separate from `request_mandatory_interests`. Every explicitly mandatory cultural category requires at least one eligible scheduled visit across the trip. This is not a distinct-venue-per-category requirement; any multi-category match needs each assignment reviewed. MVP scope is trip-wide with a minimum of one; user-defined per-day quotas are outside this clarification.

An eligible approved category assignment is required, tied to its taxonomy version, assertion, current review and field-head revision. A multi-category venue can satisfy several requirements only with a reviewed assignment for each. A category assignment is an editorial classification, not proof of a formal heritage designation. Unscheduled alternatives, AI tags and the generic daily cultural/culinary minimum cannot satisfy a specific mandatory interest.

Daily opt-outs/free days do not remove trip-wide requirements. A known unmet required category is blocked; insufficient classification evidence yields draft. Only an explicit new request can remove/alter the requirement. Explain the missing category and preserve other hard requirements/locks.

**Rationale:** The PRD allowed interests to become mandatory but did not say what their satisfaction meant or store them separately. A trip-wide minimum adds the least additional behavior consistent with that baseline.

**Tests:** soft miss allowed with explanation; mandatory miss blocked; unknown assignment draft; unscheduled-only match rejected; multi-category venue requires each assignment; free-day flag cannot remove a trip requirement; city mismatch rejected.

**PD-03 — product direction APPROVED 2026-10-23:** trip-wide fulfillment requires at least one eligible scheduled visit per mandatory cultural-interest category. Real taxonomy definitions, overlapping category assignments and individual place classifications remain pending independent cultural review. No real category or assignment is approved by this decision or the M1 desk audit.

## C-04 — Authoritative current assertion/review selection

**Change:** Add explicit `catalogue_field_heads`, append-only `field_head_events` and monotonic per-assertion review sequence. Identity/location convenience pointers mirror these heads. Timestamps, model confidence and “latest verified” queries cannot decide authority.

1. Resolve the exact place/city, field and applicability scope. Tariff components and date-applicable schedules have explicit scopes; conflicting alternative scopes cannot be silently combined.
2. Read the publication head and its revision. A missing/withdrawn head is unavailable. An unpublished replacement draft does not advance it.
3. Resolve the selected immutable assertion and its current authorized review sequence. New current unknown/conflicted/withdrawn evidence overrides the old verified result. The review chain cannot fork or supersede another assertion's event.
4. Evaluate rights, publication, source revocation, current review state, freshness at evaluation time and applicability to the actual travel date. An expired current value is stale, not permission to fall back. A missing date-specific exception stays unknown.
5. Pin head revision, publication revision, assertion, review sequence and exact source/policy dependencies in candidates and validation results.
6. At result commit, check the pinned revisions and eligibility atomically against the same city/ownership-bound transaction. A changed head returns stale-evidence/revalidation. On read, expiry/revocation invalidates a previous result immediately, without waiting for a batch job.
7. Keep lawful historical references only as history; suppress withdrawn content in current traveler views. Reinstatement needs an explicit authorized review/activation with a reason. It cannot happen through a fallback query.

A human reviewer distinct from the author approves contributions. An authorized urgent withdrawal can fail closed immediately while a replacement awaits review. Source fetching, AI desk research and publication of identity do not approve other fields. A newer unreviewed draft does not automatically destroy valid current evidence; a known change/revocation must be recorded as an invalidation, not left as a harmless draft.

**Rationale:** The original schema described current pointers but did not choose between competing/superseding assertions or concurrent reviews. An explicit head and review chain prevent accidentally resurrecting old verified facts.

**Tests:** latest current unknown beats older verified; expired current cannot fall back; unpublished draft leaves current head; source revocation invalidates immediately; wrong-place review and review forks rejected; equal timestamps do not determine authority; precommit head race rejected; future-date overlap conflicted.

**Pending implementation proof:** PostgreSQL constraints, transactional publication/RLS, race tests and restore behavior. Local in-memory tests demonstrate the rule only.

## C-05 — Work and money ceilings are independent

Retain 42 final route computations, 800 matrix elements across at most two matrix requests, two total AI attempts, 45 seconds and USD 1 per paid planning operation. These are maxima, not a promise that every maximal workload can finish successfully or fit the money limit. All attempts count, including failed/retried/recalculated legs and additional access routing. Independent user edits can start a separately admitted operation; an automatic retry cannot reset the current operation's counters.

Seven five-stop days require 42 initial endpoint/adjacent legs, leaving no headroom for one retry or changed departure. Return a truthful draft/resource-limit result and preserve prior work; never claim recovery within the same cap by ignoring the 43rd attempt. Optional matrices may be omitted/pruned. Provider-specific limits can be stricter than app limits.

**PD-04 — Option A APPROVED 2026-10-23:** retain 1–7-day support, all current ceilings, all hard requirements/locks and maximum five stops/day under existing pace caps. Prefer sparse routing and lower density where feasible; disclose limited recovery headroom at maximum density. Never silently relax traveler constraints. No lower supported duration/density or larger route/budget/runtime ceiling is selected. Real route/access/provider/runtime evidence and technical parameters remain pending. See [sparse routing](SPARSE_ROUTING_DESIGN.md) and the still-unapproved [live-test proposal](LIVE_TEST_PROPOSAL.md).

## Change map and evidence classification

| File | Change and rationale |
| --- | --- |
| PRODUCT_BRIEF | Meal exemption scope, complete walking and mandatory-interest promise; records approved M1 boundary |
| PRD | Exact meal/walking/interest/current-evidence rules and acceptance extensions; no unsupported verification claims |
| USER_FLOWS | Intake/review/edit shows exemptions, walking bounds and mandatory-category coverage; editorial head advancement is explicit |
| ARCHITECTURE | References authoritative selection and complete distance/interest checks; records 42-route recovery constraint and conditional provider rights |
| DATA_MODEL | Removes broad meal exclusion; adds portion exemptions, walking metrics/limits, category requirements/coverage and authoritative publication heads/review ordering |
| ROADMAP | M0 direction approved, M1 open under limited authorization; explicit M1 gates and stop before M2 |
| AGENTS | Replaces obsolete planning-only restriction with the actual M1 scope and continuing external-action restrictions |

Contract definitions are local engineering decisions derived from the approved direction. Real catalogue facts, source rights, independent review, named operational commitments, hosting configuration and live performance remain separate evidence gates. No code or documentation here authorizes paid calls or provisions a service.
