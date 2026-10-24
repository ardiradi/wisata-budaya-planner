# User Flows — Wisata Budaya Planner

Current execution: **E2 local development** is authorized under [E2-01](m1/DECISION_REGISTER.md#13-e2-local-development-authorization), following Product Owner acceptance of the E1 local checkpoint. Scope: explicit evidence-bound meal scheduling, honest day utilization, lossless compact recommendation input and local UI/regression verification. Complete ranking, PD-01–PD-04 and all ceilings remain. No live API calls or E3 progression. M1 remains OPEN; M2/production acceptance is not granted. Historical phase descriptions below are retained as history, not new permissions. See the [product audit](PRODUCT_AUDIT.md) and [README](../README.md) for actual execution evidence.

## E2 local meal and density flow

During daily intake, retain the confirmed necessary-meal inventory. Each occasion defaults to costed but unscheduled. To request a slot, the traveler selects an explicit synthetic service, enters a personal time window and confirms it; no breakfast/lunch/dinner clock is supplied automatically. The result distinguishes scheduled portions, unscheduled portions and unresolved required slots. Draft/blocked explanations preserve the meal ledger and offer input changes for the traveler to choose.

A short plan remains available. Fuller-day selection uses the existing pace limits, explains unused time and why the bounded selector did not add eligible visits. Preference edits show meal/time/route/group-cost consequences before explicit commit. Locks, stale-base rejection, immutable history, current-evidence withdrawal and revalidated revert remain authoritative. No additional meals, venues or food-repeat policy are inferred.


Date: 2026-10-23  
Status: PD-01–PD-04 product directions approved. [DEVB3-01](m1/DECISION_REGISTER.md#9-controlled-local-phase-b3-authorization) authorizes controlled local synthetic Phase B3 AI recommendation readiness, following reported B2 review; M1 remains OPEN and M2 acceptance is not granted. Live integrations and production release remain unauthorized.  
Related requirements: [PRD](PRD.md). Persistence and evidence contracts: [Data Model](DATA_MODEL.md).

## Shared experience rules

Phase A established the traveler-facing shell, B1 the synthetic deterministic core and B2 explicit local editing with immutable in-memory history. Current [DEVB3-01](m1/DECISION_REGISTER.md#9-controlled-local-phase-b3-authorization) permits mock AI ranking and controlled explanations over current hard-filtered synthetic candidates. The deterministic engine still owns schedule, routes, costs, coverage and result status. Every preview distinguishes simulation and preference-match templates from approved facts or independent review. Alternatives never replace committed/locked stops silently: use the existing explicit preview, full validation and commit path. Inputs/results/history remain temporary memory. The real server/provider/persistence/editorial flows below remain target contracts for later review. No real traveler data, paid browser map, real AI/routing call or credential/provider configuration is enabled. Authentication, production saving and editorial administration remain outside B3; stop after B3 for Product Owner review.

During local B3 generation, announce recommendation loading without streaming model facts. Results identify “AI-assisted recommendation — synthetic simulation” or “deterministic fallback,” explain the checked preference reason and show missing evidence separately. Invalid output, unavailable mock AI, timeout or simulated cost denial triggers a bounded fallback where eligible candidates remain; lack of essential evidence still yields draft/blocked. Retry/recovery is explicit and remains inside the unchanged work/time limits. Synthetic assertions must never appear as independently verified cultural context.

All traveler flows use the destination's local timezone, Indonesian-first text and accessible controls. Dates determine duration. Budget is a total group IDR amount for activities, food and local transport, with exclusions visible before submission and beside the result total. Its upper estimate plus a disclosed 10% contingency must fit that budget. Schedule at most 5 venue stops per day, excluding breaks. The traveler sees which inputs are mandatory requirements and which are preferences.

Proposed daily completeness requires one cultural and one culinary experience unless the traveler explicitly opts out of a category for that day or marks it free. Intake confirms each day's needed meals and allowances even for unscheduled meals. Traveler-provided/prepaid meals are explicit assumptions; missing reviewed allowance evidence yields draft. A free day or culinary opt-out does not silently remove necessary meal costs. A window too short for requested experiences yields a truthful draft/block, never an empty validated day.

Provider-using generation, preview, edit and revalidation operations share admission and project budgets. Retained combined rolling-24h limits are 10 per account or 3 per guest, with each operation capped at the same USD 1 reservation, 45-second deadline and AI/route work limits. Zero-provider edits may remain outside that cost quota but retain ordinary endpoint rate limits. Preserving these ceilings does not authorize spending or establish runtime feasibility.

Never force the traveler to infer truth from color, a map pin or polished prose. Show `verified`, `estimated`, `unknown`, `stale` and `conflicted` at the affected value with a readable explanation. The overall itinerary label is separate from the generation job's lifecycle.

No flow silently changes dates, budget, transport, food/access requirements or locks to obtain an apparently successful plan. Suggested changes are previewed and require an explicit traveler action. An error preserves the latest committed version and, within the guest lifetime, entered preferences.

Approved PD-01–PD-03 directions: intake separates soft interests from trip-wide mandatory categories, shows the 2,000/4,000/8,000-meter per-traveler walking presets with 3/4/5-stop pace caps, and confirms each day's necessary meals/portions, including partial arrival/departure days. Only exact documented traveler-provided/prepaid portions are exempt from incremental costs; no generic meal exclusion is available. Results expose all remaining necessary meal costs, walking components/unknowns and at least one eligible scheduled visit per mandatory category across the trip. A generic cultural stop or free-day flag cannot waive a mandatory interest. Measurement methodology, uncertainty bounds and accessibility suitability remain pending competent review; real taxonomy definitions, overlapping assignments and place classifications remain pending independent cultural review. See [contract decisions](m1/CONTRACT_DECISIONS.md) and the [decision register](m1/DECISION_REGISTER.md).

Approved PD-04 Option A retains 1–7-day support, every current operating ceiling and hard requirement, and the five-stop maximum. Prefer sparse routing/lower density only where traveler constraints and locks remain satisfied. Disclose limited retry headroom at maximum density; seven days at five stops consumes all 42 initial route attempts before extra access routes, retries or recalculation. A limit reached produces a truthful draft/block or failure rather than an automatic constraint change. Paid embedded browser Maps stays disabled pending a separate rights/budget decision; text results remain the accessible baseline.

## F-01 — Create a plan as a guest

**Actor:** Traveler.  
**Precondition:** At least one supported destination is available. No account is required.  
**Requirements:** FR-01, FR-02, FR-04–FR-08, FR-12, FR-16.

1. Open the planner. Read the short promise: source-backed places, visible estimates, no bookings, and the guest expiry notice.
2. Select Palembang from the active destination list. Future cities appear through configuration after editorial approval.
3. Select start/end local dates. Show derived inclusive duration, supported horizon and day-by-day availability windows.
4. Enter group size and total group IDR budget. Explain included and excluded categories and quantity assumptions.
5. Choose cultural interests, food preferences, any mandatory food/access requirements, mode and pace. Explain that missing suitability evidence may prevent a matching plan.
6. Confirm each day's start/end anchor, availability, cultural/culinary scope and complete necessary-meal inventory, including partial arrival/departure dates. The user can select an approved anchor; an exact private location is optional. Offer explicit per-day category opt-outs/free days without waiving meals or mandatory trip-wide interests. Confirm exact party portions and exact provided/prepaid portions; cost every remaining necessary portion with sourced prices or reviewed deterministic allowances, including unscheduled meals. Show coverage and incremental-cost assumptions; no generic meal exclusion is offered.
7. Review a compact summary distinguishing hard requirements and soft preferences, daily experience scope, mandatory-category coverage goals, walking limits and confirmed meal inventory/cost coverage. Show provider-processing, usage limits and retention notices before submission, including limited retry headroom for maximum-density requests.
8. Submit once. Receive a job identifier and accessible progress states without fabricated progress percentages.
9. The server validates intake, loads approved candidates and evidence, applies hard filters, admits provider work within budget, requests allowlisted AI selection and runs deterministic planning/validation. Prefer sparse routing/lower density when it satisfies every traveler constraint and lock. AI candidate selection cannot decide facts, route times, costs or validation status. If AI is unavailable or invalid, deterministic candidate ranking provides the fallback under identical evidence rules. All work, retries and fallback share a 45-second total deadline in the proposed synchronous pilot; ceilings are preserved and do not authorize current paid integration.
10. Open the result with an overall status, explanation, daily schedule, cost scope, estimates, sources and edit controls.

**Branches:**

- Invalid date, party, budget or overnight availability: stay on the form, focus the first error and retain valid inputs. No provider call occurs.
- Unsupported/inactive destination: explain availability; do not substitute a different city.
- No catalog data: show a clear unavailable state; do not generate from general model knowledge.
- No eligible candidates after hard filters: return blocked with the relevant requirement and affected categories. Show optional input changes, leaving the original selection intact.
- Incomplete hours/route/price evidence: return draft with explicit gaps. Unknown-hour places may be unscheduled suggestions, never fabricated time slots.
- Incomplete/unconfirmed necessary-meal inventory, including partial days or exact provided/prepaid portions: retain the input and request completion; the plan cannot pass budget validation. Missing cost evidence for any remaining necessary portion yields draft.
- Daily availability cannot fit requested cultural/culinary coverage: show the missing experience and return draft/block. Only an explicit category opt-out or free-day choice changes that requirement. Missing meal allowance evidence also yields draft; never drop meals to fit budget.
- Provider failure, timeout or spend cap: transition to a recoverable failed job or a truthful draft where partial material is useful; preserve inputs. Offer retry only when limits and state allow.

**Postcondition:** An expiring guest plan or a specific blocked/failed outcome exists. The guest can inspect the result without signing in. Durable saving requires authentication.

## F-02 — Understand a result and its evidence

**Actor:** Traveler.  
**Precondition:** A generation job has completed with a result.  
**Requirements:** FR-03, FR-05, FR-06, FR-08, FR-12, FR-16.

1. Read `Validated`, `Draft` or `Blocked` before the day view. Expand a plain-language explanation of feasibility under the displayed assumptions.
2. Inspect a day as an ordered text list. Any future map alternative requires its own approved rights and budget; paid embedded browser Maps is disabled. Each stop exposes time window, estimated visit duration, approved place identity/context, cost basis, travel leg and relevant requirements.
3. Expand a fact or estimate. For a fact, show approved source title/reference, field supported, reviewed/retrieved date and applicable validity. For an estimate, show the method, quantity, range, policy version and limitations.
4. Inspect the budget breakdown: group size, category totals, confirmed daily necessary-meal inventory including partial days, exact provided/prepaid portions, all remaining cost-covered portions, upper-bound subtotal, 10% contingency, final total, remaining budget and excluded categories. Missing values are named rather than zeroed. Inspect each day's experience coverage or explicit opt-out/free-day choice and the eligible scheduled visit covering each trip-wide mandatory category.
5. Inspect route guidance for the selected mode, including directed access-point endpoints, provider freshness, departure assumption/time bucket and approximate travel/buffer assumptions. A driving route does not imply a confirmed vehicle or live fare. Show walking components/unknowns without presenting the approved distance cap as accessibility certification, and disclose remaining recovery headroom for dense schedules.
6. Flag a factual problem using a structured reason. Associate the report with its specific place, evidence and itinerary version; acknowledge receipt without publishing a correction.

**Branches:**

- A source link is unavailable: retain the recorded reference metadata where usage rights permit, show that the link could not be opened, and allow a report. Do not claim a new verification.
- Evidence becomes stale after generation: label the saved snapshot's previous validation date and mark the current plan as requiring revalidation. Do not silently keep a current validated badge.
- Evidence is revoked or directions become unusable: suppress the withdrawn claim/direction immediately in the current view, including historical-version views; show an explicit withdrawal marker and revalidation need. Purge affected traveler-facing projections/caches. Only lawful restricted internal history may retain the withdrawn content.
- Cultural context lacks approved evidence: omit the claim and identify the gap where material; do not ask AI to supply plausible background.

**Postcondition:** The traveler can explain the difference between source-backed facts, estimates and unresolved data. No external navigation is required to understand overall status.

## F-03 — Edit, preview and revalidate

**Actor:** Guest within expiry or authenticated plan owner.  
**Precondition:** A plan version exists.  
**Requirements:** FR-04, FR-06, FR-08, FR-09, FR-12.

1. Choose swap, remove, reorder or lock on a stop, or change a trip input.
2. For a swap, show only city-appropriate options with evidence and mandatory suitability compatibility. Explain any remaining scheduling/cost uncertainty before selection.
3. Make the intended change. Keep the current committed version visible until the preview is complete.
4. Invalidate every affected directed route leg when order, access point, mode or departure bucket changes. Recompute affected routes, times, meal allowances and costs, then rerun complete trip validation against current evidence. Before any provider call, reserve spend and admit the preview/edit/revalidation against the combined planning-operation quota and per-operation caps. Show changed slots, costs, daily experience completeness, new warnings and any invalidated locks.
5. If valid, explicitly apply the preview to create a new immutable version. If draft or blocked, permit saving a clearly labeled draft only if the traveler chooses; never replace a prior valid version implicitly.
6. Offer return to the earlier valid version. Returning creates/selects an auditable version state and reruns current validation, with admission for any provider-using work; old evidence cannot regain current validity by restoring an old snapshot. Withdrawn content stays suppressed in historical views.

**Local B2 interpretation:** the current shell has no guest/account identity, durable save or cross-tab synchronization. Revision conflict checks protect the in-memory session; cross-tab ownership/transaction promises remain future obligations. Labels must say temporary history rather than saved plans. Explicit draft/blocked commits retain the last-valid pointer and every earlier immutable body. No lock or mandatory request can be relaxed to repair an edit.

The local lock control fixes place, date, daily position, start time and dwell duration together; unlock is an explicit previewed command. Reversion restores earlier destinations/order under current preferences, meal inventory and active locks, followed by current evidence/route validation and explicit commit. It cannot silently restore an older budget or remove a newer requirement. Dates and party size stay fixed within a lineage; a new plan requires explicit clear/new submission and fresh meal inventory confirmation. B2 does not add visits or move them between days. These local editing limits do not reduce approved 1–7-day generation scope or other product ceilings.

**Branches:**

- Budget exceeded after reordering: show the upper-bound delta including contingency and affected transport/stop costs. Let the traveler choose a smaller change, higher budget or cancellation.
- Locked stop conflicts with current hours: preserve the lock as an expressed intent, explain the conflict and require an explicit unlock/change; the lock cannot force a validated result.
- Provider call needed for a new leg: admit it within edit limits and show pending preview. Failure leaves the committed version intact.
- Combined daily planning-operation quota or spend reservation exhausted: deny provider work before dispatch, preserve the committed plan and explain the usage limit. A zero-provider edit may proceed under normal endpoint rate limits; it must still pass complete validation before it becomes validated.
- Removal leaves a day without its requested cultural/culinary experience: show a draft/block until an eligible replacement or explicit traveler choice permitted by the daily experience policy resolves the gap. Daily experience opt-outs cannot waive necessary meals or trip-wide mandatory interests.
- Removal loses necessary meal cost coverage: show a draft/block until sourced replacement coverage or a reviewed allowance covers every necessary purchased portion and charge, except exact newly confirmed traveler-provided/prepaid portions. No generic meal exclusion or scope opt-out resolves this gap.
- Removal loses the only eligible scheduled visit for a mandatory trip-wide category: show a draft/block unless an eligible replacement or explicit traveler request revision resolves it. Reviewed overlap assignments, rather than an AI tag, establish multi-category coverage.
- Another browser tab updated the plan: reject the stale base-version commit, reload the latest version and offer a new preview. Do not silently overwrite either change.
- Guest expires during preview: stop durable mutation and explain expiry. Do not create an account or claim the expired plan automatically.

**Postcondition:** All committed versions retain their evidence, input and validation snapshots. An edit cannot skip validation or erase the previous valid version.

## F-04 — Sign in and save a private plan

**Actor:** Traveler.  
**Precondition:** A nonexpired guest plan or an authenticated edit exists.  
**Requirements:** FR-09, FR-10, FR-15.

1. Select Save. Explain that sign-in keeps the itinerary private beyond the guest expiry.
2. Authenticate using the approved authentication method; preserve the pending save reference without exposing it in logs or third-party redirects.
3. Confirm permitted coarse/canonical replacement anchors for any ephemeral exact coordinates. Recheck guest-session authorization, expiry, evidence validity and base version on the server. Use an atomic single-use claim to copy only the lawful graph into a new authenticated account-owned request/plan lineage; do not transfer guest ownership or extend the original graph's 24-hour expiry.
4. Revalidate under the new request and show changes from replacement anchors or current evidence. Save its reviewed status and version. If no permitted saved anchor is available, save only a clearly labeled draft with a location-expired marker; do not copy exact coordinates or derived private routes beyond their TTL.
5. Open My Plans. Show title, city, dates, latest version, validation timestamp and revalidation requirement.
6. On reopening, compare evidence/policy versions and date horizon before representing the plan as currently validated. Preserve original history and offer a new validation version.

**Branches:**

- User cancels authentication: return to the still-valid guest result and expiry notice.
- Session expires, claim token is replayed or a different account attempts the claim: deny it and explain recovery options without disclosing another user's data. The original guest graph retains its expiry after a successful copy.
- Save request is repeated: return the idempotent saved result, without duplicate versions.
- A different owner requests the plan: return an authorization-safe unavailable response; never reveal itinerary content or ownership metadata.

**Postcondition:** A private, owner-authorized plan exists. No public URL or collaboration is created.

## F-05 — Recover from a missing source or API failure

**Actor:** Traveler, assisted by system operations.  
**Precondition:** A request encounters incomplete data, provider failure, quota denial or connectivity loss.  
**Requirements:** FR-07, FR-12, FR-13; NFR-02, NFR-03.

1. Distinguish data incompleteness from a technical failure. Show a specific plain-language reason and whether any reliable partial result is available.
2. For data gaps, identify affected fields/stops and the resulting draft/block. For provider errors, show the failed stage without raw payloads, credentials or internal stack traces.
3. Preserve inputs and the last committed plan. On reconnect, recover the existing job via its scoped identifier rather than automatically starting another billable job.
4. Retry transient provider calls only within the total job retry/time/spend policy. Do not retry invalid user data, unknown place IDs, authorization denials or a hard spend cap blindly.
5. If retry is allowed, expose an explicit retry with current provider/usage admission checks. If not, offer edit inputs, inspect the existing plan, or return later without creating a false itinerary.
6. After recovery, revalidate against current evidence, routes and policies before labeling a result validated.

| Failure | User-visible behavior | Integrity rule |
| --- | --- | --- |
| Model unavailable or invalid response | Retry only within the single aggregate retry and deadline allowance; use deterministic candidate ranking/planning as the baseline fallback. Return a truthful validated/draft/blocked result or recoverable failure within the total 45-second deadline. | The fallback uses the same evidence, allowlist and constraints; never fabricate a response. |
| Routing unavailable for one leg | Identify the leg and keep the current version; a preview remains draft/blocked. | Missing duration cannot become zero; only approved fallback policies apply. |
| Unknown/stale/conflicting hours | Leave the place unscheduled and explain the evidence gap. | No default opening window. |
| Necessary price absent | Show unknown cost and explain the budget cannot be validated. | No default free price or AI price guess. |
| Strict requirement lacks evidence | Exclude the candidate or block that requirement. | No inferred suitability. |
| Provider budget or rate cap reached | Explain temporary capacity/usage limit and preserve work. | No unadmitted paid call or automatic cap increase. |
| Cancellation/timeout | Stop the lifecycle, cease new work and expose safe recovery. | In-flight provider calls may still incur usage; retry does not duplicate completed stages. |

## F-06 — Curate and publish destination evidence

**Actor:** Authorized content steward and reviewer.  
**Precondition:** Editorial roles and source policies are approved.  
**Requirements:** FR-02–FR-05, FR-11, FR-14; NFR-04, NFR-09.

1. Create a draft place under a city, with an internal identity, coordinates and duplicate checks. Draft data is not recommendation-eligible.
2. Register each source with publisher/reference, rights, supported scope, collection/review dates and retention rules.
3. Add field-level identity, hours/exceptions, historical claims, prices, suitability evidence and approved display text. Mark missing data explicitly. Attach deterministic estimate policies only to allowed numeric fields.
4. Run validation for geographic scope, duplicates, evidence completeness, rights, conflicting values and required publication fields.
5. Reviewer accepts, rejects or requests changes. Publication requires an authorized role; the author cannot bypass missing mandatory evidence.
   An authorized transaction advances the exact field/scope head, current review sequence and publication revision with an audit event. Unpublished drafts never advance authority. New unknown/conflicted/withdrawn current evidence prevents fallback to an older verified value; candidate/version commits check pinned revisions again.
6. Publish an immutable content/evidence revision. Make the place eligible only for the uses its evidence supports; publication of identity alone does not make unknown hours schedulable.
7. Process refresh queues, traveler reports and source changes. Resolve conflicts explicitly, retaining the conflicting evidence history and reviewer rationale.
8. Retire a place or emergency-unpublish a field/place when necessary. Suppress withdrawn claims/unusable directions in every current traveler-facing view, including historical versions; show withdrawal markers, purge affected projections/caches and flag reliant plans. Retain only lawful restricted internal history marked withdrawn. Require revalidation before current validated status returns.

**Branches:** Licensing is unclear, identity cannot be established, evidence conflicts or coordinates are out of scope: keep the record unpublished and assign review. AI-generated draft context cannot substitute for evidence. Administrative changes carry actor, time, reason and affected revision IDs in the audit trail.

**Postcondition:** Every published field has approved provenance or an allowed estimate policy. Corrections preserve version identity with a withdrawal overlay and a visible new validation/content version; historical snapshots cannot expose withdrawn content to travelers.

## F-07 — Delete a plan or account

**Actor:** Authenticated owner; guest data expires automatically.  
**Requirements:** FR-15; NFR-05, NFR-10.

1. Select delete on a plan or account and read exactly which active data will be removed and the approved processing/backup timelines.
2. Confirm the explicit deletion action in the product. Reauthenticate if the approved security policy requires it for account deletion.
3. Immediately revoke ordinary access and enqueue deletion. Remove active personal data within 72 hours, including dependent versions and guest-claim links where applicable.
4. Record a minimal deletion tombstone for restore replay; keep operational/security records only according to the approved retention and access policy.
5. Expire backups within the approved maximum 30 days. If a restore occurs first, replay tombstones before normal access resumes.
6. Provide an accessible completion state without requiring marketing consent or a support conversation.

**Postcondition:** Deleted content is inaccessible and cannot be restored into active use. Infrastructure and provider retention capabilities must be verified before the stated times are promised.

## State transitions and cross-flow checks

```text
Intake -> Server validation -> Candidate/evidence eligibility -> Usage admission
       -> AI selection -> Deterministic planning -> Complete validation -> Result

Generation lifecycle: queued -> running -> succeeded | failed | cancelled
Result validation:    validated | draft | blocked

Committed version -> Edit preview -> Revalidation -> Explicit commit -> New version
                     failure/cancel -------------------------------> Prior version

Evidence revision/expiry -> Affected-plan flag -> Revalidation -> New current status
```

`succeeded` means the job produced a result, including an honest draft or blocked result. It never implies feasibility. Version snapshots retain the status and evidence as assessed at that time; current presentation must also account for subsequent evidence changes.

Release testing follows every flow with a keyboard and screen reader, repeats save/edit with concurrent tabs, injects provider failures, seeds stale/conflicted evidence and exercises unauthorized access. PRD AC-01–AC-16 are the measurable gates; the [Roadmap](ROADMAP.md) assigns implementation order and approval checkpoints.

The 30-place M5 catalogue target is retained; small M1 samples do not change launch scope. Curator 20+ hours/week is confirmed; sustainable capacity is unproven, reviewer remains unassigned at 0 hours and Geoapify is only a candidate. Live-test Stage B/C and volatile-storage adoption/provisioning remain unapproved pending cost/retention/privacy review. DEVB3-01 permits synthetic mock recommendation readiness while preserving B1/B2; stop after B3 for Product Owner review. Food repetition remains unresolved and conservative behavior stays unchanged. No live/paid calls, credential/provider configuration, infrastructure, real traveler data, public deployment or M2 acceptance is authorized.
