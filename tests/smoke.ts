/**
 * Smoke tests for Opps.
 * Local: npx ts-node --project tsconfig.seed.json tests/smoke.ts
 * Container: docker exec opps node tests/smoke.js
 *
 * DB tests will skip if database is unreachable (run from container for full coverage).
 */

import { PrismaClient } from '@prisma/client';
import { parseFile } from '../lib/excel-parser';

const prisma = new PrismaClient();
const BASE_URL = process.env.TEST_URL || 'http://localhost:3003';

let passed = 0;
let failed = 0;
let skipped = 0;

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err) {
    const msg = String(err);
    if (msg.includes("Can't reach database") || msg.includes('ECONNREFUSED')) {
      console.log(`  ⏭️  ${name} (skipped — DB not reachable locally, run from container)`);
      skipped++;
    } else {
      console.log(`  ❌ ${name}: ${err}`);
      failed++;
    }
  }
}

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

async function main() {
  console.log('\n🔥 Opps. Smoke Tests\n');

  // Test 1: CSV Parser — parse dental pacing data
  await test('CSV Parser: handles dental pacing data', async () => {
    const csv = Buffer.from(
      'Practice,Completed Production,Budgeted Production,Gross Collections,Perio %\n' +
      'Test Practice A,125000,140000,118000,0.14\n' +
      'Test Practice B,98000,110000,92000,0.09\n' +
      'Test Practice C,165000,155000,160000,0.18\n'
    );
    const sheets = parseFile(csv, 'test.csv');
    assert(sheets.length === 1, 'Should have 1 sheet');
    assert(sheets[0].headers.length === 5, `Expected 5 headers, got ${sheets[0].headers.length}`);
    assert(sheets[0].rows.length === 3, `Expected 3 rows, got ${sheets[0].rows.length}`);
    assert(sheets[0].headers[0] === 'Practice', 'First header should be Practice');
  });

  // Test 2: DB — org exists (requires DB access)
  await test('Database: Gen4/SGA org exists', async () => {
    const org = await prisma.organization.findUnique({ where: { id: 1 } });
    assert(org !== null, 'Gen4/SGA org (ID=1) should exist after seeding');
    assert(org!.name.includes('Dental'), 'Org should be dental');
  });

  // Test 3: DB — business profiles seeded
  await test('Database: Gen4 business profiles exist (4 types)', async () => {
    const profiles = await prisma.businessProfile.findMany({ where: { orgId: 1 } });
    assert(profiles.length >= 4, `Expected 4+ profiles, got ${profiles.length}`);
    const types = profiles.map((p) => p.type);
    assert(types.includes('IDENTITY'), 'Should have IDENTITY');
    assert(types.includes('METRICS'), 'Should have METRICS');
    assert(types.includes('SOURCES'), 'Should have SOURCES');
    assert(types.includes('CONTEXT'), 'Should have CONTEXT');
  });

  // Test 4: Dashboard HTTP
  await test('Dashboard: HTTP 200 response', async () => {
    const res = await fetch(`${BASE_URL}/?orgId=1`);
    assert(res.status === 200 || res.status === 307, `Expected 200/307, got ${res.status}`);
  });

  // Test 5: isLatest consistency (requires DB)
  await test('MetricValue: isLatest uniqueness constraint', async () => {
    const entityMetricPairs = await prisma.metricValue.groupBy({
      by: ['entityId', 'metricId'],
      _count: { id: true },
      where: { isLatest: true },
    });
    for (const pair of entityMetricPairs) {
      assert(
        pair._count.id <= 1,
        `Entity ${pair.entityId} + Metric ${pair.metricId} has ${pair._count.id} isLatest=true`
      );
    }
  });

  // Test 6: API orgs endpoint
  await test('API: /api/orgs returns orgs array', async () => {
    const res = await fetch(`${BASE_URL}/api/orgs`);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = await res.json() as { orgs: unknown[] };
    assert(Array.isArray(data.orgs), 'Should return orgs array');
    assert(data.orgs.length >= 1, 'Should have at least one org');
  });

  // Test 7: CSV parser numeric values
  await test('CSV Parser: numeric value extraction', async () => {
    const csv = Buffer.from('Name,Value\nA,100\nB,200');
    const sheets = parseFile(csv, 'data.csv');
    assert(sheets[0].rows[0]['Name'] === 'A', 'First row name should be A');
    assert(sheets[0].rows[0]['Value'] === 100, 'First row value should be 100');
  });

  console.log(`\n📊 Results: ${passed} passed, ${failed} failed, ${skipped} skipped\n`);

  if (failed > 0) process.exit(1);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
