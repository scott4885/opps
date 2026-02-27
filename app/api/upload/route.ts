import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseFile } from '@/lib/excel-parser';
import { mapFileToMetrics } from '@/lib/ai-mapper';
import { runOpportunityEngine } from '@/lib/opportunity-engine';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const orgIdStr = formData.get('orgId') as string | null;

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    if (!orgIdStr) return NextResponse.json({ error: 'orgId required' }, { status: 400 });
    const orgId = parseInt(orgIdStr);

    // Get org and business profile for context
    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });

    const profiles = await prisma.businessProfile.findMany({ where: { orgId } });
    const businessProfile = profiles.map((p) => `## ${p.type}\n${p.content}`).join('\n\n');

    // Parse file
    const buffer = Buffer.from(await file.arrayBuffer());
    const sheets = parseFile(buffer, file.name);

    let totalEntitiesProcessed = 0;
    let totalMetricsCreated = 0;
    let uploadId = 0;

    for (const sheet of sheets) {
      if (sheet.rows.length === 0) continue;

      // AI mapping
      let mapping;
      try {
        mapping = await mapFileToMetrics(
          sheet.sheetName,
          sheet.headers,
          sheet.rows as Record<string, unknown>[],
          businessProfile || `Organization: ${org.name}, Industry: ${org.industry || 'General'}`
        );
      } catch (err) {
        console.error('[upload] AI mapping failed for sheet', sheet.sheetName, err);
        continue;
      }

      if (!mapping.fields || mapping.fields.length === 0) continue;

      // Find or create DataSource
      let dataSource = await prisma.dataSource.findFirst({
        where: { orgId, name: mapping.dataSourceName },
      });
      if (!dataSource) {
        dataSource = await prisma.dataSource.create({
          data: { orgId, name: mapping.dataSourceName },
        });
      }

      // Create Upload record
      const upload = await prisma.upload.create({
        data: {
          orgId,
          dataSourceId: dataSource.id,
          filename: file.name,
          rowCount: sheet.rows.length,
          fieldCount: mapping.fields.length,
          mappingSummary: JSON.stringify(mapping),
        },
      });
      uploadId = upload.id;

      // Resolve aliases (for entity matching)
      const allAliases = await prisma.entityAlias.findMany({
        where: { entity: { orgId } },
        include: { entity: true },
      });
      const aliasMap = new Map(allAliases.map((a) => [a.alias.toLowerCase(), a.entity]));

      // Process rows
      for (const row of sheet.rows) {
        const entityName = mapping.entityColumn ? row[mapping.entityColumn] : null;
        if (!entityName || typeof entityName !== 'string' || !entityName.trim()) continue;

        const name = entityName.trim();

        // Resolve or create entity
        let entity = aliasMap.get(name.toLowerCase());
        if (!entity) {
          // Try direct match
          entity = await prisma.entity.findUnique({
            where: { orgId_canonicalName: { orgId, canonicalName: name } },
          });
          if (!entity) {
            entity = await prisma.entity.create({
              data: { orgId, canonicalName: name, entityType: mapping.entityType },
            });
            // Register as alias too
            await prisma.entityAlias.upsert({
              where: { alias_entityId: { alias: name.toLowerCase(), entityId: entity.id } },
              update: {},
              create: { entityId: entity.id, alias: name.toLowerCase(), source: file.name },
            });
          }
          aliasMap.set(name.toLowerCase(), entity);
          totalEntitiesProcessed++;
        }

        // Process each metric field
        for (const field of mapping.fields) {
          const rawValue = row[field.column];
          if (rawValue === null || rawValue === undefined || rawValue === '') continue;
          const numValue = parseFloat(String(rawValue).replace(/[$,%]/g, ''));
          if (isNaN(numValue)) continue;

          // Find or create Metric
          let metric = await prisma.metric.findUnique({
            where: { orgId_slug: { orgId, slug: field.metricSlug } },
          });
          if (!metric) {
            metric = await prisma.metric.create({
              data: {
                orgId,
                name: field.metricName,
                slug: field.metricSlug,
                category: field.category,
                unit: field.unit,
                description: field.description,
                aiGenerated: true,
              },
            });
            totalMetricsCreated++;
          }

          // Mark previous values as not latest
          await prisma.metricValue.updateMany({
            where: { entityId: entity.id, metricId: metric.id, isLatest: true },
            data: { isLatest: false },
          });

          // Create new MetricValue
          await prisma.metricValue.upsert({
            where: {
              entityId_metricId_uploadId: {
                entityId: entity.id,
                metricId: metric.id,
                uploadId: upload.id,
              },
            },
            update: { value: numValue, isLatest: true },
            create: {
              entityId: entity.id,
              metricId: metric.id,
              uploadId: upload.id,
              value: numValue,
              isLatest: true,
            },
          });
        }
      }
    }

    // Run opportunity engine async (don't await — return to client faster)
    runOpportunityEngine(orgId).catch((err) =>
      console.error('[upload] opportunity engine error', err)
    );

    return NextResponse.json({
      ok: true,
      uploadId,
      entitiesProcessed: totalEntitiesProcessed,
      metricsCreated: totalMetricsCreated,
      sheetsProcessed: sheets.length,
      message: 'File processed. Opportunities are being generated in the background.',
    });
  } catch (error) {
    console.error('[upload POST]', error);
    return NextResponse.json(
      { error: 'Upload failed', details: String(error) },
      { status: 500 }
    );
  }
}
