import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const org = await prisma.organization.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, name: 'Gen4/SGA Dental Partners', industry: 'Multi-location Dental Group (DSO)' },
  });

  const profiles = [
    {
      type: 'IDENTITY',
      content: `# Gen4/SGA Dental Partners\n\n**Industry:** Multi-location dental group (DSO)\n**Operating Model:** Regional Operations Director model — each ROD manages 8-15 dental practices\n**Entity Type:** Practices (individual dental office locations)\n**Scale:** 265+ locations across the United States\n**Structure:** Practices → Regional Ops Directors → VP of Operations\n**Business Model:** Fee-for-service and insurance-based dental care`,
    },
    {
      type: 'METRICS',
      content: `# Key Metrics — Gen4/SGA Dental\n\n## Production & Pacing\n- **Completed Production** (dollar) — MTD actual production. Target: ≥100% of budget\n- **% to Budget** (percent, stored as decimal 0.84=84%) — Target: ≥100%\n- **Budgeted Production** (dollar) — monthly target\n- **Gross Collections** (dollar) — cash collected\n- **Avg Daily Production** (dollar)\n\n## Hygiene Performance\n- **Perio %** (percent, decimal) — perio maintenance % of hygiene. Target: ≥15%\n- **Hygiene Reappointment %** (percent, decimal) — Target: ≥85%\n- **Perio Prophy %** (percent, decimal)\n\n## Benchmarks\n- Practices below 88% MTD = needs attention\n- Perio capture below 12% = significant opportunity\n- Hygiene reappt below 80% = retention opportunity`,
    },
    {
      type: 'SOURCES',
      content: `# Data Sources\n\n## MTD Pacing (Excel)\n- Sheet: Ops or Export\n- Entity column: Practice name\n- Contains: production vs budget, collections, hygiene KPIs\n\n## Hygiene IQ Files (Excel, 3 files)\n- Sheets: Hyg Analysis Report, DI Operations, Hyg Master\n- Contains: clinical utilization, perio rates, reappointment\n\n## MasterLookup (Excel)\n- Col G: canonical name, Cols N-AF: aliases, Col E: ops director\n- Upload first to enable proper entity resolution`,
    },
    {
      type: 'CONTEXT',
      content: `# Context — Gen4/SGA Dental\n\n## Current Period\nReporting month: February 2026. Monthly target: ~$31.284M total.\n\n## Data Notes\n- Percentages in source files stored as decimals (0.16 = 16%)\n- MasterLookup crosswalk resolves name discrepancies across files\n\n## Opportunity Priority\n1. Production gaps vs budget (highest dollar impact)\n2. Perio underdiagnosis (15-30% revenue lift potential)\n3. Hygiene reappointment (retention + production)\n4. Collections lag (cash flow)`,
    },
  ];

  for (const p of profiles) {
    await prisma.businessProfile.upsert({
      where: { orgId_type: { orgId: org.id, type: p.type } },
      update: { content: p.content },
      create: { orgId: org.id, ...p },
    });
  }

  console.log('✅ Seed complete: Gen4 org + Business Profile created');
}

main().finally(() => prisma.$disconnect());
