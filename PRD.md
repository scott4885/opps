# PRD.md — Opps. Business Intelligence Platform

## Changelog

| Version | Date | Change |
|---------|------|--------|
| v1.2 | 2026-02-28 | Opportunity drill-down ("Why this opportunity?"), Detail section, Next Steps section added to opportunity cards |
| v1.1 | 2026-02-28 | AI model upgrade to Sonnet (env-var configurable), max_tokens restored, opportunity score explainer added to UI, PRD created |
| v1.0 | 2026-02-27 | Initial release — scaffold, AI mapper, opportunity engine, dashboard, upload flow |

---

## Product Overview

**Opps.** is a multi-client business intelligence platform that converts raw business data (Excel, CSV) into prioritized, dollar-valued opportunities with one clear recommended action each.

**Target Users:** Dental DSO operators, practice managers, and executives managing multiple locations.

**Core Value Prop:** Upload any data file → AI auto-detects entities and metrics → ranked, dollar-sized opportunities appear within seconds. No data mapping, no BI configuration, no SQL.

**Live App:** http://opps.142.93.182.236.sslip.io

---

## Architecture

### Stack
- **Framework:** Next.js 14 (App Router, server components)
- **Language:** TypeScript
- **Database:** PostgreSQL via Prisma ORM
- **AI:** Anthropic Claude API (configurable via `AI_MODEL` env var, default: `claude-sonnet-4-20250514`)
- **Styling:** Tailwind CSS (clean white mode, Linear/Obsidian aesthetic)
- **Deployment:** Docker container on DigitalOcean VPS via Coolify

### Request Flow
```
User uploads file
  → /api/upload (Next.js route)
  → excel-parser.ts (parse XLSX/CSV to rows)
  → ai-mapper.ts (Claude: detect entities, map columns to metrics)
  → Prisma: upsert Entities, Metrics, MetricValues
  → runOpportunityEngine() [async, non-blocking]
      → Claude: analyze all entity metrics → produce Opportunities + Scores
      → Prisma: write Opportunities, OpportunityScores
  → Dashboard auto-refreshes (force-dynamic)
```

### Key Files
| File | Purpose |
|------|---------|
| `app/dashboard/page.tsx` | Main dashboard UI — scores, opportunities, entity table |
| `app/upload/page.tsx` | File upload UI |
| `app/setup/page.tsx` | Org setup wizard |
| `app/api/upload/route.ts` | Upload handler — orchestrates parsing + AI |
| `lib/ai-mapper.ts` | Claude: maps file columns to business metrics |
| `lib/opportunity-engine.ts` | Claude: generates ranked opportunities + scores |
| `lib/excel-parser.ts` | Parses XLSX/CSV into sheet arrays |
| `lib/prisma.ts` | Prisma client singleton |
| `components/MetricCell.tsx` | Reusable metric display with hover tooltip |

---

## Data Models

### Organization
Top-level tenant. Multi-org supported.

### BusinessProfile
Free-text sections (IDENTITY, METRICS, SOURCES, CONTEXT) that provide Claude with business context for better opportunity identification.

### Entity
A trackable unit (location, practice, department, SKU, route, employee). AI auto-detects entity type from data.

### Metric
A named KPI (e.g. `monthly_production`, `new_patient_count`). AI-generated from file column headers. Categories: `revenue | cost | efficiency | capacity | retention`.

### MetricValue
Time-series data point: entity × metric × upload. Tracks `isLatest` flag for current-state views.

### Opportunity
AI-generated insight: type, title, dollar value (`valueSized`), primary recommendation, `detail` (plain-English analysis explanation), `nextSteps` (JSON array of role-tagged actions), alternatives, priority rank. Linked to entity and relevant metrics.

### OpportunityScore
Per-entity composite score (0–100). Higher = more unrealized value available. Computed by Claude after each upload. Includes `primaryOpportunityType` and `primaryValueSized` for context.

---

## Features

### ✅ Live
- **File Upload** — XLSX and CSV support, multi-sheet
- **AI Column Mapping** — Claude auto-detects entity column, date column, and maps all numeric columns to categorized metrics
- **Entity Resolution** — Canonical name matching with alias tracking across multiple uploads
- **Opportunity Engine** — Claude produces up to 8 ranked, dollar-valued opportunities per analysis run
- **Opportunity Scores** — Per-entity 0–100 score with color coding (red=high opp, green=low opp)
- **Score Explainer** — Info tooltip on Opportunity Scores explaining the scoring methodology
- **Opportunity Drill-Down** — "Why this opportunity?" collapsible on each card showing the specific metric values that triggered the opportunity flag
- **Detail Section** — Plain-English explanation of HOW Claude arrived at each recommendation (methodology, current value vs. benchmark, gap, dollar impact formula)
- **Next Steps Section** — 3-5 role-tagged actionable steps per opportunity (e.g. "[Office Manager] Review hygiene schedule…") ordered between Detail and Alternatives
- **Dashboard** — Total opportunity value banner, score cards, opportunity accordion, entity table
- **Multi-org Support** — Org selector for DSO clients
- **Data Sources Panel** — Tracks all uploaded files with timestamps

### 🔒 Configurable
- **AI Model** — Set via `AI_MODEL` env var (default: `claude-sonnet-4-20250514`); change without rebuild

---

## Known Issues / Backlog

- Opportunity engine runs async after upload response — dashboard requires page refresh to see results
- No WebSocket/polling to auto-update dashboard when engine completes
- No authentication/auth guard — all orgs accessible by URL param
- No date-aware trending — MetricValues store dates but dashboard shows only latest snapshot
- No export (CSV/PDF) for opportunities
- Entity deduplication is name-based only — no fuzzy matching for slight name variations
- Opportunity engine max 8 results — configurable limit desired
- No pagination on entity table (performance issue at 100+ entities)

---

## Sprint Log

### Sprint 2 — 2026-02-28 (v1.2)

**Forge Agent (Claude Code)**

1. **Opportunity Drill-Down ("Why this opportunity?")** — Each opportunity card now has a "Why this opportunity?" collapsible button that expands to show a grid of the specific metric values that triggered the opportunity flag. Metrics linked via `metricSlugs` in the AI response are shown first; if none linked, shows top 8 entity metrics as context.
   - New `whyMetrics` field shaped in both the API (`/api/orgs/[id]/opportunities`) and the dashboard server component
   - UI: indigo-tinted metric grid with formatted values (dollar/percent/count/days auto-detected)

2. **Detail Section** — New `detail` field added to `Opportunity` schema. AI prompt updated to produce a 2-4 sentence plain-English explanation: specific metric vs. benchmark, gap identified, dollar impact calculation. Displayed between Recommendation and Next Steps in a soft gray card.

3. **Next Steps Section** — New `nextSteps` field (JSON array) added to `Opportunity` schema. AI prompt updated to produce 3-5 role-tagged steps (e.g. `[Office Manager] Step...`). Rendered as a numbered list with color-coded role badges. Shown below Detail, above Alternatives. Role colors: violet=Office Manager, blue=Dentist/Doctor, teal=Hygienist, orange=ROD/Regional, pink=Front Desk, yellow=Billing.

4. **Schema Migration** — Added `detail String?` and `nextSteps String?` columns to `Opportunity` table via `ALTER TABLE` on production database.

### Sprint 1 — 2026-02-28 (v1.1)

**Forge Agent (Claude Code)**

1. **AI Model Upgrade** — Switched from `claude-3-5-haiku-20241022` to `claude-sonnet-4-20250514`
   - Both `lib/ai-mapper.ts` and `lib/opportunity-engine.ts` now use `process.env.AI_MODEL || 'claude-sonnet-4-20250514'`
   - `max_tokens`: ai-mapper 512→1024, opportunity-engine 1024→2048
   - Model configurable at runtime via env var — no rebuild required

2. **Opportunity Score Explainer** — Added info icon (ℹ) next to "Opportunity Scores" section header and "Score" table column header
   - Pure CSS hover tooltip (server-component compatible, no React state)
   - Explains 0–100 scale, color thresholds, and scoring factors
   - Consistent with existing MetricCell tooltip pattern

3. **PRD.md** — This document created

---

## Proposed Future Improvements

| Priority | Feature | Rationale |
|----------|---------|-----------|
| High | Real-time dashboard updates (SSE or polling) | UX — users don't know when opp engine finishes |
| High | Authentication (NextAuth or Clerk) | Security — currently open to anyone |
| Medium | Trending / delta views | Show metric movement across uploads over time |
| Medium | Opportunity export (CSV/PDF) | Exec reporting use case |
| Medium | Fuzzy entity matching | Handles slight name variations across data sources |
| Low | Opportunity confidence scores | Help users prioritize which opps to act on |
| Low | Slack/email alerts | Notify stakeholders when new opportunities are found |
| Low | Embed mode | Iframe-embeddable opportunity widget per client |
| Low | Multi-sheet column alignment | Handle inconsistent column names across uploads |
