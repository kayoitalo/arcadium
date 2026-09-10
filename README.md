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

## 🎨 Visual Design System — Arquivo de Prensagem

The interface is a record label's archive card, not a dashboard.

- **Masthead**: `GROOVEYARD — ARQUIVO DE ESCUTA`, with catalogue stamp (`GY–ARQ · 33⅓ RPM`) and square filing tabs (`01 VISÃO GERAL`, `02 EVOLUÇÃO`, …).
- **Color Palette**: Shellac ground (`#0d0c0a`, warm black biased to brown), surface (`#16130f`), ivory text (`#ece4d4`), hue-biased warm neutrals, 1px rules (`#2d2720`) as the unit of construction. Status colors are tape and label colors: olive (`#8ba36b`), amber (`#c9a15a`), oxide red (`#c05a45`).
- **Spot ink**: the accent is not fixed — `ChromaProvider` extracts it from the album cover in focus and writes it to `--chroma-*`, so each screen is printed in one ink, like a single-color press run.
- **Typography — three voices**: `Bricolage Grotesque` variable (condensed to `wdth 76–85` for wordmark, headlines and figures), `Instrument Serif` (liner-note voice: AI narrative, pull quotes, colophon) and `Martian Mono` (catalogue numbers, labels, timestamps, percentages).
- **Print matter**: uncoated paper grain overlay, registration marks on major blocks, a vertical spine carrying the current section, and a sleeve colophon crediting every data source.
- **Terms of art as content**: `TEMPO DE AGULHA` (needle time), catalogue numbers (`GY·A-001`, `GY·LP-003`, `GY·TP-001`), `SESSÃO` / `FOLHA 1 DE 9` in the listening ledger, `MESA DE CORTE` and `PRENSAGEM 01 DE 03` in discovery.
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
