# Music Intelligence — Antigravity Project Context

> Operational context for an AI coding assistant working on the Music Intelligence project. Read this file before proposing or implementing changes. Consult `music_intelligence_project_blueprint.md` for the complete product and architecture rationale.

## 1. Project purpose

Build a personal music-intelligence web application that:

- imports and stores listening history;
- calculates trustworthy statistics and period comparisons;
- shows how the user's musical taste changes over time;
- generates explainable music recommendations;
- learns from explicit recommendation feedback;
- optionally exports approved tracks to a private Spotify playlist.

The first user is the project owner. The schema and authorization model should still support a few additional users later without redesigning the application.

This is a portfolio-quality project for one developer. Prefer clean boundaries, reliable data, tests, and clear trade-offs over unnecessary infrastructure.

## 2. Non-negotiable product principles

1. **The backend calculates facts.** Counts, rankings, shares, trends, comparisons, discovery measurements, and recommendation scores must come from deterministic code and SQL.
2. **AI interprets; it does not calculate the dashboard.** AI may explain a profile or recommendation, but it must not invent counts, canonical IDs, or candidate tracks.
3. **PostgreSQL is the application source of truth.** External providers supply input or enrichment; dashboard data comes from the local database.
4. **External providers remain replaceable.** Keep provider payloads and HTTP concerns behind small product-focused interfaces.
5. **The product degrades gracefully.** Statistics must still work when MusicBrainz, AI, or Spotify is unavailable.
6. **Recommendations must be explainable.** Store score components, evidence, algorithm version, and feedback effects.
7. **Privacy is minimized by design.** Never send tokens, email addresses, usernames, or raw listening timelines to an AI provider.
8. **Do not overengineer.** No microservices, Redis, message broker, vector database, or custom ML model until a demonstrated requirement exists.

## 3. Current implementation priority

The first usable release is:

```text
Last.fm
  → PostgreSQL
  → historical and incremental synchronization
  → deterministic statistics
  → overview dashboard
  → listening-history page
```

Do not start MusicBrainz enrichment, AI analysis, deterministic recommendation sessions, or Spotify export before the collection and statistics foundation is reliable.

### Immediate engineering order

1. Initialize the Next.js project and quality tooling.
2. Configure PostgreSQL and Prisma.
3. Define the MVP schema.
4. Implement the Last.fm provider adapter with Zod validation.
5. Implement resumable historical import.
6. Implement incremental overlap-window synchronization.
7. Add database-level duplicate protection.
8. Record sync runs and errors.
9. Implement period and comparison calculations.
10. Build the Overview, History, and Settings pages.

## 4. Architecture

Use a **modular monolith** in one Next.js repository.

```text
Browser
  → Next.js pages / route handlers / server actions
  → application services
  → domain rules and interfaces
  → infrastructure adapters and Prisma repositories
  → PostgreSQL and external APIs
```

### Layer responsibilities

| Layer | Responsibilities | Must not contain |
|---|---|---|
| Presentation | Pages, components, formatting, interactions, accessibility | Provider secrets or statistical SQL |
| Application | Use cases such as sync, dashboard assembly, feedback submission | Raw provider payload parsing |
| Domain | Entities, formulas, ranking rules, value objects, provider contracts | Framework-specific code where avoidable |
| Infrastructure | Prisma, external API clients, crypto, logging, scheduling entry points | UI concerns |

### Provider contracts

Keep interfaces small and tied to actual product operations.

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
  explainRecommendations(
    input: RecommendationPromptInput,
  ): Promise<RecommendationExplanation[]>;
}
```

Map provider responses into internal DTOs immediately. Do not leak Last.fm, MusicBrainz, Gemini, or Spotify response shapes through the application.

## 5. External API responsibilities

### Last.fm — required foundation

Use Last.fm for:

- completed listening events through `user.getRecentTracks`;
- historical and incremental history ingestion;
- possible future candidate signals such as similar artists or tracks.

Rules:

- Ignore the temporary `nowplaying` item.
- Store completed scrobbles locally.
- Do not calculate dashboard values from live Last.fm responses.
- Keep raw source names and timestamps even when normalization fails.
- Throttle, retry politely, and identify the application appropriately.

### MusicBrainz — later metadata enrichment

Use MusicBrainz for:

- canonical artist and recording identifiers;
- release information and year;
- artist country or area;
- duration, genres, tags, and relationships when available.

Rules:

- Enrich asynchronously after history ingestion.
- Respect its rate limit and use a meaningful user agent.
- Cache results locally.
- Never block scrobble ingestion on enrichment.
- Prefer unresolved metadata over a forced incorrect match.

### AI provider — later interpretation layer

Gemini is the initial candidate, but the provider must remain configurable.

Use AI for:

- readable descriptions of the musical profile;
- explanations of taste changes;
- explanations connecting recommendations to existing preferences;
- safe, balanced, and experimental discovery narratives.

Rules:

- Send aggregated, pseudonymized structured data.
- Validate responses with Zod.
- Store model name, prompt version, input hash, output, and validation status.
- Provide deterministic fallback text when AI is unavailable.
- AI must not silently add recommendation candidates.

### Spotify — optional export destination

Use Spotify only for:

- account connection needed for playlist actions;
- searching the final approved recommendations;
- resolving tracks to Spotify URIs;
- creating a private playlist and adding selected tracks.

Rules:

- Spotify is not the listening-history or analytics foundation.
- Do not feed Spotify content into AI.
- The dashboard and recommendation engine must work while Spotify is disconnected.
- Keep tokens encrypted server-side.
- Recheck current official policy before expanding Spotify functionality.

### ListenBrainz — future alternative

Do not implement it in the MVP. The `ListeningHistoryProvider` boundary should make it possible later without redesigning the domain model.

## 6. Core data model

Every user-owned record must include or resolve to `userId`.

### Initial entities

- `User`
- `ProviderConnection`
- `SyncRun`
- `Artist`
- `Track`
- `Album`
- `ListeningEvent`

### Later entities

- `Genre`
- `ArtistGenre`
- `ExternalIdentifier`
- `RecommendationSession`
- `RecommendationItem`
- `RecommendationFeedback`
- `AIAnalysisRun`
- `ExportedPlaylist`

### Important modeling rules

- Internal UUIDs are primary keys. Provider IDs are external identifiers.
- Preserve original Last.fm values on `ListeningEvent`.
- Normalized artist/track/album relations may be nullable while unresolved.
- Album is optional on an event.
- A metadata match must carry source, confidence, and resolution status.
- Do not merge entities destructively without an auditable rule.

## 7. Listening-history synchronization

### Historical import

- Fetch pages newest to oldest.
- Store progress after every successful page or batch.
- Make the process resumable.
- Insert in a transaction-sized batch.
- Record received, inserted, and duplicate counts.
- Do not call MusicBrainz for every imported event.

### Incremental synchronization

Use an overlap window rather than relying exclusively on the last timestamp.

```text
last successful timestamp
  → move cursor backward by a safety overlap
  → fetch recent pages
  → database uniqueness constraint removes repeats
```

This protects against delayed scrobbles, retries, pagination shifts, and partial failures.

### Duplicate prevention

Create a deterministic provider event key from stable source fields.

```ts
providerEventKey = sha256(
  `${userId}|lastfm|${playedAtUtcSeconds}|${normalizedArtist}|${normalizedTrack}`,
);
```

Enforce uniqueness at the database level. Application-side checks alone are insufficient because concurrent or retried jobs may race.

Two genuine plays of the same track are valid when their timestamps differ.

### Time handling

- Store timestamps in UTC.
- Convert to the user's configured timezone for day/hour/week calculations.
- Test daylight-saving and boundary behavior even if the initial user is in `America/Sao_Paulo`.
- Define inclusive/exclusive range boundaries explicitly.

## 8. Statistics strategy

The first supported periods are:

- 7 days;
- 30 days;
- 1 year;
- all time.

Each finite current period should compare against an immediately preceding period of equal duration.

### Required initial measures

- total plays;
- unique artists;
- unique tracks;
- top artists, tracks, and albums;
- plays by day;
- plays by weekday;
- plays by hour;
- estimated listening time;
- new artists;
- track and artist diversity ratios;
- concentration in top artists/tracks;
- current share, previous share, and share change.

### Important formulas and meanings

- `trackDiversity = uniqueTracks / totalPlays`
- `artistDiversity = uniqueArtists / totalPlays`
- concentration should be shown as transparent measures such as percentage of plays from the top 5 artists or top 10 tracks;
- an artist is a discovery when its first stored listen falls inside the selected period;
- percentage change must handle zero baselines explicitly;
- estimated duration must be labeled as estimated whenever exact duration is unavailable.

Start with queries directly from `ListeningEvent`. Add aggregate tables only after profiling shows they are needed.

## 9. Recommendation architecture — later milestone

Use a two-stage pipeline.

### Stage A — deterministic candidates and ranking

Candidate sources may include:

- Last.fm similar artists;
- Last.fm similar tracks;
- local genre relationships;
- the user's own listening graph;
- adjacent genres and subgenres;
- candidate exclusions and previous feedback.

Possible score components:

- artist similarity;
- genre similarity;
- profile relevance;
- novelty fit;
- discovery-mode fit;
- feedback fit;
- repetition penalty;
- metadata confidence.

Store every component and the algorithm version.

### Stage B — AI explanation

The AI receives only:

- aggregated profile signals;
- selected deterministic candidates;
- score evidence;
- mode and context;
- sanitized feedback summaries.

The AI may explain and lightly reorder within controlled limits, but it must not invent the candidate set.

### Discovery modes

- **Safe:** close to established artists and genres.
- **Balanced:** familiar characteristics plus adjacent novelty.
- **Experimental:** greater distance across subgenres, periods, or regions while retaining explainable connections.

## 10. Feedback semantics

Keep meanings distinct:

| Feedback | Meaning | Initial effect |
|---|---|---|
| Liked | Positive taste signal | Raise related artist/genre signals |
| Disliked | Negative reaction | Suppress the item and reduce close signals moderately |
| Already know | Not a discovery | Exclude from discovery without treating it as dislike |
| Not interested | Relevance rejection | Suppress and slightly lower related signals |
| Save for later | Interested but undecided | Save without strong taste-weight change |

Do not infer permanent genre rejection from one disliked track. Add cooldowns and negative weights conservatively.

## 11. Frontend information architecture

### MVP navigation

- Overview
- Listening History
- Settings

Add Discovery after the deterministic recommendation engine exists.

### Overview page

The page should answer immediately:

1. What did I listen to?
2. How did it change?
3. What is worth exploring?

Initial content:

- period selector;
- four primary summary cards;
- listening activity chart;
- top artists;
- top tracks;
- recent discoveries;
- synchronization status.

### Listening History page

- search;
- date range;
- artist, album, track, and genre filters when data exists;
- paginated desktop table;
- compact mobile rows/cards;
- URL-driven filters.

### Settings page

- Last.fm username and connection state;
- manual sync;
- last successful sync;
- import progress and understandable errors;
- later, optional Spotify connection.

### Frontend state ownership

- TanStack Query: server state, sync status, dashboard data, history, mutations.
- URL search parameters: period, filters, pagination, shareable views.
- Local React state: transient UI interactions.
- Zustand: do not add initially. Introduce only for demonstrated complex cross-page client state.

The browser must never call external providers directly.

## 12. Visual style

The visual identity is a **dark editorial music archive combined with a precise modern analytics product**.

It should feel like a permanent, intelligent, restrained version of a personalized music retrospective—not a Spotify clone and not a generic admin dashboard.

### Design direction

- dark near-black background with layered charcoal surfaces;
- subtle borders and minimal shadows;
- 12–16px corner radius;
- generous spacing;
- album artwork as the main source of visual color;
- one stable muted-violet application accent;
- Geist or another clean sans-serif for interface text;
- optional Instrument Serif or similar display face for major editorial headings;
- minimal monochromatic charts;
- subtle grain, blur, or album-derived glows only in prominent areas;
- restrained Motion animations that communicate state changes.

### Avoid

- Spotify green as the primary identity;
- heavy glassmorphism;
- neon everywhere;
- rainbow charts;
- equal visual weight for every card;
- constant particle effects;
- decorative animations that compete with data;
- wide desktop tables forced onto mobile.

### UI hierarchy

Use a mixture of:

- editorial hero/header blocks;
- a small number of primary metric cards;
- large analytical sections;
- music-chart-style rankings with artwork and position movement;
- recommendation cards with large artwork and clear reasons.

Album-derived colors are decorative. Important text, controls, and chart contrast must remain predictable and accessible.

## 13. Technology decisions

### Use

- Next.js
- TypeScript
- React
- Tailwind CSS
- PostgreSQL
- Prisma, with raw SQL where statistical queries justify it
- Zod
- TanStack Query
- React Hook Form
- Recharts
- TanStack Table when building the history table
- Vitest
- Playwright
- Lucide
- Motion, used selectively after the functional UI is stable

### Do not add initially

- Zustand
- Redis
- a separate Node backend
- microservices
- a queueing platform
- a vector database
- embeddings
- a custom recommendation ML model
- a heavy UI component framework solely for convenience

Before adding a dependency, document:

1. the problem it solves;
2. why existing tools are insufficient;
3. the simpler alternative;
4. the introduced trade-off.

## 14. Suggested folder structure

```text
src/
├── app/
│   ├── (app)/
│   │   ├── overview/
│   │   ├── history/
│   │   ├── discovery/
│   │   └── settings/
│   └── api/
├── components/
│   ├── layout/
│   ├── dashboard/
│   ├── history/
│   ├── recommendations/
│   └── ui/
├── modules/
│   ├── users/
│   ├── listening/
│   ├── music/
│   ├── statistics/
│   ├── recommendations/
│   └── integrations/
├── lib/
│   ├── db/
│   ├── env/
│   ├── errors/
│   ├── crypto/
│   └── logging/
└── tests/
```

Within a module, prefer product-focused files such as `domain`, `services`, `repositories`, `providers`, and `schemas` only when the module is large enough to justify them. Avoid creating empty architecture folders prematurely.

## 15. Security and privacy

- The application user identity is separate from Spotify.
- Every query and mutation must enforce ownership.
- Keep API keys and provider secrets server-side.
- Encrypt refresh tokens at rest with an application encryption key.
- Never store secrets in browser-accessible storage.
- Use CSRF/state protections for OAuth flows.
- Validate cron requests with a secret.
- Sanitize logs so tokens and personal data are not written.
- Support provider disconnection and personal-data deletion.
- Keep raw external API response storage minimal and time-bounded when needed for debugging.

## 16. Testing strategy

### Vitest priorities

- provider payload validation and mapping;
- normalization rules;
- provider event key generation;
- duplicate insertion and concurrent retry behavior;
- historical import resumption;
- overlap-window incremental sync;
- period boundaries and previous-period ranges;
- timezone handling;
- discovery detection;
- diversity and concentration calculations;
- zero-baseline percentage changes;
- recommendation scoring and feedback rules;
- Zod validation of AI responses.

### Playwright priorities

- configure Last.fm;
- start and observe synchronization;
- view the Overview page;
- change the period and preserve it in the URL;
- search and filter Listening History;
- see useful empty, loading, partial-import, and provider-error states;
- later, generate a recommendation session, submit feedback, and export a playlist.

Normal automated tests must use fixtures and mocked provider adapters, not real external APIs.

## 17. Deployment assumptions

Initial target:

```text
Vercel Hobby
+ managed PostgreSQL such as Neon Free
+ GitHub Actions scheduled workflows
```

The intended initial incremental cost is approximately zero beyond any existing Spotify Premium subscription, subject to current provider limits and policies.

Use GitHub Actions for scheduled synchronization if Vercel cron frequency or plan restrictions are insufficient. Scheduled jobs must be idempotent because schedules can be delayed or retried.

## 18. Milestones

1. **Foundation:** repository, environment validation, database, tests, CI.
2. **Last.fm ingestion:** historical import, incremental sync, idempotency, sync observability.
3. **Statistics engine:** periods, comparisons, rankings, activity, discoveries, diversity.
4. **MVP frontend:** Overview, History, Settings, responsive and accessible states.
5. **MusicBrainz enrichment:** canonical IDs, genres, countries, years, confidence workflow.
6. **Deterministic recommendations:** candidates, modes, score evidence, sessions.
7. **Feedback learning:** distinct feedback semantics and rule-based score updates.
8. **AI interpretation:** profile narratives and recommendation explanations.
9. **Spotify export:** optional account connection, track resolution, private playlists.
10. **Hardening:** authentication, deletion, encryption, monitoring, documentation, portfolio polish.

Do not skip milestone exit criteria merely to expose a later feature sooner.

## 19. Coding-assistant working rules

When working on this project:

1. Identify the current milestone before proposing code.
2. Do not implement deferred features unless the task explicitly changes scope.
3. Do not add a dependency without explaining its necessity and simpler alternative.
4. Keep provider code out of presentation components.
5. Keep statistical logic out of AI prompts.
6. Make synchronization and write operations idempotent.
7. Add or update tests with every domain rule.
8. Preserve unresolved source data rather than fabricating a canonical match.
9. Use typed DTOs and Zod at all external boundaries.
10. Keep user ownership explicit in repositories and queries.
11. Update the blueprint or an ADR when an architectural decision changes.
12. Recheck official API documentation before implementing policy-sensitive or quota-sensitive functionality.

## 20. Definition of done for version 1

- Listening import is resumable, observable, and idempotent.
- Every dashboard number can be reproduced from stored listening events.
- Unknown or estimated values are labeled honestly.
- Recommendation items store evidence, score components, and algorithm version.
- Feedback meanings remain distinct and influence later sessions.
- AI is optional, validated, and privacy-minimized.
- Spotify is optional and isolated from analytics.
- Core flows are covered by Vitest and Playwright.
- Users can disconnect providers and delete personal data.
- Deployment costs and provider limits are monitored.
