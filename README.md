# Music Intelligence (SpotStats)

> **Personal Music Statistics, Taste Shift Analysis & Recommendation Platform**
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

## 🎨 Visual Design System — Digital Music Magazine

- **Masthead**: `MI — MUSIC INTELLIGENCE` with warm editorial dark aesthetic.
- **Color Palette**: Warm editorial dark background (`#090806`), surface (`#15120f`), marfim text (`#f0e7d8`), copper (`#b47a46`), and gold (`#c59a60`) accents.
- **Typography**: Google Fonts `Instrument Serif` (editorial serif) and `Inter` (clean UI sans).
- **Interactive Album Collages**: 2.5D floating album covers with 3D perspective and mouse parallax ambient glow.

---

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
