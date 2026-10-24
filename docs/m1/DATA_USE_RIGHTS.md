# M1 data-use rights assessment

Assessment date: 2026-10-22 (`Asia/Jakarta`). Status: documentation assessment; **provider adoption and rights approval remain pending**. No credentials, billable calls, ingestion, provider account changes or legal approval occurred. Read with [Architecture](../ARCHITECTURE.md), [Data Model](../DATA_MODEL.md) and [Operations feasibility](OPERATIONS_FEASIBILITY.md).

See [2026-10-23 provider comparison](PROVIDER_COMPARISON.md) for current alternative-provider and open-data findings. This original Google-focused assessment retains its retrieval date and unresolved permissions; no newer comparison adopts a provider or supplies human rights approval.

The material below distinguishes published documentation, a conservative proposed engineering policy, and permission that still needs an accountable commercial/privacy reviewer. A public web page, attribution, small payload, numeric transformation, hash or paid API subscription does not itself settle reuse rights. The customer's actual agreement and billing jurisdiction must be identified before integration; the sources below describe the publicly available non-EEA agreement. No signed agreement or named rights approver is present in the planning evidence.

## Documentation findings

Google's general terms §3.2.3(a)–(c) restrict extraction, caching and creating content from Maps content; §3.2.3(c)(vii) specifically addresses improving models through training/testing/validation/fine-tuning. This is **not an express blanket prohibition on every runtime inference**. It also does not establish permission for our proposed inference or itinerary derivatives. §20 defines Maps content broadly. [Google Maps Platform Terms, §§3.2.3 and 20](https://cloud.google.com/maps-platform/terms).

Routes-specific §§19.1–19.3 permit use without a Google map, prohibit combination with a non-Google map, and grant a 30-day caching exception for returned latitude/longitude. That exception does **not** name route duration, distance, matrix elements, instructions, cost calculations or itinerary schedules. Maps Grounding Lite §§10.2–10.3 has a limited LLM-grounding exception with its own conditions; it does not extend to generic Routes/Places payloads. [Service Specific Terms, B.10 and B.19](https://cloud.google.com/maps-platform/terms/maps-service-terms).

Routes policies' “Exceptions from caching restrictions” allow indefinite place-ID storage. “Google Maps attribution requirements” requires clear attribution even in a list without a map; results drawn on a map require a Google map. [Routes policies](https://developers.google.com/maps/documentation/routes/policies). Places has its own equivalent ID exception and attribution requirements, including third-party content attribution where applicable. A retained place ID does not authorize retaining the associated name, hours or photos. [Places policies](https://developers.google.com/maps/documentation/places/web-service/policies).

**Decisive gap:** no affirmative permission was located for the proposed storage of duration/distance-derived slot times or transport costs in permanent itinerary versions and backups. Even transient scheduling is a proposed derived use that needs review. This is a blocking uncertainty, not a legal finding that every calculation is prohibited. Removing raw responses while retaining their derivatives does not resolve it.

## Proposed field-and-purpose matrix

`Conditional display` means the product-specific display purpose is supported by documentation but actual agreement, attribution and privacy review are still prerequisites. `Hold` means the application must default-deny this use until an explicit policy or contractual permission is recorded. `Independent` means independently acquired data with documented rights, never relabeled Google content. These are engineering recommendations; none is a record of human rights approval.

| Data / intended use | Transient computation or display | Durable schedule / cost / immutable version | Cache, queue, log and backup treatment | Downstream AI boundary / status |
| --- | --- | --- | --- | --- |
| Google Routes duration and distance, including matrix values | Conditional direct route display. **Hold scheduling, walking-total and price-derivative use** pending exact-purpose review | Hold direct values and reconstructable derivatives | No routine persistent cache, fixture, logs, backup or export under current proposed policy | Exclude from ranking context; no model-improvement dataset. Runtime inference permission is unresolved |
| Arrival/departure/start/end timestamps calculated using a Google duration | Hold, including `duration + buffer` and shifted later slots | Hold these dependent timestamps, not merely a `route_duration` column | Treat JSON snapshots, hashes that reconstruct values, version copies and restore images as dependent copies | Do not launder provenance by calling this application-owned output |
| Distance/time-based transport estimate using Google results | Hold the formula execution for product integration until clarified | Hold dependent `cost_lines`, totals, contingencies, budget verdicts and immutable validation summaries | Redaction must propagate through totals and validation findings, not just the route table | Independent tariff evidence does not make the route input independent |
| Walking distance sum, buffer, feasibility flag or optimized order dependent on Google content | Hold derived use until clarified | Hold dependent records and version fingerprints that retain restricted content | Same dependency purge rules; telemetry records outcome category only | A boolean or rounded number is not automatically exempt |
| Google polyline, geometry, navigation text | Conditional product-specific display; mode warnings and attribution required | No permanent inclusion proposed | No saved payloads, screenshots, export fixtures, general logs or backups proposed | Excluded |
| Google-returned lat/lng | Only under reviewed field policy | No independent catalogue seed from these values | Routes §19.3 exception is at most 30 days for these fields; require expiry of every permitted copy. It does not cover other route fields | No inference permission inferred from coordinate TTL |
| Google `place_id` | Conditional lookup/display use | ID-only reference permitted by documented ID exception; independently review entity match | ID-only storage, with refresh/mismatch policy; no copied associated fields | No need to send it to AI; internal canonical UUID is sufficient |
| Google Places name/address/hours/price/photo/review | Not a verified independent catalogue source by default; conditional display only after specific review | Hold catalogue/version copying | No general cache/backup exception assumed | Excluded; no generic Places-to-LLM pipeline proposed |
| Own canonical UUIDs, independently sourced identity/access-point location, approved history/hours/tariffs and reviewed dwell policies | Independent; field-level source and authority checks still required | Persist only the uses that source policy expressly permits | Ordinary retention, withdrawal and backup policy; source TTL may be shorter | Only minimal licensed ranking fields/IDs; no raw source documents or sensitive user details |
| Independently measured directed travel distances/times, or licensed alternate-provider output | Independent after permission, safety/local route review and estimate-method approval | Candidate for reproducible persisted schedules/costs if its license expressly covers these derivatives | License must cover retention, immutable snapshots, backups and exports; do not assume an alternate SDK grants data rights | Input only if downstream use expressly permitted; AI still does not calculate facts |
| User-authored dates, desired order, manual desired times and declarations of provided/prepaid meals | Personal input, separate from provider content | May persist in an intentionally saved private plan under approved privacy policy | Guest/exact-location lifetime and deletion policy apply | Use minimum necessary structured preferences. User confirming a generated Google-derived value does not automatically change its license |

For every data-bearing field, record `provider/licensor`, agreement/version and clause, allowed purpose, derivation inputs, display attribution, permitted storage class, expiry, downstream use, export and backup rules, reviewer and approval date. New/unknown policy remains denied. Record **both** raw-input and derivative dependencies. Rights revocation invalidates the current projection and affected saved-plan validation without relying on a batch refresh. Immutability preserves revision identity, not a right to retain prohibited content.

## Storage design consequence

A persistent version can safely retain its own UUID lineage, user intent, independent candidate IDs and lawful independent evidence references. Until the derivative issue is resolved it cannot promise a reproducible Google-dependent schedule or total. The implementation must choose one of these reviewable alternatives before its consuming integration:

1. Obtain written confirmation/contract terms covering transient scheduling, derived slots, distance-based costing, validation results, history, backups and deletion. Implement only the positively approved field/purpose policy.
2. Use independently licensed routing evidence for durable calculation and, if separately permitted, Google for optional contemporaneous display. Do not overlay Google route content on an alternate-provider map.
3. Narrow saved functionality to independent user intent and recompute approved transient presentation when viewed. **This still needs permission for the transient derivative calculation** and a product decision that historical schedules/totals may be unavailable. It cannot be presented as a fully reproducible immutable itinerary.

Recommendation: preserve the provider adapter and independent catalogue design; keep Google adoption conditional. Synthetic M1 calculations contain no provider content and establish no provider rights.

## Alternate-source assessment

OpenStreetMap's “OpenStreetMap licensing” permits copying/adaptation under ODbL with attribution and relevant share-alike duties; its “Additional services” section does not offer unrestricted free production API/tile service. OSM data rights, a routing service's output rights, a tile host's operational terms, and route safety are separate reviews. No alternate routing vendor is selected and no license-compliance approval is claimed. [OSM copyright and license](https://www.openstreetmap.org/copyright).

Field observation can produce independent coordinates, walking scope and time estimates if the project has permission to retain/reuse the evidence and handles observer identities appropriately. Direct operator/government material also needs field-specific authority and reuse review; public availability alone does not grant snapshot, translation or redistribution permission. Record the actual consent/license rather than assigning all official websites a blanket reusable status. Route observations remain mode-, direction-, entrance- and time-specific; an observer's trip does not establish general traffic, step-free access or dietary safety.

## Rights decision requests and gate evidence

| ID | Decision / evidence required | Current result | Blocks |
| --- | --- | --- | --- |
| RIGHTS-01 | Named customer entity, billing jurisdiction, actual agreement and authorized rights/privacy reviewer | Pending; not supplied | Any provider-content integration |
| RIGHTS-02 | Clause-level positive permission or alternate-source decision for each schedule/cost/distance derivative, including immutable versions/backups | Pending; documentation gap identified | Google-dependent planner and saved representation; M1 exit |
| RIGHTS-03 | Source-specific retention, display, quotation/translation, AI input and revocation policy for audited venue facts | Pending per source; a citation is not approval | Real catalogue ingestion/publication |
| RIGHTS-04 | Demonstration that forbidden/expired payloads and dependent values never enter DB backups, queues, telemetry or exports, or that their license permits the retention | Pending implementation/configuration; no service exists | Real private/provider data |
| RIGHTS-05 | Attribution and map-provider compatibility review on concrete UI before release | Pending; documentation checked | Map/list integration release |
| RIGHTS-06 | Positive downstream-use review if any Google content is later proposed for model inference | Pending; avoided by design | That optional AI-context change |

**Documentation checks pass; operational/legal permission gates do not. M1 remains incomplete and M2 must not be started on the assumption that derived Google values are persistable.**

## Retrieval register

All URLs below were actually opened on 2026-10-22; full response payloads were not copied into the repository. Section labels, rather than a search snippet, are the evidence locators. Recheck before integration because terms may change.

| Source | Exact sections used | Evidence class |
| --- | --- | --- |
| [Google Maps Platform Terms](https://cloud.google.com/maps-platform/terms) | §3.2.3 “Restrictions Against Misusing the Services”; §20 “Definitions” | Published terms, not accepted customer agreement |
| [Service Specific Terms](https://cloud.google.com/maps-platform/terms/maps-service-terms) | B.19 “Routes API”; B.10 “Maps Grounding Lite API” | Published service terms |
| [Routes policies](https://developers.google.com/maps/documentation/routes/policies) | “Exceptions from caching restrictions”; “Google Maps attribution requirements” | Official documentation |
| [Places policies](https://developers.google.com/maps/documentation/places/web-service/policies) | “Exceptions from caching restrictions”; “Google Maps attribution requirements” | Official documentation |
| [OSM copyright and license](https://www.openstreetmap.org/copyright) | “OpenStreetMap licensing”; “How to credit OpenStreetMap”; “Additional services” | Licensor's data-license overview; detailed integration review pending |
