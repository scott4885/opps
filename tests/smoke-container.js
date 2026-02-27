/**
 * Container-side smoke tests (run from inside Docker with DB access)
 * Usage: docker exec opps node tests/smoke-container.js
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ❌ ${name}: ${err.message}`);
    failed++;
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg);
}

async function main() {
  console.log('\n🔥 Opps. Container Smoke Tests\n');

  // Test 1: DB connection
  await test('Database: connection works', async () => {
    const count = await prisma.organization.count();
    assert(count >= 0, 'Should be able to count orgs');
  });

  // Test 2: Gen4 org exists
  await test('Database: Gen4/SGA org seeded', async () => {
    const org = await prisma.organization.findUnique({ where: { id: 1 } });
    assert(org !== null, 'Org ID 1 should exist');
    assert(org.name.includes('Dental'), `Org name should include Dental, got: ${org.name}`);
  });

  // Test 3: Business profiles exist
  await test('Database: 4 business profiles seeded', async () => {
    const profiles = await prisma.businessProfile.findMany({ where: { orgId: 1 } });
    assert(profiles.length >= 4, `Expected 4+ profiles, got ${profiles.length}`);
    const types = profiles.map(p => p.type);
    assert(types.includes('IDENTITY'), 'Missing IDENTITY profile');
    assert(types.includes('METRICS'), 'Missing METRICS profile');
  });

  // Test 4: isLatest constraint
  await test('MetricValue: isLatest uniqueness (no duplicates)', async () => {
    // Group by entity+metric where isLatest=true, verify max 1 per combo
    const values = await prisma.metricValue.findMany({ where: { isLatest: true }, take: 100 });
    const counts = {};
    for (const v of values) {
      const key = `${v.entityId}:${v.metricId}`;
      counts[key] = (counts[key] || 0) + 1;
    }
    for (const [key, count] of Object.entries(counts)) {
      assert(count <= 1, `Entity:Metric ${key} has ${count} isLatest=true rows`);
    }
  });

  // Test 5: Schema tables exist
  await test('Database: All schema tables accessible', async () => {
    await prisma.entity.count();
    await prisma.dataSource.count();
    await prisma.upload.count();
    await prisma.metric.count();
    await prisma.metricValue.count();
    await prisma.opportunity.count();
  });

  console.log(`\n📊 Container Results: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

main()
  .then(() => prisma.$disconnect())
  .catch(e => { console.error(e); prisma.$disconnect(); process.exit(1); });
