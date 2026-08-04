# Music Intelligence

## Personal Music Statistics and Recommendation Platform

> Product, architecture, data, AI, frontend, security, testing, deployment, and delivery plan.

**Version 1.0 · 31 July 2026 · Portfolio-quality, single-developer scope**

> **Context note:** This file is the full project blueprint. For day-to-day coding-agent context, use `ANTIGRAVITY_CONTEXT.md` alongside it.

# Document purpose

This blueprint consolidates the product and technical decisions required to build a personal music-statistics and recommendation web application. It is designed to guide implementation without prematurely writing the whole application or overengineering the first release.

> **North-star outcome**
>
> The first complete release should reliably transform listening events into understandable statistics, controlled recommendations, explicit feedback and an optional Spotify playlist—while remaining useful when AI or Spotify is unavailable.


## Document control

| **Field**                 | **Value**                                                                   |
|---------------------------|-----------------------------------------------------------------------------|
| Status                    | Living implementation blueprint                                             |
| Current version           | 1.0                                                                         |
| Reference date            | 31 July 2026                                                                |
| Primary user              | Single personal account initially; architecture ready for a few users later |
| Primary stack             | TypeScript, Node.js, React, Next.js, PostgreSQL                             |
| Core data source          | Last.fm listening history                                                   |
| Primary deployment target | Vercel + managed PostgreSQL + scheduled GitHub Actions                      |

## How to use this plan

**1.** Treat the scope and architecture decisions as defaults, not irreversible rules.

**2.** Complete milestones in order because later features depend on reliable collection and statistics.

**3.** Keep external providers behind interfaces so policy or pricing changes do not force a rewrite.

**4.** Update this document whenever an architectural decision changes or a provider restriction changes.

## Contents

| **Sections 1–8**                                        | **Sections 9–16**                                     | **Sections 17–Appendices**                |
|---------------------------------------------------------|-------------------------------------------------------|-------------------------------------------|
| 1\. Product vision and principles                       | 9\. Statistics calculation strategy                   | 17\. Authentication, security and privacy |
| 2\. MVP scope and deferred features                     | 10\. Recommendation engine                            | 18\. Testing strategy                     |
| 3\. Data-source and API strategy                        | 11\. AI analysis pipeline                             | 19\. Deployment and expected cost         |
| 4\. Complete user and data flow                         | 12\. Recommendation feedback learning                 | 20\. Delivery milestones                  |
| 5\. System architecture                                 | 13\. Frontend experience and information architecture | 21\. Technical risks and alternatives     |
| 6\. Database entities and relationships                 | 14\. Visual style and design system                   | 22\. Immediate implementation checklist   |
| 7\. Stored data versus live data                        | 15\. Technology and library decisions                 | Appendices and official references        |
| 8\. Listening-history synchronization and deduplication | 16\. Project folder structure                         |                                           |

# 1. Product vision and principles

## 1.1 Product statement

Build a personal music-intelligence platform that collects listening history, organizes it into a trustworthy local model, explains how taste changes over time and recommends new artists, tracks, genres and subgenres with transparent reasons.

The product is not a Spotify statistics clone. Last.fm supplies listening events, the application owns the analytical model, MusicBrainz improves metadata, an AI provider turns structured evidence into readable interpretation, and Spotify is an optional export destination.

## 1.2 Questions the product must answer

- What have I listened to during this period?

- Which artists, tracks, albums and genres dominate my listening?

- How is my taste changing compared with an equivalent previous period?

- Am I repeating a small catalogue or exploring broadly?

- Which artists and genres am I discovering?

- What should I try next, and why does it match my taste?

- How should future recommendations react to my feedback?

## 1.3 Guiding product principles

| **Principle**                      | **Meaning in this project**                                                                                |
|------------------------------------|------------------------------------------------------------------------------------------------------------|
| Deterministic facts                | Counts, rankings, period comparisons and scores are calculated by code and SQL, not invented by AI.        |
| AI as interpretation               | AI explains evidence and recommendations; it is not the source of truth.                                   |
| Provider independence              | Every external API is replaceable behind a domain interface.                                               |
| Graceful degradation               | Statistics work when AI, MusicBrainz or Spotify is unavailable.                                            |
| Explainable discovery              | Every recommendation stores the evidence and score components that produced it.                            |
| Privacy by minimization            | Send aggregated, pseudonymized profile data to AI—not tokens, emails or raw histories.                     |
| Portfolio quality, realistic scope | Use sound architecture and tests without microservices or infrastructure that one developer does not need. |

### Decision 1 — Modular monolith

| **Problem solved**      | The project needs clear domains and provider boundaries, but a separate frontend, API service, worker service and message broker would slow a solo developer.                            |
|-------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Recommended choice**  | Use one Next.js codebase with modular domain services, route handlers, scheduled-job entry points and PostgreSQL.                                                                        |
| **Simpler alternative** | Put all logic directly in pages and route handlers without explicit modules.                                                                                                             |
| **Trade-offs**          | A modular monolith requires discipline in folder boundaries, but avoids deployment and observability complexity. Extract a service only after real scale or runtime requirements appear. |

# 2. MVP scope and deferred features

## 2.1 MVP outcome

> **MVP definition**
>
> A user connects a Last.fm username, imports history without duplicates, sees reliable 7-day/30-day/1-year/all-time statistics, generates a balanced recommendation session, records feedback and optionally exports selected tracks to a private Spotify playlist.


## 2.2 Essential capabilities

| **Area**        | **MVP capability**                                                  | **Acceptance signal**                                |
|-----------------|---------------------------------------------------------------------|------------------------------------------------------|
| Identity        | One application user; all records are user-owned                    | A second user could be added without schema redesign |
| Collection      | Historical import plus incremental Last.fm synchronization          | Re-running a sync inserts zero duplicates            |
| Overview        | Plays, unique artists/tracks, estimated time, rankings and activity | Dashboard works from local PostgreSQL data           |
| Comparison      | Equivalent previous-period comparison                               | Every change has current, previous and share values  |
| Discovery       | New artists and simple diversity/concentration measures             | Results are reproducible from stored events          |
| Enrichment      | Asynchronous MusicBrainz matching for important entities            | History remains valid when metadata is unresolved    |
| Recommendations | Safe, balanced and experimental deterministic ranking               | Each candidate stores score components               |
| AI              | Profile and recommendation explanations from structured JSON        | AI failure does not break recommendations            |
| Feedback        | Liked, disliked, already know, not interested, save for later       | Subsequent candidate scoring uses feedback           |
| Spotify         | Resolve approved tracks and create a private playlist               | Spotify is optional and isolated from analytics      |

## 2.3 First usable release

Stop the first implementation release after the core analytical loop is stable:

| Last.fm → PostgreSQL → synchronization → statistics → overview dashboard → listening history |
|----------------------------------------------------------------------------------------------|

This release is already portfolio-worthy. MusicBrainz, recommendation logic, AI and Spotify should follow only after data collection and date-range calculations are trustworthy.

## 2.4 Explicitly deferred

- ListenBrainz as a second active provider and cross-provider deduplication.

- Real-time scrobbling, social features, public profiles and team/organization roles.

- Vector databases, custom machine-learning models and embeddings.

- Automatic mood, energy, tempo or acoustic-feature analysis.

- A single opaque “diversity score” or “mainstream score” before the underlying signals are validated.

- Automatic playlist regeneration and notifications.

- Native mobile application.

- Advanced artist, track and album detail pages before the core pages are useful.

### Decision 2 — Build the complete loop before breadth

| **Problem solved**      | A large dashboard can accumulate many disconnected cards without proving that collection, interpretation and discovery work together. |
|-------------------------|---------------------------------------------------------------------------------------------------------------------------------------|
| **Recommended choice**  | Prioritize the complete loop: collect → normalize → calculate → understand → recommend → review → export → learn.                     |
| **Simpler alternative** | Build every dashboard section first and add recommendations later.                                                                    |
| **Trade-offs**          | Some attractive features are postponed, but the product reaches a coherent usable state earlier and exposes technical risks sooner.   |

# 3. Data-source and API strategy

> **Policy-sensitive architecture**
>
> Spotify must not be the analytical foundation. Its current Developer Policy prohibits analysis of Spotify Content for derived listening metrics, usage statistics or user profiles, and prohibits ingesting Spotify Content into AI or machine-learning models.[5]


## 3.1 Provider responsibility map

| **Provider**         | **Primary responsibility**                                        | **MVP status**                          | **Must not become**                                        |
|----------------------|-------------------------------------------------------------------|-----------------------------------------|------------------------------------------------------------|
| Last.fm              | Individual listening events and initial similarity seeds          | Required first                          | The permanent source of computed dashboard data            |
| PostgreSQL           | Canonical local history, statistics inputs and product state      | Required first                          | A cache that can be discarded casually                     |
| MusicBrainz          | Canonical identifiers, country/area, release and genre enrichment | Add after dashboard                     | A synchronous dependency of history import                 |
| Gemini or equivalent | Natural-language interpretation and explanation                   | Add after deterministic recommendations | A calculator, entity resolver or source of invented counts |
| Spotify              | Catalog resolution and playlist creation                          | Optional late milestone                 | A source for taste profiling or AI input                   |
| ListenBrainz         | Open alternative listening-history provider                       | Future option                           | A second MVP provider                                      |

## 3.2 Last.fm

Use `user.getRecentTracks` as the initial ingestion endpoint. It returns recent scrobbles, supports UTC `from` and `to` timestamps, permits up to 200 results per page, includes a temporary `nowplaying="true"` record, and does not require user authentication for the read operation.\[1\]

- Import completed scrobbles only; ignore the current “now playing” item.

- Persist events locally and calculate statistics from PostgreSQL.

- Use `artist.getSimilar`, `track.getSimilar` and selected tag endpoints only as candidate signals, not unquestioned recommendations.

- Throttle and retry politely; Last.fm documents excessive or several-calls-per-second behavior as a suspension risk and asks commercial users to contact it.\[2\]

### Decision 3 — Last.fm as event source, PostgreSQL as product truth

| **Problem solved**      | Live Last.fm charts cannot support all custom period comparisons, normalization rules, feedback and future algorithm changes.    |
|-------------------------|----------------------------------------------------------------------------------------------------------------------------------|
| **Recommended choice**  | Persist individual Last.fm events and calculate every product metric locally.                                                    |
| **Simpler alternative** | Request Last.fm rankings whenever a dashboard page loads.                                                                        |
| **Trade-offs**          | Local storage introduces sync, backup and deletion responsibilities, but creates reproducibility, speed and provider resilience. |

## 3.3 MusicBrainz

MusicBrainz is the preferred enrichment provider. Its non-commercial web service is free, does not require an API key, requires a meaningful `User-Agent`, and instructs applications to remain at or below approximately one request per second.\[3\]\[4\]

- Cache successful matches for long periods; metadata does not need frequent polling.

- Resolve new or high-value entities asynchronously.

- Use confidence thresholds and preserve unresolved entities rather than forcing a match.

- Store MusicBrainz IDs as external identifiers, not as the application’s primary database keys.

## 3.4 Spotify

Keep Spotify behind an optional playlist provider. Development Mode currently requires the app owner to have Premium and supports up to five allowlisted authenticated users; Spotify also warns that Development Mode is intentionally limited and should not be a business foundation.\[6\]\[7\]

Allowed product role: search for final recommendations, resolve them to Spotify URIs, create a private playlist and add selected items. Playlist creation requires playlist-modification scopes, and up to 100 items can be added per add-items request.\[8\]\[9\]\[10\]

- Do not calculate listening metrics from Spotify content.

- Do not send Spotify metadata, images or catalog content to the AI provider.

- Keep Spotify connection optional; dashboard and recommendations must work while disconnected.

- When displaying Spotify visual content, preserve it and follow attribution requirements.\[11\]

## 3.5 Gemini or another AI provider

Use a configurable AI provider, with Gemini as the initial low-cost option. Google currently offers a free tier for small projects, but indicates free-tier content can be used to improve its products; paid-tier content is not used for that purpose. Model availability, pricing and quotas change, so the model ID must be configuration rather than domain logic.\[12\]\[13\]\[14\]

- Send aggregated profile features and selected recommendation candidates.

- Exclude user identity, access tokens, refresh tokens and raw listening timelines.

- Validate every structured response with Zod.

- Store prompt version, model name, input hash, output and validation status for reproducibility.

- Provide a deterministic fallback explanation when the AI quota is unavailable.

## 3.6 ListenBrainz

ListenBrainz is a credible future provider because it exposes listen retrieval, submission, statistics, recommendations and rate-limit response headers. Clients are expected to read those headers, and valid authenticated requests may receive higher limits.\[15\]\[16\]

Do not add it to the MVP. First define a `ListeningHistoryProvider` interface and implement Last.fm. Add ListenBrainz after the data model and deduplication rules are proven.

# 4. Complete user and data flow

## 4.1 Primary onboarding flow

**1.** User signs into the application account.

**2.** User enters a Last.fm username and confirms the connection.

**3.** Application creates a provider connection and starts a resumable historical import.

**4.** Dashboard shows import progress and remains usable with partial data.

**5.** After import, scheduled incremental synchronization keeps history current.

**6.** MusicBrainz enrichment runs independently for unresolved high-value artists, tracks and albums.

## 4.2 Daily product flow

```text
Open dashboard
→ select period
→ inspect summary and trends
→ open rankings/history
→ generate discovery session
→ review explanations
→ submit feedback
→ optionally export selected tracks to Spotify
```


## 4.3 Data flow

```text
Last.fm API
↓ provider adapter + Zod validation
Sync service
↓ normalization + idempotent insert
PostgreSQL
├─→ statistics queries → dashboard DTOs
├─→ profile builder → recommendation candidate generator
│ ↓
│ deterministic ranker
│ ↓
│ AI explanation (optional)
└─→ history and feedback storage
Approved recommendation items → Spotify search → private playlist
```


### Decision 4 — Browser never calls providers directly

| **Problem solved**      | Direct browser calls expose keys, duplicate policy logic, complicate retries and make provider changes leak into UI code.      |
|-------------------------|--------------------------------------------------------------------------------------------------------------------------------|
| **Recommended choice**  | The browser calls only the application’s Next.js endpoints or server actions; provider adapters run server-side.               |
| **Simpler alternative** | Call public APIs directly from React components.                                                                               |
| **Trade-offs**          | The server layer adds DTO mapping and endpoints, but protects credentials and centralizes validation, caching and rate limits. |

# 5. System architecture

## 5.1 Recommended topology

```text
┌──────────────────────────────────────────────┐
│ Next.js modular monolith │
│ │
│ React UI / Server Components │
│ Route handlers and server actions │
│ Domain services and repositories │
│ Provider adapters │
│ Scheduled-job entry points │
└──────────────────┬───────────────────────────┘
│
PostgreSQL
│
Last.fm · MusicBrainz · Gemini · Spotify
```


## 5.2 Internal layers

| **Layer**      | **Responsibilities**                                                          | **Must not contain**                |
|----------------|-------------------------------------------------------------------------------|-------------------------------------|
| Presentation   | Pages, components, formatting, interaction and accessibility                  | Provider secrets or statistical SQL |
| Application    | Use cases: synchronize, build dashboard, generate session, submit feedback    | HTTP-specific provider parsing      |
| Domain         | Entities, value objects, formulas, ranking rules and interfaces               | Framework imports where avoidable   |
| Infrastructure | Prisma repositories, API adapters, crypto, logger and scheduling entry points | UI concerns                         |

## 5.3 Provider contracts

```ts
interface ListeningHistoryProvider {
fetchListens(input: FetchListensInput): Promise<ListenPage>;
}
interface MetadataProvider {
searchArtist(input: ArtistSearch): Promise<ArtistCandidate[]>;
searchRecording(input: RecordingSearch): Promise<RecordingCandidate[]>;
}
interface PlaylistProvider {
searchTrack(input: TrackSearch): Promise<PlaylistTrackMatch[]>;
createPlaylist(input: CreatePlaylistInput): Promise<CreatedPlaylist>;
}
interface AIAnalysisProvider {
analyzeProfile(input: ProfilePromptInput): Promise<ProfileNarrative>;
explainRecommendations(input: RecommendationPromptInput):
Promise<RecommendationExplanation[]>;
}
```


### Decision 5 — Provider interfaces before multiple implementations

| **Problem solved**      | The app is exposed to policy, quota and availability changes across every external API.                                 |
|-------------------------|-------------------------------------------------------------------------------------------------------------------------|
| **Recommended choice**  | Define small interfaces around the operations the product needs; map provider payloads into internal DTOs immediately.  |
| **Simpler alternative** | Create generic HTTP helpers but call provider-specific objects throughout the application.                              |
| **Trade-offs**          | Interfaces add mapping code and should not become overgeneralized. Keep them product-focused, not universal music APIs. |

## 5.4 Background execution

Scheduled jobs should trigger idempotent application services. They must be safe to retry, record a `SyncRun`, respect provider limits and avoid holding an HTTP request open for a large historical import.

- Incremental sync: hourly initially; move toward 15–30 minutes only if product value justifies it.

- Historical import: resumable batches with a stored cursor.

- MusicBrainz enrichment: small throttled batches, never on dashboard requests.

- Statistics aggregates: update affected ranges after a sync or calculate live until performance requires precomputation.

# 6. Database entities and relationships

## 6.1 Entity relationship overview

```text
User
├─ ProviderConnection
│ └─ SyncRun
├─ ListeningEvent ── Track ── Artist
│ │ └── Album?
│ └─ raw provider names + playedAt
├─ RecommendationSession
│ └─ RecommendationItem
│ └─ RecommendationFeedback
├─ AIAnalysisRun
└─ PlaylistExport
Artist / Track / Album
├─ ExternalIdentifier
└─ Genre links + metadata resolution status
```


## 6.2 Core entities

| **Entity**         | **Purpose**                                 | **Important fields**                                                      | **Key relationships**                        |
|--------------------|---------------------------------------------|---------------------------------------------------------------------------|----------------------------------------------|
| User               | Application identity and ownership boundary | id, email, displayName, timezone, createdAt                               | Owns all personal records                    |
| ProviderConnection | External account configuration              | provider, username/providerUserId, status, encrypted tokens, lastSyncedAt | Belongs to User; has SyncRuns                |
| SyncRun            | Operational audit of every import/sync      | status, cursor, counts, errorCode, startedAt, finishedAt                  | Belongs to ProviderConnection                |
| Artist             | Canonical local artist                      | name, normalizedName, mbid?, metadataStatus                               | Has Tracks, Albums and Genre links           |
| Track              | Canonical local recording concept           | artistId, name, normalizedName, durationMs?, mbid?                        | Has ListeningEvents                          |
| Album              | Optional local release/album                | artistId, name, normalizedName, releaseYear?, mbid?                       | Referenced by ListeningEvent                 |
| ListeningEvent     | Immutable completed listen                  | userId, playedAt, provider, providerEventKey, raw names                   | Links User, Track, Artist and optional Album |
| Genre              | Normalized genre or tag                     | name, normalizedName                                                      | Many-to-many with artists/tracks             |
| ExternalIdentifier | Provider IDs without coupling PKs           | entityType, entityId, provider, externalId                                | Unique per provider/entity                   |

## 6.3 Recommendation and AI entities

| **Entity**             | **Purpose**                         | **Important fields**                                                                          |
|------------------------|-------------------------------------|-----------------------------------------------------------------------------------------------|
| RecommendationSession  | Snapshot of one discovery request   | userId, mode, context, profilePeriod, algorithmVersion, status, createdAt                     |
| RecommendationItem     | Candidate and its explainable score | artist/track refs or external names, score, noveltyScore, scoreComponents JSON, rank, status  |
| RecommendationFeedback | Explicit reaction                   | type, itemId, userId, createdAt, optional note                                                |
| AIAnalysisRun          | Reproducibility and failure audit   | kind, provider, model, promptVersion, inputHash, validatedOutput, status, token/cost metadata |
| PlaylistExport         | Spotify export result               | sessionId, providerPlaylistId, URL, selected item IDs, createdAt                              |

## 6.4 Constraints and indexes

- `ListeningEvent`: unique `(provider, providerEventKey)` or equivalent user-scoped composite.

- `ListeningEvent`: indexes on `(userId, playedAt DESC)`, `(userId, artistId, playedAt)`, `(userId, trackId, playedAt)`.

- `ExternalIdentifier`: unique `(provider, entityType, externalId)`.

- `Artist` and `Track`: normalized-name indexes for matching, but do not rely on names as global uniqueness.

- `RecommendationFeedback`: constrain one current reaction per user/item, or maintain a history plus a derived current state.

- `ProviderConnection`: one active connection per user/provider for the MVP.

### Decision 6 — Preserve raw names and normalized links

| **Problem solved**      | Provider text can contain spelling differences, remaster suffixes, featured artists and missing IDs. Normalization can also make mistakes. |
|-------------------------|--------------------------------------------------------------------------------------------------------------------------------------------|
| **Recommended choice**  | Store raw artist/track/album strings on each event and link them to canonical local entities separately.                                   |
| **Simpler alternative** | Store only canonical names on the event.                                                                                                   |
| **Trade-offs**          | The schema uses more columns, but permits reprocessing, debugging and corrections without losing source evidence.                          |

# 7. Stored data versus live data

| **Data**                            | **Store locally?**                                 | **Reason**                                    | **Refresh approach**                    |
|-------------------------------------|----------------------------------------------------|-----------------------------------------------|-----------------------------------------|
| Completed listening events          | Yes, permanently until user deletion               | Core analytical source and reproducibility    | Incremental sync                        |
| Raw artist/track/album strings      | Yes                                                | Debugging and re-normalization                | Immutable with event                    |
| Canonical entities and external IDs | Yes                                                | Avoid repeated matching and fragmentation     | Enrich when new or unresolved           |
| Track duration                      | Yes when known                                     | Estimated listening-time calculations         | Refresh only if corrected               |
| Genres/tags/country/release year    | Yes with source and timestamp                      | Analytics and recommendations                 | Long-lived cache                        |
| Dashboard aggregates                | Initially no separate snapshot                     | Avoid premature complexity                    | SQL from events; precompute later       |
| Recommendation sessions and scores  | Yes                                                | Explainability, feedback and repeat avoidance | Immutable session snapshot              |
| AI narratives                       | Yes with prompt/model metadata                     | Reproducibility and cost control              | Regenerate explicitly                   |
| Spotify access token                | Short-lived server cache                           | Required for calls                            | Refresh server-side                     |
| Spotify refresh token               | Yes, encrypted                                     | Reconnect without user action                 | Rotate/update when provider returns one |
| Provider images                     | Prefer URL + source metadata, not binary initially | Reduce storage and licensing complexity       | Respect source expiration and policy    |

> **Avoid full raw response storage**
>
> Keep validated source fields and operational error samples. Full provider payloads should be optional and short-lived because they add storage, privacy and schema-coupling costs.


# 8. Listening-history synchronization and deduplication

## 8.1 Incremental synchronization algorithm

**1.** Acquire a short-lived database lock for the provider connection; skip if another sync is active.

**2.** Create a `SyncRun` with status `RUNNING`.

**3.** Request recent tracks using a deliberate overlap before `lastSyncedAt` to capture late or reordered scrobbles.

**4.** Validate the provider response and ignore `nowplaying=true` records.

**5.** Normalize text only for matching and event-key construction; preserve raw strings.

**6.** Find or create local artist, track and optional album records.

**7.** Insert events in a transaction with a unique deduplication constraint.

**8.** Update the connection cursor and successful-sync timestamp only after committed batches.

**9.** Record inserted, duplicate, unresolved and failed counts in `SyncRun`.

**10.** Schedule metadata enrichment separately.

## 8.2 Event identity

```text
providerEventKey = sha256(
userId + "|lastfm|" +
playedAtUtcSeconds + "|" +
normalize(rawArtistName) + "|" +
normalize(rawTrackName)
)
```


The database unique constraint—not an in-memory check—is the final authority. Two real plays of the same song have different timestamps. A rerun with the same completed scrobble is ignored safely.

## 8.3 Initial historical import

- Fetch newest-to-oldest pages with the maximum practical page size.

- Persist a resumable page/time cursor after every committed batch.

- Allow pause, retry and progress display.

- Do not enrich MusicBrainz metadata inside the import loop.

- Do not calculate every aggregate after every page; refresh once per meaningful batch or after completion.

- Treat provider HTTP 429 and temporary errors as retryable with backoff and jitter.

## 8.4 Time handling

- Store every timestamp in UTC.

- Store a user timezone, initially `America/Sao_Paulo`.

- Convert to the user timezone only when grouping by hour, weekday or calendar date.

- Use half-open ranges `\[start, end)` to prevent boundary duplication.

- Define “previous period” as the immediately preceding interval with the same duration.

### Decision 7 — Overlapping sync window plus unique constraint

| **Problem solved**      | Provider updates and network failures can cause a sync cursor to miss late events or repeat events.                                 |
|-------------------------|-------------------------------------------------------------------------------------------------------------------------------------|
| **Recommended choice**  | Always refetch a small overlap and let the database ignore duplicates.                                                              |
| **Simpler alternative** | Start exactly after the latest stored timestamp.                                                                                    |
| **Trade-offs**          | The application performs a few extra API calls and duplicate insert attempts, but gains much stronger correctness and retry safety. |

# 9. Statistics calculation strategy

## 9.1 Rule: statistics are deterministic

Every number displayed on the dashboard must be traceable to a query or pure calculation. AI may describe a result but must never silently change totals, ranks, periods or category assignments.

## 9.2 Initial periods

| **UI label** | **Current range**                                            | **Comparison range**                                             |
|--------------|--------------------------------------------------------------|------------------------------------------------------------------|
| 7 days       | Last seven complete/rolling days according to product choice | Immediately preceding seven days                                 |
| 30 days      | Last thirty days                                             | Immediately preceding thirty days                                |
| 1 year       | Last 365 days                                                | Preceding 365 days                                               |
| All time     | All stored events                                            | No percentage comparison unless a meaningful baseline is defined |

## 9.3 Core measures

| **Measure**              | **Definition**                                                      | **Important caveat**                                    |
|--------------------------|---------------------------------------------------------------------|---------------------------------------------------------|
| Total plays              | Count of completed `ListeningEvent` rows in range                 | Scrobbles are listens, not exact full-track completions |
| Unique artists/tracks    | Distinct canonical IDs; unresolved fallback keys handled separately | Normalization quality affects the result                |
| Estimated listening time | Sum known duration; fallback estimate for unknown tracks            | Always label as estimated and expose coverage           |
| Current share            | Entity plays ÷ total plays in current period                        | Use zero-safe handling                                  |
| Share change             | Current share − previous share                                      | More useful than raw count when total listening changes |
| New artist               | First stored listen occurs inside selected range                    | Depends on completeness of imported history             |
| Repeat ratio signal      | Repeated plays relative to total plays                              | Do not present one formula as universal “diversity”     |
| Concentration            | Share held by top 5 artists/top 10 tracks                           | Explainable indication of narrow listening              |

## 9.4 Diversity and discovery panel

- Unique tracks divided by total plays.

- Unique artists divided by total plays.

- Share of plays belonging to top five artists.

- Share of plays belonging to top ten tracks.

- Count of newly discovered artists.

- Share of period plays from newly discovered artists.

- Number of first-time tracks from already-known artists.

Show the component signals rather than inventing a single “music diversity score” during the MVP. A composite score can be added only after the user finds the components meaningful.

## 9.5 Taste evolution

```ts
entity trend = {
currentPlays, previousPlays,
currentShare, previousShare,
absoluteChange, percentageChange?, shareChange,
firstListenAt, lastListenAt
}
```


- Rank “rising” entities primarily by positive share change with a minimum-play threshold.

- Rank “declining” entities by negative share change, but avoid dramatic labels for tiny counts.

- Store the calculation version if trend definitions evolve.

- Separate measured trend cards from AI-generated narrative.

## 9.6 Query strategy

- Use Prisma for CRUD and straightforward filters.

- Use parameterized raw SQL for complex grouped statistics when it is clearer and faster.

- Calculate directly from events first; observe query latency before adding aggregate tables.

- If needed later, add daily user/artist/track aggregates and refresh only affected dates.

- Cache dashboard DTOs briefly by user and period, and invalidate after successful synchronization.

# 10. Recommendation engine

## 10.1 Two-stage recommendation design

```text
Stage A — deterministic system
profile signals → candidate sources → exclusions → feature scoring → ranked candidates
Stage B — optional AI
structured profile + ranked candidates → explanations and narrative grouping
```


## 10.2 Candidate sources

- Last.fm similar artists and similar tracks.

- Genre/tag adjacency based on locally enriched entities.

- Artists connected to multiple high-affinity seed artists.

- Tracks from recommended artists that are representative and not already present in history.

- Later: ListenBrainz recommendations or other open catalog signals behind an adapter.

## 10.3 Candidate exclusions

- Already listened to, unless the session explicitly allows familiar tracks.

- Marked `ALREADY_KNOW` for discovery sessions.

- Recently recommended within a configurable cooldown.

- Explicitly disliked or not interested, with different suppression strength.

- Low-confidence entity matches and tracks unavailable in the user’s export market.

- Duplicate recordings, remasters and edition variants where resolution is confident.

## 10.4 Explainable score components

| **Component**       | **Example meaning**                                       | **MVP source**                   |
|---------------------|-----------------------------------------------------------|----------------------------------|
| Artist similarity   | Candidate is strongly related to several favorite artists | Last.fm similarity + local graph |
| Genre similarity    | Candidate shares dominant genres/subgenres                | MusicBrainz/Last.fm tags         |
| Novelty fit         | Distance matches the requested discovery mode             | Known-history and genre distance |
| Profile relevance   | Matches rising or long-term influential preferences       | Local statistics                 |
| Feedback fit        | Related signals performed well or poorly before           | Recommendation feedback          |
| Recency penalty     | Avoids repeated recommendations                           | Saved sessions                   |
| Metadata confidence | Entity/track resolution is reliable                       | Matching service                 |

## 10.5 Modes

| **Mode**     | **Behavior**                                                    | **Suggested weighting tendency**                             |
|--------------|-----------------------------------------------------------------|--------------------------------------------------------------|
| Safe         | Close artist and genre neighbors; high confidence; low distance | Similarity and profile relevance dominate                    |
| Balanced     | Strong match plus adjacent subgenres, decades or regions        | Similarity and novelty are balanced                          |
| Experimental | Connected but distant styles, countries or eras                 | Novelty and diversity increase; confidence threshold remains |

```text
exampleScore =
artistSimilarity * 0.28 +
genreSimilarity * 0.24 +
profileRelevance * 0.18 +
noveltyFit * 0.14 +
feedbackFit * 0.10 +
metadataConfidence * 0.06 -
recentRecommendationPenalty
```


These weights are a versioned starting hypothesis, not truth. Store component values and algorithm version on each recommendation item so the result can be explained and compared later.

### Decision 8 — AI does not invent the candidate set

| **Problem solved**      | Pure generative recommendations can hallucinate tracks, repeat familiar music and ignore feedback or catalog availability. |
|-------------------------|----------------------------------------------------------------------------------------------------------------------------|
| **Recommended choice**  | Generate, validate and rank candidates deterministically; let AI explain and group the controlled list.                    |
| **Simpler alternative** | Ask the AI for 20 artist and song names from a prose taste description.                                                    |
| **Trade-offs**          | The deterministic pipeline takes more work, but recommendations become testable, filterable and auditable.                 |

# 11. AI analysis pipeline

## 11.1 AI inputs

Build a compact `MusicProfileInput` from stored statistics. Include ranked signals and representative evidence, not thousands of scrobbles.

```json
{
"period": "30d",
"topArtists": [{"name":"…","plays":84,"share":0.13,"shareChange":0.08}],
"topGenres": [{"name":"grunge","share":0.18}],
"risingArtists": [/* deterministic data */],
"discovery": {"newArtists":22,"newArtistPlayShare":0.21},
"concentration": {"top5ArtistShare":0.47,"top10TrackShare":0.25},
"representativeTracks": [/* non-Spotify source data */],
"recommendationCandidates": [/* score components */]
}
```


## 11.2 AI responsibilities

- Describe the musical profile in readable language.

- Explain changes supported by supplied current and previous values.

- Explain why each controlled recommendation connects to existing preferences.

- Create concise safe, balanced and experimental discovery narratives.

- State uncertainty when genre or metadata coverage is weak.

## 11.3 AI prohibitions

- Do not calculate or modify stored statistics.

- Do not receive Spotify Content or credentials.

- Do not create canonical IDs or silently resolve ambiguous tracks.

- Do not add unvalidated recommendation candidates to a saved session.

- Do not claim mood, energy or personality facts that are not represented in structured inputs.

## 11.4 Reliability controls

- Use JSON-schema-like structured output and Zod validation.

- Retry only transient failures and malformed output a small number of times.

- Persist prompt version and model ID.

- Hash inputs to reuse identical analyses and reduce cost.

- Set maximum input/output size and per-user generation limits.

- Fallback to deterministic templated explanations when AI is unavailable.

### Decision 9 — AI provider is configuration

| **Problem solved**      | Free-tier models, names, prices and quotas change frequently.                                                                |
|-------------------------|------------------------------------------------------------------------------------------------------------------------------|
| **Recommended choice**  | Read provider and model IDs from configuration; isolate prompts and response mapping in one adapter.                         |
| **Simpler alternative** | Import a specific Gemini model directly in recommendation domain code.                                                       |
| **Trade-offs**          | An abstraction can hide provider-specific capabilities, so keep a small contract focused on profile and explanation outputs. |

# 12. Recommendation feedback learning

## 12.1 Feedback meanings

| **Feedback**   | **Meaning**                             | **Initial scoring effect**                                        |
|----------------|-----------------------------------------|-------------------------------------------------------------------|
| Liked          | Positive taste signal                   | Increase related artist/genre features; permit similar candidates |
| Disliked       | Negative reaction to the music          | Strong candidate suppression; reduce close signals carefully      |
| Already know   | Not a discovery, but not negative taste | Exclude exact entity from discovery; no genre penalty             |
| Not interested | Does not fit the current desire         | Medium suppression; small related-signal reduction                |
| Save for later | Interesting but undecided               | Keep in queue; little or no taste-weight change                   |

## 12.2 Version-one learning model

- Maintain user-specific affinity adjustments for artists and genres.

- Use bounded increments/decrements so one reaction cannot dominate the profile.

- Apply time decay to temporary “not interested” signals before permanent dislikes.

- Separate track-level, artist-level and genre-level effects.

- Record the rule/version that transformed feedback into a score adjustment.

- Expose an undo action and a settings screen for clearing recommendation feedback.

## 12.3 Example rule table

| **Event**      | **Track effect**       | **Artist effect** | **Genre effect** | **Cooldown**                  |
|----------------|------------------------|-------------------|------------------|-------------------------------|
| Liked          | +0.20                  | +0.10             | +0.04            | None                          |
| Disliked       | Exclude                | −0.14             | −0.04            | Long                          |
| Already know   | Exclude from discovery | 0                 | 0                | Permanent discovery exclusion |
| Not interested | −0.20                  | −0.05             | −0.01            | Medium                        |
| Save for later | Queue                  | +0.01             | 0                | None                          |

The numbers above are illustrative initial constants. They must be centralized, versioned and adjusted from real use rather than scattered through UI code.

# 13. Frontend experience and information architecture

## 13.1 Product shell

Use a persistent desktop sidebar and compact mobile drawer/bottom navigation. The MVP navigation is intentionally small:

> Overview Listening History Discovery Settings


Taste Evolution and deeper Statistics can begin as sections in Overview and become dedicated pages only when their content justifies navigation.

## 13.2 Overview page

- Editorial page header with period selector: 7 days, 30 days, 1 year and all time.

- Four high-priority metric cards: plays, artists, tracks and estimated time.

- Listening activity line/area chart.

- Music-chart-style top artists and top tracks.

- Recent discoveries and repeat/concentration signals.

- Measured “what changed” section followed by clearly labeled AI interpretation.

- Last synchronization status and non-blocking stale-data warning.

## 13.3 Listening History page

- Chronological paginated table on desktop; compact rows/cards on mobile.

- Search by artist or track and filter by date, artist, album and genre.

- URL-based filters so refresh, sharing and browser navigation preserve state.

- Clicking an artist initially filters history rather than requiring a full artist-detail page.

## 13.4 Discovery page

- Mode selector: Safe, Balanced, Experimental.

- Optional context selector: General, Working, Studying, Exercising, Relaxing, Staying awake.

- Recommendation cards led by artwork, artist, track and concise evidence-based explanation.

- Immediate reversible feedback with visible `Undo`.

- Selection bar for save session, replace, remove and Spotify export.

## 13.5 Settings page

- Last.fm username, connection state, import progress, manual sync and sync history.

- Spotify optional connection and required scopes explanation.

- Timezone and privacy controls.

- AI provider status and data-minimization explanation.

- Delete imported history, clear feedback and disconnect provider actions with confirmation.

## 13.6 Frontend state model

| **State type**             | **Recommended owner**                                  | **Examples**                                     |
|----------------------------|--------------------------------------------------------|--------------------------------------------------|
| URL state                  | Next.js route/search params                            | Period, page, search and filters                 |
| Server state               | Server Components and TanStack Query where interactive | Dashboard DTOs, sync status, sessions            |
| Local UI state             | React component state                                  | Expanded explanation, mobile menu, selected card |
| Cross-page client workflow | Zustand only if later necessary                        | Unsaved multi-page playlist selection            |

# 14. Visual style and design system

## 14.1 Visual direction

> **Recommended identity**
>
> A dark editorial music archive combined with a precise modern analytics interface: Vercel/Linear-like structure, Apple Music-like respect for artwork, and restrained Spotify Wrapped-style storytelling.


The application should look like a permanent intelligent music journal—not a corporate admin panel, a Spotify clone or an overanimated neon experiment.

## 14.2 Design tokens

| **Token**        | **Suggested value** | **Use**                                       |
|------------------|---------------------|-----------------------------------------------|
| Background       | \#09090B            | Main application canvas                       |
| Surface          | \#111114            | Primary cards and sidebar                     |
| Elevated surface | \#18181C            | Menus, overlays and featured cards            |
| Border           | \#29292F            | Quiet separation                              |
| Primary text     | \#F4F4F5            | Headings and values                           |
| Secondary text   | \#A1A1AA            | Labels and descriptions                       |
| Muted text       | \#71717A            | Axes and metadata                             |
| Accent           | \#8B5CF6            | Selected navigation, focus and primary action |
| Success          | \#3FA675            | Positive change and completed state           |
| Warning          | \#D49A3A            | Incomplete metadata or stale sync             |

## 14.3 Typography

- Use Geist or Inter for interface text, numbers, charts and tables.

- Optionally use Instrument Serif or Newsreader only for large editorial page titles.

- Use tabular numerals for rankings and metric comparisons.

- Keep text hierarchy strong; do not use color as the only distinction.

## 14.4 Artwork and color

- Let album artwork create user-specific atmosphere through blurred low-opacity color fields.

- Keep one stable violet product accent for controls and selection.

- Never depend on artwork-derived colors for readable text or chart meaning.

- Do not crop, overlay or improperly reuse Spotify imagery; preserve attribution when Spotify content is displayed.\[11\]

- Make artwork optional so missing images do not break layouts.

## 14.5 Component language

| **Component**       | **Visual behavior**                                                                  |
|---------------------|--------------------------------------------------------------------------------------|
| Metric card         | Large value, short label, one meaningful comparison; avoid a wall of identical cards |
| Ranking row         | Large rank, artwork, artist/track, plays/share and movement indicator                |
| Chart               | Thin grids, muted axes, one dominant series color, concise tooltip                   |
| Recommendation card | Large artwork, clear reason, novelty/confidence and visible feedback actions         |
| AI narrative        | Editorial surface with explicit AI label and supporting measured facts nearby        |
| Empty state         | Strong explanation and one next action; no empty zero charts                         |
| Skeleton            | Preserve final layout rather than replacing page with a spinner                      |

## 14.6 Motion

- Use Motion for ranking position changes, section expansion, feedback confirmation and page/period transitions.

- Do not animate every card on every render.

- Do not run permanent particles behind charts or dense reading surfaces.

- Honor reduced-motion preferences.

- Animation must communicate state change, not merely decorate the product.

### Decision 10 — Album art supplies personality; UI supplies consistency

| **Problem solved**      | A fixed monochrome dashboard can feel generic, while arbitrary colorful cards make analytics noisy.                                    |
|-------------------------|----------------------------------------------------------------------------------------------------------------------------------------|
| **Recommended choice**  | Use neutral dark foundations and stable accent colors; let compliant album art and blurred derived accents personalize featured areas. |
| **Simpler alternative** | Use a bright multi-color theme for every genre and chart.                                                                              |
| **Trade-offs**          | Artwork availability and licensing require care, but the system remains readable when artwork is missing.                              |

# 15. Technology and library decisions

| **Tool**        | **Decision**         | **Problem solved**                                                | **Why / trade-off**                                                                      |
|-----------------|----------------------|-------------------------------------------------------------------|------------------------------------------------------------------------------------------|
| Next.js         | Use                  | One codebase for UI, server routes, auth callbacks and deployment | Avoid a separate API service initially; keep server-only modules explicit                |
| TypeScript      | Use                  | Provider schemas, DTOs and recommendation contracts               | Adds type maintenance but prevents integration drift                                     |
| PostgreSQL      | Use                  | Relational history plus powerful aggregations                     | Requires migrations and backups; ideal source of truth                                   |
| Prisma          | Use                  | Migrations and productive CRUD                                    | Use raw SQL for complex analytics rather than forcing ORM abstractions                   |
| Zod             | Use                  | Validate env, provider payloads, forms and AI output              | Some schemas duplicate TypeScript types; prefer schema-derived types                     |
| Tailwind CSS    | Use                  | Fast design-system implementation                                 | Centralize tokens and variants to avoid unreadable class duplication                     |
| React Hook Form | Use selectively      | Settings and configuration forms                                  | Unnecessary for tiny one-field interactions                                              |
| TanStack Query  | Use selectively      | Interactive server state, mutations and invalidation              | Do not duplicate Server Component fetches or store all data client-side                  |
| Zustand         | Do not add initially | —                                                                 | React, URL state and query state cover MVP; add only for real cross-page client workflow |
| Recharts        | Use                  | Conventional dashboard charts                                     | Accept its limits; do not build custom D3 visualizations for MVP                         |
| TanStack Table  | Use on History       | Filtering, sorting and pagination structure                       | Avoid using it for visually rich rankings                                                |
| Motion          | Use lightly          | Communicate transitions and ranking changes                       | Overuse harms clarity and performance                                                    |
| Vitest          | Use                  | Pure domain, query-service and adapter tests                      | Mock provider boundaries rather than network calls                                       |
| Playwright      | Use                  | Critical end-to-end flows                                         | Keep a small high-value suite to control maintenance                                     |
| Redis           | Do not add           | —                                                                 | PostgreSQL locks/job records and short caches are enough initially                       |
| Vector DB       | Do not add           | —                                                                 | Explainable relational features are sufficient for first recommendations                 |
| Microservices   | Do not add           | —                                                                 | No independent scaling or team ownership need exists                                     |

## 15.1 Optional additions only when justified

- A date library if native `Date`, `Intl` and database timezone functions become error-prone.

- A lightweight component primitive library only if accessibility primitives save more work than they add.

- A job queue when imports/enrichment outgrow scheduled batches or require durable concurrency.

- An analytics/observability service after logs and database records are insufficient.

# 16. Project folder structure

```text
src/
├── app/
│ ├── (app)/
│ │ ├── overview/
│ │ ├── history/
│ │ ├── discovery/
│ │ └── settings/
│ ├── api/
│ │ ├── cron/
│ │ ├── auth/
│ │ └── integrations/
│ └── layout.tsx
├── modules/
│ ├── users/
│ ├── listening/
│ │ ├── domain/
│ │ ├── application/
│ │ ├── infrastructure/
│ │ └── ui/
│ ├── music-catalog/
│ ├── statistics/
│ ├── recommendations/
│ ├── ai-analysis/
│ └── playlist-export/
├── components/
│ ├── ui/
│ ├── layout/
│ └── charts/
├── lib/
│ ├── db/
│ ├── env/
│ ├── crypto/
│ ├── logging/
│ └── errors/
└── test/
├── fixtures/
├── factories/
└── mocks/
```


## 16.1 Folder rules

- A module owns its domain types, services, repositories and provider-specific mapping.

- Generic UI primitives stay in `components/ui`; feature components stay with their module or page.

- External API response types never escape an adapter unchanged.

- Route handlers perform authentication, input validation and use-case invocation—not business calculations.

- SQL analytics queries live with the statistics module and have dedicated tests.

# 17. Authentication, security and privacy

## 17.1 Application identity

Use an application account independent of Spotify. Spotify is a connected provider, not the login foundation. For the first private release, permit only an allowlisted email; later support a few accounts with the same ownership model.

- Use an established Next.js-compatible authentication library rather than custom password/session code.

- Prefer Google OAuth or magic-link authentication for the small-user scenario.

- Require authorization checks on every user-owned query and mutation, even with one user.

- Do not accept `userId` from the browser as authorization evidence; derive it from the session.

## 17.2 Secrets and tokens

- All provider secrets remain server-side environment variables.

- Encrypt refresh tokens at the application layer before database storage using a versioned encryption key.

- Never store provider tokens in `localStorage`.

- Use the minimum Spotify scopes required for private playlist creation.

- Protect scheduled endpoints with a strong `CRON_SECRET`, verify method and use constant-time comparison where appropriate.

- Redact tokens, authorization headers and raw AI prompts from logs.

## 17.3 Privacy model

| **Data class**       | **Examples**                              | **Protection**                                        |
|----------------------|-------------------------------------------|-------------------------------------------------------|
| Identity             | Email, display name, timezone             | Session authorization; minimal collection             |
| Listening history    | Track, artist, timestamp                  | Private by default; user-owned; export/delete support |
| Provider credentials | Spotify refresh token, API secrets        | Server-only, encrypted, never logged                  |
| AI input             | Aggregated profile and candidate evidence | Pseudonymized; no tokens or exact full timeline       |
| Operational logs     | Errors, sync counts, provider status      | Redacted and retention-limited                        |

## 17.4 User controls

- Disconnect Last.fm or Spotify.

- Delete listening history and derived statistics.

- Clear recommendation feedback and saved sessions.

- Regenerate or delete AI narratives.

- Export personal data in a machine-readable format later.

### Decision 11 — AI data minimization by construction

| **Problem solved**      | A free AI tier may use content to improve products, and raw music history can reveal routines and interests.\[12\]\[13\] |
|-------------------------|--------------------------------------------------------------------------------------------------------------------------|
| **Recommended choice**  | Create a dedicated profile builder that excludes identity, credentials and exact raw timelines before any AI call.       |
| **Simpler alternative** | Send the entire Last.fm history because it is “only music data.”                                                         |
| **Trade-offs**          | Aggregated inputs may lose nuance, but they are cheaper, safer and aligned with the AI’s explanatory role.               |

# 18. Testing strategy

## 18.1 Test pyramid

| **Layer**           | **Tool**               | **Highest-value coverage**                                                   |
|---------------------|------------------------|------------------------------------------------------------------------------|
| Pure unit           | Vitest                 | Normalization, date ranges, trend formulas, score components, feedback rules |
| Service/integration | Vitest + test database | Sync idempotency, repository queries, transactions, authorization            |
| Provider contract   | Vitest fixtures/mocks  | Last.fm mapping, MusicBrainz matching, AI validation, Spotify matching       |
| End-to-end          | Playwright             | User-visible critical flows with mocked providers                            |

## 18.2 Required Vitest scenarios

- The same Last.fm page processed twice creates no duplicate events.

- `nowplaying=true` records are ignored.

- UTC events near midnight group into the correct São Paulo date.

- Half-open date ranges do not double-count boundaries.

- Previous-period ranges have identical duration.

- Zero values do not create invalid percentages.

- Discovery detection uses first-ever stored listen.

- Unresolved metadata does not remove events from totals.

- Recommendation modes change feature weighting predictably.

- `ALREADY_KNOW` does not behave like `DISLIKED`.

- Malformed AI output fails validation and uses fallback behavior.

## 18.3 Required Playwright flows

**1.** Sign in and configure Last.fm.

**2.** Start or resume a historical import and inspect progress.

**3.** Open Overview and change the selected period.

**4.** Search and filter Listening History.

**5.** Generate a recommendation session in each mode.

**6.** Submit and undo feedback.

**7.** Connect mocked Spotify and create a private playlist.

**8.** Verify empty, loading, stale-data and provider-error states.

## 18.4 Test data

- Create deterministic fixtures containing duplicated scrobbles, missing albums, absent MBIDs, remasters and Unicode names.

- Use a fixed clock and timezone in statistical tests.

- Never call real providers in normal CI test runs.

- Maintain one optional manual provider smoke test outside the required CI gate.

# 19. Deployment and expected initial cost

## 19.1 Recommended initial deployment

```text
Vercel Hobby (Next.js)
+
Neon Free PostgreSQL
+
GitHub Actions scheduled workflow
+
Last.fm / MusicBrainz / Gemini free usage
+
Existing Spotify Premium for optional Development Mode
```


## 19.2 Cost table — current planning assumptions

| **Item**      | **Initial choice**  | **Expected added cost**           | **Notes**                                                                                                            |
|---------------|---------------------|-----------------------------------|----------------------------------------------------------------------------------------------------------------------|
| Web hosting   | Vercel Hobby        | \$0/month                         | For personal, non-commercial use; current Hobby price is \$0.\[17\]                                                  |
| PostgreSQL    | Neon Free           | \$0/month                         | Current free plan includes 0.5 GB storage and 100 CU-hours per project.\[18\]                                        |
| Scheduler     | GitHub Actions      | \$0 within allowance              | GitHub Free currently includes 2,000 private-repository minutes/month; public standard runners are free.\[19\]\[20\] |
| Last.fm       | API key             | \$0 for personal MVP              | Commercial use requires prior contact; avoid excessive calls.\[2\]                                                   |
| MusicBrainz   | Non-commercial API  | \$0                               | One request/second and meaningful User-Agent.\[3\]\[4\]                                                              |
| Gemini        | Free tier initially | \$0 while within current quota    | Free-tier content-use caveat; pricing and quotas are model-specific.\[12\]\[14\]                                     |
| Spotify       | Existing Premium    | No new cost if already subscribed | Required for Development Mode app owner under current rules.\[6\]\[7\]                                               |
| Custom domain | Optional            | Domain registration cost          | Not needed for initial private release                                                                               |

> **Likely MVP cost**
>
> The application can realistically start at approximately $0 additional monthly infrastructure cost, assuming existing Spotify Premium and usage within free limits. Pricing is external and must be rechecked before deployment or public release.


## 19.3 Scheduling choice

Use GitHub Actions to call a protected synchronization endpoint or execute a small sync script. Begin hourly. A private GitHub Free account currently includes 2,000 Actions minutes per month; an hourly one-minute job consumes roughly 720 minutes, leaving room for CI.\[19\]\[20\]

- Scheduled workflows can run at defined cron times; GitHub documents a minimum five-minute interval, but schedules may be delayed during high load.\[21\]

- The sync endpoint must remain idempotent because schedulers can retry or overlap.

- Do not perform a full historical import in a short serverless request; process resumable batches.

- Move to a durable worker or paid service only when job duration/concurrency becomes a real constraint.

## 19.4 Growth triggers

| **Trigger**                            | **Likely change**                                                                         |
|----------------------------------------|-------------------------------------------------------------------------------------------|
| Database approaches free storage       | Move to Neon Launch or another paid PostgreSQL plan; add retention/index review           |
| More than a few users                  | Review Spotify quota eligibility, provider terms, authentication and rate limits          |
| Commercial portfolio/product launch    | Contact Last.fm and MusicBrainz as required; reassess Spotify eligibility and legal terms |
| Frequent long-running jobs             | Introduce a worker platform or container service and durable job queue                    |
| AI volume or privacy requirement grows | Enable paid AI service and cost budgets; maintain provider abstraction                    |

# 20. Delivery milestones

| **Milestone**               | **Deliverable**                                                             | **Exit criteria**                                                 |
|-----------------------------|-----------------------------------------------------------------------------|-------------------------------------------------------------------|
| 0 — Foundation              | Next.js, PostgreSQL, Prisma, env validation, logging, Vitest and Playwright | Local app, migration and test commands work                       |
| 1 — Last.fm ingestion       | Provider adapter, connection, import, sync runs and deduplication           | Full rerun creates no duplicates; progress and errors are visible |
| 2 — Statistics engine       | Period utilities and overview queries                                       | All core calculations pass deterministic tests                    |
| 3 — First frontend          | Overview, History and Settings                                              | The app is useful without MusicBrainz, AI or Spotify              |
| 4 — Metadata enrichment     | MusicBrainz throttled resolver and genre/country data                       | Top entities are enriched; unresolved records remain safe         |
| 5 — Deterministic discovery | Candidate sources, scoring, exclusions and session persistence              | Recommendations work without AI and expose reasons                |
| 6 — Feedback                | Feedback actions and score adjustments                                      | Later sessions demonstrably use feedback                          |
| 7 — AI interpretation       | Profile narrative and recommendation explanations                           | Validated structured outputs and deterministic fallback           |
| 8 — Spotify export          | OAuth connection, search/match, private playlist creation                   | Approved tracks export without affecting analytics                |
| 9 — Hardening               | Auth, encryption, deletion, backups, monitoring and portfolio documentation | Private production release is secure and recoverable              |

## 20.1 Recommended work sequence inside each milestone

**1.** Define acceptance criteria and types.

**2.** Write domain/service tests for the riskiest rule.

**3.** Implement provider/repository boundary.

**4.** Implement the smallest UI that proves the use case.

**5.** Add error, loading and empty states.

**6.** Review logs, performance and privacy before moving on.

## 20.2 Portfolio checkpoints

- Checkpoint A after Milestone 3: reliable personal analytics dashboard.

- Checkpoint B after Milestone 6: explainable deterministic recommendation system with feedback.

- Checkpoint C after Milestone 8: complete discovery-to-Spotify workflow.

- Checkpoint D after Milestone 9: documented, tested production-quality case study.

# 21. Technical risks and alternatives

| **Risk**                              | **Impact**                                | **Mitigation / alternative**                                                      |
|---------------------------------------|-------------------------------------------|-----------------------------------------------------------------------------------|
| Last.fm policy or availability change | Core ingestion disruption                 | Provider interface; local source of truth; future ListenBrainz adapter            |
| Inconsistent artist/track names       | Fragmented rankings                       | Raw-name preservation, normalized entities, MusicBrainz confidence workflow       |
| MusicBrainz rate limit                | Slow enrichment                           | Queue small batches, cache long-lived results, prioritize top entities            |
| Spotify Development Mode restrictions | Playlist export unavailable to more users | Keep export optional; show search links/manual export; reassess quota eligibility |
| Spotify policy violation              | App suspension or rejected access         | Never use Spotify Content for profiling/AI; isolate and audit integration         |
| AI hallucination or quota exhaustion  | Poor explanations                         | Controlled candidates, Zod validation, prompt versioning, deterministic fallback  |
| Free-tier data use                    | Privacy concern                           | Aggregated pseudonymous inputs or paid tier; explicit settings disclosure         |
| Timezone mistakes                     | Incorrect day/hour trends                 | UTC storage, user timezone conversion, fixed-clock boundary tests                 |
| Duplicate sync events                 | Corrupted totals                          | Overlap fetch, deterministic event key, database unique constraint                |
| Free database storage limit           | Sync failures or read-only state          | Usage alerts, index review, paid upgrade plan and backups                         |
| Serverless job timeout                | Incomplete imports                        | Resumable small batches; external scheduled runner or worker later                |
| Overdesigned frontend                 | Slow delivery and poor clarity            | Build Overview/History/Settings first; motion and art remain optional enhancement |

## 21.1 Decision review triggers

- Introduce aggregate tables only when measured dashboard query latency becomes unacceptable.

- Introduce Zustand only when a real cross-page unsaved client workflow appears.

- Introduce Redis or a queue only when PostgreSQL locks and scheduled batches fail operational requirements.

- Introduce a separate backend/worker only when runtimes, deployment cadence or independent scaling require it.

- Introduce embeddings only after deterministic recommendations cannot represent the desired discovery quality.

# 22. Immediate implementation checklist

## 22.1 Before coding features

- Create the repository and document local setup.

- Create Last.fm API credentials and test `user.getRecentTracks` manually.

- Decide whether the first import uses your real account or a sanitized fixture first.

- Provision local PostgreSQL with Docker and define environment validation.

- Create the initial Prisma entities: User, ProviderConnection, SyncRun, Artist, Track, Album and ListeningEvent.

- Write the deduplication unique constraint before implementing the import loop.

- Create provider fixtures containing now-playing, duplicates, missing albums and absent MBIDs.

## 22.2 First implementation slice

**1.** Implement `LastFmHistoryProvider.fetchListens()` with Zod validation.

**2.** Implement text normalization and deterministic `providerEventKey`.

**3.** Implement one-page sync transaction and `SyncRun` audit.

**4.** Run the exact same page twice and prove zero duplicate inserts.

**5.** Add pagination/cursor and resumable historical import.

**6.** Add a basic History page before building charts.

**7.** Add total plays, unique artists and top artists for a fixed 30-day range.

**8.** Only then add the period selector and previous-period comparison.

> **Recommended next engineering document**
>
> The next artifact should be a schema-and-sync specification containing the Prisma models, normalization rules, Last.fm response schema, transaction boundaries and Vitest cases. That is the highest-leverage detailed design before implementation.


# Appendix A — Initial API operations

| **Provider** | **Operation**               | **Product use**                               |
|--------------|-----------------------------|-----------------------------------------------|
| Last.fm      | `user.getRecentTracks`    | Historical and incremental completed listens  |
| Last.fm      | `artist.getSimilar`       | Artist candidate signal                       |
| Last.fm      | `track.getSimilar`        | Track candidate signal                        |
| MusicBrainz  | Artist search/lookup        | Canonical artist and area/country metadata    |
| MusicBrainz  | Recording search/lookup     | Canonical recording, duration and identifiers |
| MusicBrainz  | Release search/lookup       | Album/release year and relationships          |
| Gemini       | Generate structured content | Profile narrative and explanations            |
| Spotify      | Search for Item             | Resolve approved track to Spotify catalog URI |
| Spotify      | Create Playlist             | Create private discovery playlist             |
| Spotify      | Add Items to Playlist       | Add selected URIs in batches                  |

# Appendix B — Environment variables

```dotenv
DATABASE_URL=
AUTH_SECRET=
APP_ENCRYPTION_KEY=
CRON_SECRET=
LASTFM_API_KEY=
LASTFM_USER_AGENT=
MUSICBRAINZ_USER_AGENT=MusicIntelligence/0.1 (contact@example.com)
AI_PROVIDER=gemini
AI_MODEL=
GEMINI_API_KEY=
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
SPOTIFY_REDIRECT_URI=
```


Do not require AI or Spotify variables during the early milestones. Environment validation should support feature-specific optional groups and fail only when an enabled feature lacks its required configuration.

# Appendix C — Definition of done for version 1

- Listening import is resumable, observable and idempotent.

- Every dashboard number is reproducible from stored events.

- The app communicates unknown or estimated data honestly.

- Recommendations have stored evidence, score components and algorithm version.

- Feedback meanings are distinct and influence later sessions.

- AI is optional, validated and privacy-minimized.

- Spotify is optional and used only for compliant search/playlist operations.

- The core flows are covered by Vitest and Playwright.

- Users can disconnect providers and delete personal data.

- Deployment cost and usage limits are monitored.

# Appendix D — Official references

[\[1\] Last.fm — user.getRecentTracks](https://www.last.fm/api/show/user.getRecentTracks) — accessed for this plan on 31 July 2026

[\[2\] Last.fm — API introduction and terms guidance](https://www.last.fm/api/intro) — accessed for this plan on 31 July 2026

[\[3\] MusicBrainz — Web Service API](https://musicbrainz.org/doc/MusicBrainz_API) — accessed for this plan on 31 July 2026

[\[4\] MusicBrainz — Rate limiting](https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting) — accessed for this plan on 31 July 2026

[\[5\] Spotify — Developer Policy](https://developer.spotify.com/policy) — accessed for this plan on 31 July 2026

[\[6\] Spotify — Quota modes](https://developer.spotify.com/documentation/web-api/concepts/quota-modes) — accessed for this plan on 31 July 2026

[\[7\] Spotify — February 2026 Development Mode migration guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide) — accessed for this plan on 31 July 2026

[\[8\] Spotify — Search for Item](https://developer.spotify.com/documentation/web-api/reference/search) — accessed for this plan on 31 July 2026

[\[9\] Spotify — Create Playlist](https://developer.spotify.com/documentation/web-api/reference/create-playlist) — accessed for this plan on 31 July 2026

[\[10\] Spotify — Add Items to Playlist](https://developer.spotify.com/documentation/web-api/reference/add-items-to-playlist) — accessed for this plan on 31 July 2026

[\[11\] Spotify — Playlist content policy notes](https://developer.spotify.com/documentation/web-api/reference/get-playlist) — accessed for this plan on 31 July 2026

[\[12\] Google — Gemini Developer API pricing](https://ai.google.dev/gemini-api/docs/pricing) — accessed for this plan on 31 July 2026

[\[13\] Google — Gemini API Additional Terms](https://ai.google.dev/gemini-api/terms) — accessed for this plan on 31 July 2026

[\[14\] Google — Gemini API rate limits](https://ai.google.dev/gemini-api/docs/rate-limits) — accessed for this plan on 31 July 2026

[\[15\] ListenBrainz — API overview and rate limiting](https://listenbrainz.readthedocs.io/en/latest/users/api/index.html) — accessed for this plan on 31 July 2026

[\[16\] ListenBrainz — Core listen endpoints](https://listenbrainz.readthedocs.io/en/latest/users/api/core.html) — accessed for this plan on 31 July 2026

[\[17\] Vercel — Pricing](https://vercel.com/pricing) — accessed for this plan on 31 July 2026

[\[18\] Neon — Pricing](https://neon.com/pricing) — accessed for this plan on 31 July 2026

[\[19\] GitHub — Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions) — accessed for this plan on 31 July 2026

[\[20\] GitHub — Included product usage](https://docs.github.com/en/billing/reference/product-usage-included) — accessed for this plan on 31 July 2026

[\[21\] GitHub — Scheduled workflow events](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows) — accessed for this plan on 31 July 2026

> **Maintenance note**
>
> Provider policies, endpoints, quotas and prices can change. Recheck the official references before implementing a new integration, increasing the user count or moving from a personal project to commercial use.
