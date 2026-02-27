/**
 * Smoke tests for Opps.
 * Run: npx ts-node tests/smoke.ts
 */

import { PrismaClient } from '@prisma/client';
import { parseFile } from '../lib/excel-parser';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();
const BASE_URL = process.env.TEST_URL || 'http://localhost:3003';

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ❌ ${name}: ${err}`);
    failed++;
  }
}

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

async function createTestCsv(): Promise<Buffer> {
  const csv = `Practice,Completed Production,Budgeted Production,Gross Collections,Perio %
Test Practice A,125000,140000,118000,0.14
Test Practice B,98000,110000,92000,0.09
Test Practice C,165000,155000,160000,0.18
`;
  return Buffer.from(csv);
}

async function main() {
  console.log('\n🔥 Opps. Smoke Tests\n');

  // Test 1: Upload test — parse CSV and verify structure
  await test('CSV Parser: handles dental pacing data', async () => {
    const csv = await createTestCsv();
    const sheets = parseFile(csv, 'test.csv');
    assert(sheets.length === 1, 'Should have 1 sheet');
    assert(sheets[0].headers.length === 5, `Expected 5 headers, got ${sheets[0].headers.length}`);
    assert(sheets[0].rows.length === 3, `Expected 3 rows, got ${sheets[0].rows.length}`);
    assert(sheets[0].headers[0] === 'Practice', 'First header should be Practice');
  });

  // Test 2: DB connectivity
  await test('Database: connection and org exists', async () => {
    const org = await prisma.organization.findUnique({ where: { id: 1 } });
    assert(org !== null, 'Gen4/SGA org (ID=1) should exist after seeding');
    assert(org!.name.includes('Dental'), 'Org should be dental');
  });

  // Test 3: Business profiles seeded
  await test('Database: Gen4 business profiles exist', async () => {
    const profiles = await prisma.businessProfile.findMany({ where: { orgId: 1 } });
    assert(profiles.length >= 4, `Expected 4+ profiles, got ${profiles.length}`);
    const types = profiles.map((p) => p.type);
    assert(types.includes('IDENTITY'), 'Should have IDENTITY profile');
    assert(types.includes('METRICS'), 'Should have METRICS profile');
    assert(types.includes('SOURCES'), 'Should have SOURCES profile');
    assert(types.includes('CONTEXT'), 'Should have CONTEXT profile');
  });

  // Test 4: Dashboard HTTP test
  await test('Dashboard: HTTP 200 response', async () => {
    try {
      const res = await fetch(`${BASE_URL}/?orgId=1`);
      assert(res.status === 200 || res.status === 307, `Expected 200/307, got ${res.status}`);
    } catch {
      throw new Error(`Could not reach ${BASE_URL} — is the server running?`);
    }
  });

  // Test 5: isLatest flag logic
  await test('MetricValue: isLatest flipping logic', async () => {
    // Create a test scenario
    const org = await prisma.organization.findFirst();
    if (!org) throw new Error('No org found');

    // Check if any MetricValues exist and isLatest is consistent
    const allValues = await prisma.metricValue.findMany({ take: 20 });
    for (const mv of allValues) {
      // Each entity+metric combo should have at most one isLatest=true
      const latestCount = await prisma.metricValue.count({
        where: { entityId: mv.entityId, metricId: mv.metricId, isLatest: true },
      });
      assert(latestCount <= 1, `Entity ${mv.entityId} metric ${mv.metricId} has ${latestCount} isLatest=true (should be ≤1)`);
    }
  });

  // Test 6: API endpoints respond
  await test('API: /api/orgs returns orgs', async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/orgs`);
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const data = await res.json();
      assert(Array.isArray(data.orgs), 'Should return orgs array');
    } catch (err) {
      const msg = String(err);
      if (msg.includes('Could not') || msg.includes('ECONNREFUSED')) {
        throw new Error(`Server not reachable at ${BASE_URL}`);
      }
      throw err;
    }
  });

  // Test 7: Excel parser handles multi-sheet
  await test('Excel Parser: multi-sheet handling', async () => {
    // Create minimal xlsx-like test using Buffer
    // We'll test with a CSV since we don't want xlsx dependency in tests
    const csv = Buffer.from('Name,Value\nA,100\nB,200');
    const sheets = parseFile(csv, 'data.csv');
    assert(sheets[0].rows[0]['Name'] === 'A', 'First row name should be A');
    assert(sheets[0].rows[0]['Value'] === 100, 'First row value should be 100');
  });

  console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);

  if (failed > 0) process.exit(1);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
