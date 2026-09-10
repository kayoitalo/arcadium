# Grooveyard

> **O cemitério dos seus discos — estatísticas de escuta, evolução de gosto e descobertas**
> 
> A portfolio-quality, modular Next.js application that transforms listening history into a digital music magazine visual experience with deterministic discovery, AI interpretation, MusicBrainz metadata enrichment, and Spotify playlist export.

---

## ✦ Key Architectural Principles

1. **Deterministic Analytics**: All counts, rankings, period comparisons (7d, 30d, 1y, All Time), and concentration scores are calculated locally by SQL & TypeScript—never invented by AI.
2. **AI as Narrative Interpretation**: Google Gemini provides natural language context and taste evolution commentary based strictly on validated analytical evidence.
3. **Strict Provider Independence & Policy Compliance**:
   - **Last.fm**: Ingestion source (`user.getRecentTracks`).
   - **Neon PostgreSQL**: Canonical database source of truth.
   - **MusicBrainz**: Asynchronous metadata enrichment (MBID, country of origin, artist type, tags) with 1 req/sec rate limiting.
   - **Spotify**: Isolated export destination (`playlist-modify-private`). Spotify content is **never** used for profiling or AI prompts.
4. **Resilient Fallback Design**: Complete functionality remains 100% operational even when offline, unauthenticated, or when external providers are unavailable.

---

## 🛠 Tech Stack (Latest 2026 Core Dependencies)

- **Framework**: [Next.js 16.2](https://nextjs.org/) (Turbopack & `useTypeScriptCli`)
- **UI & React**: [React 19](https://react.dev/)
- **Language**: [TypeScript 7.0](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) (`@import "tailwindcss"` & CSS-first `@theme` design tokens)
- **Database ORM**: [Prisma 7.9](https://www.prisma.io/) with `@prisma/adapter-pg` driver adapter
- **Database Engine**: [Neon PostgreSQL](https://neon.tech/)
- **Testing**: [Vitest 4.1](https://vitest.dev/) (Unit & Integration tests)
- **Data Validation**: [Zod 4.4](https://zod.dev/)

---

## 🎨 Visual Design System

The interface is a listening room: cool graphite, one live color, and the record itself as the main object.

- **Chrome**: two fixed rows — wordmark + underlined nav, then a context bar carrying the screen name, the period selector (it stays reachable after scrolling) and a `TINGIDO POR ● {album}` indicator.
- **Spot color**: the accent is not fixed. `ChromaProvider` extracts it from the album cover in focus and writes it to `--chroma-*`, so the whole screen — rules, bars, ring, needle — is tinted by whatever is playing.
- **Color palette**: ground `#08090b`, panel `#0a0c0e`, inner rule `#1b2129`, border `#232a32`, text `#f2f4f3` / `#aab2b9` / `#79838c`, oxide red `#d1665a` for losses. A 1px scanline overlay gives the black some grain.
- **Typography**: `Archivo` variable (width axis, condensed to 78 in headlines and figures, opened to 112 on the hovered artist), `Instrument Sans` for prose, `Martian Mono` for labels and measured values, `Unbounded` for the wordmark only.
- **Turntable hero**: platter, spinning record with the cover as its center label, sleeve behind, tonearm resting on the groove, and an `NA AGULHA / A SEGUIR` deck where hovering pulls the record out of its sleeve.
- **Charts from real data only**: sparkline from daily plays, listening-hour histogram aggregated in Postgres in the user's timezone, genre dumbbells (before → after on one shared scale), and the yearly spiral groove.

## ⚡ API Endpoints

- `POST /api/sync`: Resumable incremental scrobble ingestion with SHA-256 deduplication and optional `CRON_SECRET` protection.
- `GET /api/overview`: Period analytical metrics (7d, 30d, 1y, all-time), concentration ratios, taste evolution metrics, and dynamic AI narrative.
- `POST /api/enrichment`: Rate-limited batch metadata enrichment via MusicBrainz API.
- `POST /api/spotify/export`: Track resolution & Spotify private playlist creation (with `.m3u` / `.csv` file fallback).
- `GET /api/user/data`: Downloadable JSON data export (GDPR compliance).
- `DELETE /api/user/data`: Account data purge & history reset.

---

## 🚀 Local Development Setup

### 1. Prerequisites
- Node.js >= 20.x
- `pnpm` (v11+)

### 2. Install Dependencies
```bash
pnpm install
```

### 3. Environment Configuration
Create a `.env` file in the root directory:
```dotenv
DATABASE_URL="postgresql://neondb_owner:...@ep-fragrant-firefly...neon.tech/neondb?sslmode=require"
LASTFM_API_KEY="your_lastfm_api_key"
CRON_SECRET="your_background_cron_secret"
```

### 4. Database Setup & Prisma Generation
```bash
npx prisma db push
npx prisma generate
```

### 5. Run Unit Tests
```bash
pnpm test
```

### 6. Start Development Server
```bash
pnpm dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🔒 Security & Background Scheduling

`POST /api/sync` serves two callers: the scheduler, which sends `CRON_SECRET`, and the "buscar agora" button, which runs in the browser and carries no secret — a browser request is authorized when it is same-origin (`Sec-Fetch-Site: same-origin` with a matching `Origin`), which a third-party page cannot forge.

Background synchronization is scheduled via **GitHub Actions** (`.github/workflows/scheduled-sync.yml`) running hourly:
```bash
curl -X POST https://your-app.vercel.app/api/sync \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  -H "Content-Type: application/json" \
  -d '{"username": "your_lastfm_username"}'
```

---

## 📜 License

MIT License. Designed and built with engineering rigor for personal music intelligence.
