# Sparse routing design and work-envelope proposal

Date: **2026-10-23, Asia/Jakarta**. Status: **PD-04 Option A product direction approved; technical policies, provider-use approval and real feasibility proof remain pending**. The original design assessment changed/executed no application, adapter, credentials, service or experiment. Later B1/B2 work and current B3 mock recommendation readiness form a separate local synthetic track, not real provider evidence. Use the [PRD](../PRD.md), [Architecture](../ARCHITECTURE.md), [contract decisions](CONTRACT_DECISIONS.md) and retained 54-test M1 results (workspace-only artifact, excluded from this public repository: `../../experiments/m1/RESULTS.md`). This selects no provider or real feasible itinerary.

The approved direction preserves 1–7 days, all operating ceilings/hard requirements and maximum five stops/day; prefer sparse/fewer stops only when every traveler constraint/lock is satisfied. Seven days at five stops uses 42 initial legs and has no retry/access headroom; disclose this and return an honest resource-limit draft when needed. Production matrix omission, protected pruning and concrete dependency-aware algorithms below remain evidence-dependent proposals. Historical B1/B2 and current [DEVB3-01](DECISION_REGISTER.md#9-controlled-local-phase-b3-authorization) authorize only synthetic local core/editing/mock ranking. B3 ranking and deterministic routing share one 45-second deadline; mock work is not competent measurement, provider rights or live runtime proof.

## 1. Candidate pruning without a paid all-pairs matrix

The paid matrix is optional. Local geometry and taxonomy can choose which candidate sequences to examine; neither proves that a walk, drive, entrance, bridge crossing or pickup is feasible.

1. **Resolve evidence and scope.** Query the selected city's published, current field heads and ordered reviews, lawful locations/access points, date-applicable hours/exceptions, cost bounds and approved category assignments. Apply hard food/access requirements and locks before ranking. A revoked/stale/unknown required field cannot be supplied by AI or replaced with an old verified value. Preserve specific exclusion reasons.
2. **Protect coverage within the 60-candidate bound.** Select eligible representatives for each mandatory interest and every locked stop before filling remaining slots with soft-interest candidates. Protect the sole eligible match for a requirement. Do not take the nearest 60 and then report a hard requirement as unavailable if an eligible match was discarded by that cutoff. The catalogue query must explicitly check protected coverage; if protected obligations cannot fit within 60, return a candidate-limit explanation. Absence of an eligible match is a real draft/block condition, not permission to remove the requirement.
3. **Build a deterministic local graph.** Rank lawful access-point coordinates by approximate straight-line distance, use stable canonical-ID tie breaking and optionally retain a configurable nearest-neighbor set, initially proposed `K=4`. Sixty nodes with at most four outgoing heuristic neighbors yields at most 240 local directed neighbor entries, with zero provider computations. Preserve separate links needed for protected candidates/anchors even when they are not near neighbors. This is bounded search, not an all-pairs optimality or route-connectivity claim.
4. **Keep geographic alternatives.** Cluster candidates into local areas using independently licensed coordinates and reviewed geography. A river-bank or other barrier annotation can discourage implausible orderings, but geometric proximity cannot establish a crossing. Do not discard a mandatory match merely because it lies beyond a barrier; either prove the necessary final route or explain the gap.
5. **Ask AI only for allowlisted IDs/rankings/reason codes.** Give it approved independent context, preserving the hard-constraint snapshot and protected IDs. Do not give Google routing payloads to the model under an assumed permission. AI ranking is advisory: deterministic code rejects unknown IDs, omissions of mandatory coverage and incompatible selections, and can use the existing deterministic fallback. The total remains at most two model attempts, each within 12,000 input and 2,000 output tokens, including retry/repair.
6. **Create a provisional sequence locally.** Fit reviewed minimum dwell, opening windows, meal/rest coverage, anchors and user locks. Use straight-line distance only for ranking or as a distance lower bound. A travel-time lower bound needs an independently justified mode-specific maximum speed and valid assumptions; without that policy, do not prune a potentially feasible candidate on guessed travel time. Optimistic bounds may reject a provably impossible insertion, but cannot label a sequence validated. Preserve trip-wide mandatory interests, daily cultural/culinary scope, necessary meal portions and the full per-traveler walking budget throughout.
7. **Route only the admitted final sequence.** Request the required exact directed legs plus any indispensable extra access legs. Bind each response to origin/destination access-point identities and coordinate revisions, selected mode, departure assumption/bucket, observation time, expiry and source-use policy. Revalidate hours, cost, walking, access, all hard coverage and evidence heads before commit. A successful matrix element at another departure is not this final-leg proof.

If the local graph cannot find a sequence, report a bounded-search draft and its constraints. Do not claim the request is mathematically impossible simply because a four-neighbor heuristic missed an alternative. A bounded widening pass may use the remaining local candidates without paid work, preserving the same protected obligations and stop/work/time caps.

## 2. Route-attempt arithmetic and reserved headroom

Let `D` be the days with modeled travel and `s_d` the scheduled venue stops on day `d`. Each such day normally requires `s_d + 1` directed legs: start anchor to first stop, adjacent stops and last stop to end anchor. An explicitly free day with no modeled travel contributes zero. A zero-stop non-free day cannot satisfy the requested cultural/culinary experience by vacuity.

The proposed admission invariant is:

```text
B = sum over modeled days (s_d + 1)       nominal initial final-leg attempts
A = additional required provider computations for access/foot connectors
R = additional retry attempts, including failed or uncertain attempts
C = additional computations after route/timing/order/access invalidation

B + A + R + C <= 42 attempted final/access-route computations per operation
```

An initial failed attempt still consumes its position in `B`; retrying it consumes `R`. All failed, timed-out, uncertain and recalculated computations count. A single-leg request is one route computation for this proposal. There is no assumed waypoint batching discount, hidden multi-leg entitlement or counter reset. Matrix requests use their separate request/element limits and SKU units; calling a matrix does not validate departure-sensitive final legs or create route-retry headroom.

| Days | Stops/day | Base attempts `B` | Remaining `42-B`, before access, retries or recalculation | Compatible pace stop ceiling |
| --- | --- | --- | --- | --- |
| 1 | 3 | 4 | 38 | Relaxed, balanced, active |
| 1 | 4 | 5 | 37 | Balanced, active |
| 1 | 5 | 6 | 36 | Active |
| 3 | 3 | 12 | 30 | Relaxed, balanced, active |
| 3 | 4 | 15 | 27 | Balanced, active |
| 3 | 5 | 18 | 24 | Active |
| 7 | 3 | 28 | 14 | Relaxed, balanced, active |
| 7 | 4 | 35 | 7 | Balanced, active |
| 7 | 5 | 42 | 0 | Active |

These are stop-count checks only. The corresponding walking ceilings remain 2,000/4,000/8,000 meters per traveler/day; none of these rows establishes distance, timing, evidence or budget feasibility. Five scheduled stops is a maximum, not a required daily target.

For a prospective seven-day balanced or active request, **four stops/day is the conservative density proposal**, with seven attempts left before other work. Relaxed remains at most three stops/day, leaving fourteen. The engine can prefer fewer stops if every requested requirement and lock still fits. Changing a confirmed explicit stop count, locked stop/order/time or another hard request requires an explicit preview/acceptance; the planner cannot silently downscope it to save calls. Four stops is not a new product limit or a guarantee that seven attempts suffice.

Before initial dispatch, reserve the known `B+A` work and money plus a disclosed recovery allowance. A trial policy could target up to seven additional computations for a seven-day four-stop shape only where access calls have not already consumed that space. If known required access routes consume three calls, only four remain for retry/recalculation. Do not reserve the same headroom twice. If the required work itself exceeds 42, or the requested recovery envelope cannot fit, skip optional work and return the honest resource-limit consequence; never claim validation for unproved legs. A user may expressly accept lower recovery headroom, but that cannot waive required final evidence or permit a 43rd attempt.

Venue-interior walking, parking/pickup access and anchor connectors need independently reviewed, lawful measurement/estimate datasets. They do not become known because the main driving route succeeds. Any provider computation needed to obtain them consumes `A` inside the same 42 cap; missing required bounds remain unknown. Record occurrence and segment scope so a span included in a routed leg is not added again; a second traversal of the same physical span is a new occurrence and does count. These rules are separate from affirmative step-free or dietary evidence.

## 3. Bounded route execution and repair

Keep the 45-second total deadline from server acceptance, including admission, queue wait, AI, routing, scheduling and persistence. Prefer **at most three in-flight route requests per operation** as a trial configuration. A future four-request setting needs provider quota/load evidence; neither setting proves p95 at ten concurrent jobs. All concurrent attempts must have reserved work and spend before dispatch.

Enforce a shared project/provider concurrency and rate limiter as well as per-operation spend/work counters: ten operations at three requests each must not silently become thirty unrestricted provider calls. The global ceiling and token-bucket rate must be chosen from actual approved account quotas and bounded runtime evidence; none is configured or adopted here. Waiting for a shared permit counts inside the original45-second operation deadline and any shorter source expiry. No permit before the deadline means draft/terminal failure, not an unbounded queue or new allowance.

Use monotonic elapsed time for the operation deadline and trusted UTC with a validated uncertainty margin for source/object expiry. Recheck the effective minimum at dispatch, response acceptance and commit. Ignore/purge late content, retain uncertain charges, and do not reset time when work changes processes. This also applies to stored bucket evidence and the proposed [short-retention boundary](SHORT_RETENTION_DESIGN.md).

Use dependency-aware waves. Days can progress independently when their start times and anchors are fixed. Within a day, the next traffic-sensitive departure depends on the previous route and visit, so do not dispatch all legs using invented departure times. A supported static/departure-bucket policy may allow safe batching only when the exact assumptions remain valid and disclosed. Otherwise advance each day's dependency chain and parallelize across days, up to the operation bound and shared project admission.

Allow **at most two route/schedule cycles**: initial final-leg computation, then one deterministic repair/revalidation cycle for affected legs. This is a limit on repair search, not permission to recompute all `B` legs twice. Count every changed-leg request in `C`; downstream departure-bucket shifts can invalidate more routes than the adjacent edges changed by a reorder. If the remaining work, spend or deadline cannot establish the repaired chain, stop with draft and preserve the last valid version.

Retry only a classified transient failure with a remaining attempt, monetary reservation and deadline. Keep uncertain-charge reservations; establish the provider/request outcome or follow an explicitly authorized bounded uncertain-attempt policy before dispatching again. Reconnecting or reading a run must not blindly duplicate an in-flight request. No optional matrix, retry or second model attempt may consume time reserved to terminate safely. Exhaustion, revocation or missing data stops new work and returns a precise draft/block/recoverable failure under the existing contracts.

Analytically, a dependency chain of six legs has six serial latency terms even when other days run in parallel. A 35-leg workload with concurrency three has at least `ceil(35/3)=12` service slots in the ideal independent case; actual dependency constraints, provider throttling and tail latency can add more. These are count bounds, not seconds or SLO evidence. The retained benchmark's 2,230/8,710 ms provider timelines were injected and its local JS p95 measurements are not network/deployment evidence. No experiment was rerun for this document.

## 4. Cost envelope: separate units and skip unaffordable optional work

The following reuses the **2026-10-22 documentation check**, not a new tariff or billing-account verification: first paid global Essentials input USD0.005 per route request/matrix element, Pro USD0.01. Traffic-aware options can change SKU eligibility. See the existing [priced trial proposal](LIVE_TEST_PROPOSAL.md), [Google pricing](https://developers.google.com/maps/billing-and-pricing/pricing) and [Routes billing rules](https://developers.google.com/maps/documentation/routes/usage-and-billing). Apply approved current account/SKU rates and tax/FX margins before any separately authorized live work; assume no credits or free allowance.

| Work shape | Essentials arithmetic | Pro arithmetic | Scope |
| --- | --- | --- | --- |
| 6 route attempts | USD0.03 | USD0.06 | One day at five stops, before access/retry/AI |
| 35 route attempts | USD0.175 | USD0.35 | Seven days at four stops, before access/retry/AI |
| 42 route attempts | USD0.21 | USD0.42 | Full route envelope; no route headroom remains |
| 25 matrix elements | USD0.125 | USD0.25 | For example one 5x5 matrix; optional |
| 50 matrix elements | USD0.25 | USD0.50 | Two 5x5 attempts including retry, not 50 HTTP requests |
| 400 matrix elements | USD2.00 | USD4.00 | One 20x20 attempt already exceeds USD1 |
| 800 matrix elements + 42 routes | USD4.21 | USD8.42 | Work ceilings cannot be assumed affordable together |

Matrix policy remains at most two requests, each within 20 origins x 20 destinations, and at most 800 cumulative elements including retries, subject to stricter provider limits. Sparse design defaults to **no paid matrix**. If a small matrix has a demonstrated ranking purpose, price its elements and any retry separately after required final/access routes, recovery and nonzero model allowance are reserved. Skip it when that complete reservation does not fit USD1 or the remaining deadline. Fifty Pro elements plus 42 Pro routes already total USD0.92 before AI, taxes and other exposure; that is not a safe presumed budget fit.

The complete exposure is `route attempts x applicable rate + matrix elements x applicable rate + model token/cache/processing exposure + other admitted provider work + approved tax/FX margin`. Model cost is never zero merely because it is small; the existing proposal's model candidate and cache/processing rates remain conditional. Use rational per-million token rates and round the aggregate attempt reservation upward to integer microUSD, without truncating sub-microUSD token prices. All failed/uncertain attempts remain counted. USD1 per operation, USD10 per configured project calendar day and USD100 per month remain independent limits shared with admitted provider work. A cheaper sparse request does not raise any of them. Paid embedded browser Maps remains outside this server-controlled guarantee and disabled pending separate rights and budget decisions.

## 5. PD-04 selected direction and unselected alternatives

| Option | Effect | Decision boundary |
| --- | --- | --- |
| **A — Keep full 1–7-day intake and sparse preferred density** | Preserve current inputs, all operating ceilings, hard requirements and max five stops/day. Prefer sparse routing and lower density where feasible; disclose limited retry headroom for maximum-density itineraries. No silent constraint relaxation. | **Product direction approved by the Product Owner on 2026-10-23.** The four-stop seven-day heuristic, algorithm parameters and execution policies remain proposals. Approval does not establish that all accepted inputs yield validated plans or authorize live work. |
| B — Formally narrow supported duration, density or catalogue geography | Reduce the supported request set to evidence-backed cases and make the narrower coverage explicit before intake. May improve coverage and recovery, but changes the product promise. | **Not selected.** Any future change requires explicit product approval and coordinated PRD/flow/roadmap changes. Do not pretend that three desk audits establish this coverage. |
| C — Raise the route ceiling and/or spend/runtime envelope | Could admit more access calls and repair work. Increases exposure and still does not solve missing evidence or rights. | **Not selected.** Any future increase requires separate product/budget approval after measured provider evidence. |

The approved Option A preserves necessary meal portions/costs, mandatory interests, full walking/access requirements, current authoritative evidence and user locks. It does not replace rights or local route proof. PD-01–PD-03 approve the product contracts, while actual walking methods/uncertainty/accessibility and real taxonomy/overlap/place classifications still need competent independent review.

## 6. Remaining proof before a consuming integration

- **Rights:** positive applicable permission for route-derived schedules, walking totals, cost lines/validation, live display, immutable versions and backups, or an approved independently licensed alternative. The [rights matrix](DATA_USE_RIGHTS.md) currently holds these uses; this algorithm does not remove that gate.
- **Editorial/local:** distinct authorized reviewer, canonical identity and exact mode/access points, date exceptions, costs/necessary meal allowances, scoped dietary/access requirements and independently reviewed interior/access walking measurements. The three [scenario audits](SCENARIO_AUDIT.md) cover research scope; they are not three human-approved feasible days. Three locally reviewed feasible days remain the M5 gate; M1 still needs its reviewed sample and all-mode/barrier capability evidence.
- **Provider/runtime:** separately approved minimal live tests of walking/private-car/taxi directed routes and the barrier case, actual SKU/unit charges, failed/uncertain behavior, departure semantics, concurrency quotas and p95 latency. Decide synchronous execution versus a durable queue from that evidence and the approved runtime/region, rather than the synthetic timeline.
- **Implementation boundaries:** historical B1 established deterministic runtime schemas, constraints/cost/schedules, fixture route bindings and current evidence; B2 added explicit editing/preview/current revalidation and immutable history. Current B3 permits strict mock ranking through a narrow application boundary, preserving those behaviors and every route/work limit. Actual results belong in the [README](../../README.md); this document does not prove all proposed algorithms. Production spend transactions, distributed cancellation/idempotency/leases, privacy/TTL persistence and ownership remain separately authorized obligations.

No additional local experiment is needed to recompute the elementary envelope above. A later explicitly scoped experiment would be justified if a proposed dependency-wave scheduler or protected-candidate search changes the algorithm: it should test adversarial sole mandatory matches, barrier clusters, cascading departure invalidation and remaining deadline/work reservation with synthetic providers. It would still not prove actual route coverage or provider timing. None was run for this original design assessment, and the existing 54-test artifacts remain unchanged. B1 tests belong to the separate application track and must not be reported as reruns of that harness.

Decision log: **PD-04 Option A approved with all scope, hard requirements and ceilings retained.** Optional-matrix omission, protected pruning and dependency-aware waves remain production proposals; provider/live evidence is pending. Historical Phase A/B1/B2 and current [DEVB3-01](DECISION_REGISTER.md#9-controlled-local-phase-b3-authorization) are synthetic preview exceptions. Record actual local results separately and stop after B3 for Product Owner review. M1 remains incomplete; M2 acceptance is not granted. Real AI/provider configuration, authentication, saving, editorial administration and held external steps remain unauthorized.
