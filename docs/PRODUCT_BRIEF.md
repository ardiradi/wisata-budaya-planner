# Product Brief — Wisata Budaya Planner

Current execution: **E2 local development** is authorized under [E2-01](m1/DECISION_REGISTER.md#13-e2-local-development-authorization), following Product Owner acceptance of the E1 local checkpoint. Scope: explicit evidence-bound meal scheduling, honest day utilization, lossless compact recommendation input and local UI/regression verification. Complete ranking, PD-01–PD-04 and all ceilings remain. No live API calls or E3 progression. M1 remains OPEN; M2/production acceptance is not granted. Historical phase descriptions below are retained as history, not new permissions. See the [product audit](PRODUCT_AUDIT.md) and [README](../README.md) for actual execution evidence.

## E2 local traveler contract

The traveler explicitly chooses a short plan or a fuller day within the selected relaxed/balanced/active caps. Density is a preference rather than a minimum; unallocated time and bounded-search limitations stay visible. No input changes automatically to fill a day.

A necessary meal may remain costed but unscheduled, or the traveler may request scheduling with a confirmed window and an explicit synthetic service. The latter requires applicable service, duration, portions, location, suitability and routes; an ordinary food visit alone proves none of these. Provided/prepaid portions exempt exact purchase costs only. Free/partial days keep the complete meal ledger. Real service methods and independent cultural/access/dietary review remain external gates.


Date: 2026-10-23  
Status: PD-01–PD-04 product directions approved; controlled local synthetic Phase B3 AI recommendation and personalization readiness authorized under [DEVB3-01](m1/DECISION_REGISTER.md#9-controlled-local-phase-b3-authorization), following reported B2 review. M1 remains OPEN; M2 acceptance is not granted. Production release and live external integrations remain unauthorized.  
Pilot: Palembang, Indonesia. Architecture and content operations must support adding cities without a city-specific application fork.

## Product intent

Help travelers discover cultural heritage, local traditions, historical places and culinary experiences through personalized itineraries that explain what is known, what is estimated and what still needs confirmation.

The product promise is a useful, editable plan grounded in a maintained destination catalog. It must not imply that an AI-generated answer is evidence. A schedule is useful only when its places exist in the approved catalog, its factual claims have traceable sources, and its hard constraints pass deterministic checks.

Palembang is the initial editorial and operational boundary. This brief does not certify any specific Palembang attraction, historical claim, vendor, price or opening schedule.

## Problem and hypotheses

These are hypotheses to validate through interviews and usability sessions, rather than established market findings:

- Travelers currently assemble cultural context, food choices, opening information, budgets and routes across separate sources.
- Personalized prose alone does not resolve whether a day can actually be completed within opening windows, travel time and budget.
- Clear evidence, freshness and uncertainty labels will help people make better decisions and trust the product appropriately.
- A carefully maintained pilot catalog can create more useful recommendations than a broad but weakly sourced inventory.

The first release should test whether travelers can obtain and understand a feasible plan with sufficiently low editorial and provider costs. It is not a test of unrestricted destination knowledge.

## Users and jobs to be done

| Persona hypothesis | Situation and goal | Product implications |
| --- | --- | --- |
| First-time domestic visitor | Has one or two available days and wants a practical introduction to culture and food. | Indonesian-first language, clear day structure, travel buffers and an understandable total. |
| Cultural explorer | Wants depth and context, with meaningful time at fewer places. | Interest matching, source-backed context, slower pace and editable durations within safe bounds. |
| Small-group organizer | Coordinates companions with a shared budget and different preferences. | Explicit group size and group-total budget; visible hard requirements and explainable tradeoffs. |
| Traveler with strict food or access needs | Must avoid unsuitable venues or physical barriers. | Separate mandatory needs from preferences; missing supporting evidence must exclude a candidate or block completion. |
| Local content steward | Reviews venue identity, claims, hours, prices and usage rights. | Field-level evidence, publication controls, freshness policies, conflict review and an audit trail. |

Do not infer ethnicity, religion, health status or other sensitive attributes from interests or food choices. Ask only for the practical constraint the traveler chooses to provide.

## Proposed pilot experience

1. Select the supported destination and local travel dates; duration is derived from those dates.
2. Set daily available time, party size, total group budget, interests, food preferences and mandatory requirements, transport mode and pace.
3. Review the scope and hard requirements before generation.
4. Receive a plan with scheduled stops, route legs, sourced context, explicit estimates, costs and warnings.
5. Inspect the evidence for any fact, then swap, remove, reorder or lock items.
6. Revalidate every change; sign in to save a private versioned itinerary.

The approved PD-04 direction retains 1–7 inclusive calendar days and at most 5 scheduled venue stops per day, excluding breaks, with all current operating ceilings and hard requirements unchanged. Prefer sparse routing and lower density only where the traveler's constraints and locks remain satisfied. Disclose limited retry headroom at maximum density: seven days at five stops requires 42 initial anchor/adjacent legs, leaving no attempts for retries or additional access computations within the 42-route ceiling. Other proposed intake defaults remain a maximum travel date 90 days ahead and 1–8 travelers. Dates and schedules use the selected city's IANA timezone; Palembang is configured as `Asia/Jakarta`. Each day has an explicit same-day availability window. Budget is a total group amount in IDR covering activities, food and local transport; it excludes accommodation and intercity travel. Validate the upper cost estimate plus a disclosed 10% contingency against that budget. Unresolved defaults and implementation details still need their applicable approval; preserving an operating ceiling does not authorize spending.

Each day must include at least one cultural and one culinary experience unless the traveler explicitly opts out of a category for that day or marks it as a free day. A short window does not justify an empty validated itinerary. Approved PD-01 requires a confirmed daily necessary-meal inventory, including partial arrival/departure days, exact party portions and exact traveler-provided/prepaid portions. All necessary bought portions remain explicitly cost-covered, including unscheduled meals; no generic meal exclusion is permitted. An incomplete or unconfirmed inventory or unknown necessary allowance yields draft. Show exemption declarations and remaining incremental costs; a culinary opt-out or free day never waives meals. Real allowance methods still require scoped human review.

Approved PD-03 requires at least one eligible scheduled visit per mandatory cultural-interest category across the trip. A venue can cover overlapping categories only through independently reviewed assignments; real taxonomy definitions, overlap rules and place classifications remain pending independent cultural review. A generic cultural stop or daily category opt-out cannot silently satisfy/remove a specific mandatory interest. Approved PD-02 retains relaxed/balanced/active limits of 2,000/4,000/8,000 meters per traveler/day and 3/4/5 stops respectively, with user reductions permitted. Count all planned walking, including venue interiors and access connectors in driving plans. Actual measurement methods, uncertainty bounds and accessibility suitability still require competent human review; unknown required distances cannot establish compliance. [M1 contract decisions](m1/CONTRACT_DECISIONS.md) and the [decision register](m1/DECISION_REGISTER.md) record the approved directions and remaining evidence requirements.

Guest generation uses an expiring session with a maximum 24-hour retention. A traveler must authenticate to save a private copy in a new account-owned lineage; the original guest graph keeps its 24-hour expiry. Saving copies only lawful content and confirms permitted coarse/canonical replacements for ephemeral exact-location anchors before revalidation. Walking, private car, and taxi/ride-hail are proposed modes; driving estimates do not guarantee vehicle availability or a live fare. Unsupported transit, river routes and mixed-mode promises are outside the pilot.

## Core scope and boundaries

| In the pilot | Outside the pilot |
| --- | --- |
| Structured intake and preference editing | Booking, reservations, ticket issuance and payments |
| Editorially approved place and food catalog | An open-world chatbot that invents or discovers destinations at generation time |
| Evidence-backed cultural context and venue facts | Unsourced history, AI-written factual embellishment and guessed hours or prices |
| Constraint filtering, deterministic scheduling and cost calculation | Guaranteed availability, safety, food suitability, traffic or total actual spend |
| Route guidance with visible freshness and assumptions | Live tracking, emergency navigation and public transport or river routing |
| Private saved plans with immutable versions | Public sharing, collaborative editing and social feeds |
| Controlled content review, freshness and correction workflows | Public user publishing, vendor onboarding or paid placement |
| Localized, accessible web experience | Native mobile apps, broad language support or national inventory at launch |

## Trust and feasibility contract

Each relevant field has one of five evidence states: `verified`, `estimated`, `unknown`, `stale`, or `conflicted`. Identity, opening hours and historical claims require reviewed source evidence and must never be generated as estimates. A price may be a sourced fact or a deterministic estimate under a reviewed, versioned policy. Visit durations, travel buffers and applicable route or transport estimates are labeled assumptions, not verified facts.

The application must distinguish:

- **Validated:** every modeled hard requirement passes using evidence and disclosed, permitted estimates; all scheduled stops have adequate opening evidence. This is a feasibility result under stated assumptions, not a guarantee of real-world conditions.
- **Draft:** a partial or incomplete plan that cannot yet establish feasibility. A place with unknown opening hours may appear only as an unscheduled suggestion.
- **Blocked:** contradictory input, insufficient eligible options or an unsatisfied hard requirement prevents a complete feasible result. Explain the exact constraint and let the traveler choose any change.

Generation lifecycle (`queued`, `running`, `succeeded`, `failed`, `cancelled`) is separate from these validation statuses. A successfully generated response can still be a draft or blocked result.

AI proposes choices from allowlisted catalog IDs and evidence IDs. Application services select approved source-backed display text, calculate times and costs, and validate the result. Missing evidence must reduce completeness, never cause the model to fill a gap. The system does not silently relax budget, dietary, access or date requirements. Edits preserve the previous valid version.

Routes are valid only for their directed access-point endpoints, transport mode and recorded departure-time assumption/bucket. Reordering or timing changes invalidate affected legs. Provider-using previews, edits and revalidations undergo the same spend admission and per-operation work caps as generation: retained limits are 10 such planning operations per account per rolling 24 hours, or 3 for a guest, plus normal endpoint rate limits. Zero-provider edits may stay outside that cost quota. PD-04 preserves these ceilings; feasibility and paid-integration approval remain pending.

## Success and release decisions

The 30-place M5 catalogue target is retained by the Product Owner; smaller M1 samples do not change launch scope. Other service and evaluation targets below remain subject to their stated evidence and approvals:

| Measure | Pilot acceptance target |
| --- | --- |
| Factual integrity | Every displayed identity, historical assertion, hours value and price has a permitted evidence or estimate reference; zero unsupported factual assertions in the release evaluation set. |
| Feasibility | Every plan labeled validated passes all hard checks on the server; the same holds after edits. |
| Usability | At least 8 of 10 representative moderated participants complete intake, inspect a source and change a stop without facilitator intervention. |
| Trust comprehension | At least 8 of those 10 correctly explain verified facts versus estimates and what validated does and does not mean. |
| Initial coverage | At least 30 unique approved places in total, including at least 10 food venues and spanning at least 3 cultural-interest categories, with sufficient evidence and routes for the agreed golden scenarios. Counts do not replace scenario coverage. |
| Reliability and responsiveness | Meet the PRD's generation completion, timeout, recovery and latency gates under the declared pilot load. |
| Affordability | Enforce provider call and spend limits before calls. Retain Architecture's operating ceilings of USD 1/provider-using planning operation (generation, preview, edit or revalidation), USD 10/day and USD 100/calendar month, with a p95 target ≤USD 0.20 for representative 1-day generations. These are separate from the traveler's IDR itinerary budget. Current-rate/capacity evidence and separate paid-use approval remain pending; preserved ceilings authorize no spending. |

Measure completion and edits using consent-aware, pseudonymous events. Do not treat a blocked outcome caused by honestly missing evidence as a successful validated itinerary. Track the reasons for drafts and blocks to guide catalog work.

## Expansion and operating model

A new city needs a city record and timezone, curated places and category mappings, evidence and freshness rules, reviewed cost policies, provider coverage checks, and its own feasible test scenarios. Editorial publication and engineering release are distinct controls. Adding a city must not bypass the truth contract or require hardcoded city logic.

Assign named owners before launch for product scope, content approval, provider budgets, security incidents and data requests. A correction process must be able to retire a place or claim immediately, suppress withdrawn claims and unusable directions in current presentation, purge affected traveler-facing projections/caches and flag saved plans for revalidation. Preserve only lawful restricted internal history with an explicit withdrawal marker; a historical version must not continue exposing withdrawn content to travelers.

## Principal risks and decisions still open

Sparse or conflicting local data may make plans incomplete; the mitigation is curation and candid uncertainty. Any narrower supported scope requires a separate explicit decision; the retained 30-place M5 target and 1–7-day support are unchanged. Source licenses and provider retention terms may constrain what can be stored or displayed; approve a source register before ingestion. Provider cost, latency and outages may limit usable route coverage; use bounded work, explicit budgets and recoverable failures. Travelers may misread estimates as promises; validate labels with real users.

Pending: remaining intake defaults and service targets, content-source hierarchy/freshness thresholds, actual estimate and walking measurement methods, cultural taxonomy/classification review, provider rights/selection, infrastructure region, retention enforceability and operating capacity. The Product Owner confirmed 20+ curator hours/week in the B2 authorization; the independent reviewer remains unassigned with 0 confirmed hours. Sustainable editorial capacity, backup coverage and actual independent review remain unproven. Geoapify remains a candidate. Paid embedded browser Maps stays disabled pending separate rights/budget approval. Live-test Stage B/C spending and the proposed volatile storage architecture are not approved; storage costs, retention guarantees and privacy implications require review. DEVB3-01 permits a provider-independent mock AI ranker, strict candidate/evidence allowlists, controlled explanations, alternatives and deterministic fallback over the B1 core, preserving B2 explicit previews, locks and immutable history. Ranking never supplies facts or final feasibility. Report three contrasting synthetic examples, structured outputs, rejected output/fallback, categorized adversarial results and actual verification; stop after B3 for Product Owner review. Food-venue repetition remains an unresolved product preference; keep conservative distinct venues pending explicit policy. Real AI/provider configuration, authentication, production saving and editorial administration remain excluded. No paid API calls, credentials, infrastructure provisioning, real traveler data or public deployment is authorized, and M2 acceptance is not granted. See the [decision register](m1/DECISION_REGISTER.md), [PRD](PRD.md), [Architecture](ARCHITECTURE.md), [Data Model](DATA_MODEL.md), [User Flows](USER_FLOWS.md) and [Roadmap](ROADMAP.md).
