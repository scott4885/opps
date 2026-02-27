const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Gen4/SGA Dental Partners...');

  // Ensure org ID 1 exists
  const org = await prisma.organization.upsert({
    where: { id: 1 },
    update: { name: 'Gen4/SGA Dental Partners', industry: 'Multi-location Dental Group (DSO)' },
    create: { id: 1, name: 'Gen4/SGA Dental Partners', industry: 'Multi-location Dental Group (DSO)' },
  });

  const profiles = [
    {
      type: 'IDENTITY',
      content: `# Gen4/SGA Dental Partners

**Industry:** Multi-location dental group (DSO)
**Operating Model:** Regional Operations Director model — each ROD manages 8-15 dental practices
**Entity Type:** Practices (individual dental office locations)
**Scale:** 265+ locations across the United States
**Structure:** Practices → Regional Ops Directors → VP of Operations
**Business Model:** Fee-for-service and insurance-based dental care revenue
**Key Reporting Cycle:** Monthly (MTD Pacing) + periodic clinical performance reviews`,
    },
    {
      type: 'METRICS',
      content: `# Key Metrics — Gen4/SGA Dental

## Production & Pacing
- **Completed Production** (dollar) — MTD actual production completed
- **Budgeted Production** (dollar) — monthly target
- **% to Budget** (percent) — completed/budgeted — target: ≥100%
- **Scheduled Production** (dollar) — production on the books
- **Booked Production** (dollar) — confirmed future production
- **Gross Collections** (dollar) — cash collected
- **Avg Daily Production** (dollar) — completed/working days

## Hygiene Performance
- **Perio %** (percent) — perio maintenance as % of hygiene — target: ≥15%
- **Hygiene Reappointment %** (percent) — patients rescheduled — target: ≥85%
- **Perio Prophy %** (percent) — perio+prophy as % of hygiene visits

## Clinical Utilization
- **D1110** (count) — adult prophylaxis count
- **D4910** (count) — perio maintenance count
- **D4355** (count) — SRP count
- **Perio Diagnostic %** (percent) — target: ≥25%
- **Perio Acceptance %** (percent) — target: ≥60%

## Thresholds / Benchmarks
- Practices below 88% MTD = needs attention
- Perio capture below 12% = significant opportunity
- Hygiene reappt below 80% = retention opportunity`,
    },
    {
      type: 'SOURCES',
      content: `# Data Sources — Gen4/SGA Dental

## MTD Pacing (Excel)
- Sheet: Ops (or Export)
- Entity column: Practice name
- Contains: production vs budget, collections, hygiene metrics, CDT codes
- Refresh: Weekly or as-needed during month

## Hygiene IQ Files (Excel, 3 files)
- Sheets: Hyg Analysis Report, DI Operations, Hyg Master
- Entity column: Practice name / Location
- Contains: Clinical utilization, perio rates, reappointment, case acceptance
- Refresh: Periodic

## MasterLookup (Excel)
- Contains: Canonical practice names (col G), aliases (cols N-AF), ops director (col E)
- Upload first before other files to ensure correct entity resolution`,
    },
    {
      type: 'CONTEXT',
      content: `# Context — Gen4/SGA Dental

## Current Period
- Reporting month: February 2026
- Monthly budget target: ~$31.284M total across all practices

## Known Issues
- Some practices use shortened names in pacing files vs. full names in clinical files
- MasterLookup crosswalk resolves these discrepancies
- Percentages in source files stored as decimals (0.16 = 16%) — multiply by 100 for display

## Organizational Structure
- RODs (Regional Ops Directors) manage clusters of practices
- VP of Operations oversees all RODs
- Dashboard should be usable by both RODs (their practices) and VP (all practices)

## Opportunity Priority for This Business
1. Production gaps vs. budget (highest dollar impact)
2. Perio underdiagnosis (15-30% revenue lift potential)
3. Hygiene reappointment (retention + production)
4. Collections lag (cash flow)`,
    },
  ];

  for (const profile of profiles) {
    await prisma.businessProfile.upsert({
      where: { orgId_type: { orgId: org.id, type: profile.type } },
      update: { content: profile.content },
      create: { orgId: org.id, type: profile.type, content: profile.content },
    });
    console.log(`  ✓ ${profile.type} profile`);
  }

  console.log('Seed complete! Org ID:', org.id);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
