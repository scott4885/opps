import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseFile } from '@/lib/excel-parser';
import { mapFileToMetrics } from '@/lib/ai-mapper';
import { runOpportunityEngine } from '@/lib/opportunity-engine';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { cookies } from 'next/headers';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

// ---------- MasterLookup / Crosswalk detection ----------

/**
 * Returns true if the sheet looks like a MasterLookup / crosswalk file.
 * Heuristics:
 *  - Filename contains "master", "lookup", "crosswalk", or "alias"
 *  - OR headers contain >= 4 alias-style columns (Alias, AKA, DBA, Alt Name, Nickname…)
 *  - OR first non-entity column is named "Canonical" or "Official Name"
 */
function isMasterLookupSheet(
  filename: string,
  sheetName: string,
  headers: string[]
): boolean {
  const nameHint = /master|lookup|crosswalk|alias/i.test(filename) ||
    /master|lookup|crosswalk|alias/i.test(sheetName);
  if (nameHint) return true;

  const aliasKeywords = /alias|aka|dba|alt.?name|nickname|other.?name|also.?known/i;
  const aliasCount = headers.filter((h) => aliasKeywords.test(h)).length;
  if (aliasCount >= 3) return true;

  // If the first two headers imply canonical vs alias pattern
  const first = (headers[0] ?? '').toLowerCase();
  const second = (headers[1] ?? '').toLowerCase();
  if (
    (first.includes('canonical') || first.includes('official') || first.includes('legal')) &&
    (second.includes('alias') || second.includes('aka') || second.includes('name'))
  ) return true;

  return false;
}

/**
 * Process a MasterLookup sheet:
 * - Column 0: canonical name
 * - Remaining columns: aliases (skip blanks)
 * - Column E (index 4) if present and header looks like "ops director" / "director": extract to entity metadata
 */
async function processCrosswalk(
  orgId: number,
  rows: Record<string, unknown>[],
  headers: string[],
  source: string
): Promise<{ entitiesCreated: number; aliasesMapped: number }> {
  let entitiesCreated = 0;
  let aliasesMapped = 0;

  // Identify the canonical name column (first header)
  const canonicalCol = headers[0];

  // Identify alias columns (all except canonical, and except ops-director-like col)
  const directorColIdx = headers.findIndex((h) =>
    /ops.?director|director|manager/i.test(h)
  );
  const directorCol = directorColIdx >= 0 ? headers[directorColIdx] : null;

  const aliasColumns = headers.filter((h, i) => i !== 0 && i !== directorColIdx);

  for (const row of rows) {
    const canonical = row[canonicalCol];
    if (!canonical || typeof canonical !== 'string' || !canonical.trim()) continue;
    const canonicalName = canonical.trim();

    const opsDirector = directorCol ? String(row[directorCol] ?? '').trim() || null : null;

    // Find or create entity
    let entity = await prisma.entity.findUnique({
      where: { orgId_canonicalName: { orgId, canonicalName } },
    });
    if (!entity) {
      entity = await prisma.entity.create({
        data: {
          orgId,
          canonicalName,
          entityType: 'location',
          metadata: opsDirector ? { opsDirector } : undefined,
        },
      });
      entitiesCreated++;
    } else if (opsDirector && entity.metadata) {
      // Update metadata with ops director if missing
      const meta = entity.metadata as Record<string, unknown>;
      if (!meta.opsDirector) {
        await prisma.entity.update({
          where: { id: entity.id },
          data: { metadata: { ...meta, opsDirector } },
        });
      }
    }

    // Register the canonical name itself as an alias
    await prisma.entityAlias.upsert({
      where: { alias_entityId: { alias: canonicalName.toLowerCase(), entityId: entity.id } },
      update: {},
      create: { entityId: entity.id, alias: canonicalName.toLowerCase(), source },
    });

    // Register all alias columns
    for (const col of aliasColumns) {
      const aliasRaw = row[col];
      if (!aliasRaw || typeof aliasRaw !== 'string' || !aliasRaw.trim()) continue;
      const alias = aliasRaw.trim();
      await prisma.entityAlias.upsert({
        where: { alias_entityId: { alias: alias.toLowerCase(), entityId: entity.id } },
        update: {},
        create: { entityId: entity.id, alias: alias.toLowerCase(), source },
      });
      aliasesMapped++;
    }
  }

  return { entitiesCreated, aliasesMapped };
}

// ---------- Main upload handler ----------

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const orgIdStr = formData.get('orgId') as string | null;

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    // Auth: read orgId from session
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    if (!session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    let orgId: number;
    if (session.role === 'admin' && orgIdStr) {
      orgId = parseInt(orgIdStr);
    } else if (session.orgId) {
      orgId = session.orgId;
    } else {
      return NextResponse.json({ error: 'No org associated with your account' }, { status: 400 });
    }

    // Get org and business profile for context
    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });

    const profiles = await prisma.businessProfile.findMany({ where: { orgId } });
    const businessProfile = profiles.map((p) => `## ${p.type}\n${p.content}`).join('\n\n');

    // Parse file
    const buffer = Buffer.from(await file.arrayBuffer());
    const sheets = parseFile(buffer, file.name);

    // --- Check if this is a MasterLookup / Crosswalk file ---
    // Use the first non-empty sheet for detection
    const firstSheet = sheets.find((s) => s.rows.length > 0);
    if (firstSheet && isMasterLookupSheet(file.name, firstSheet.sheetName, firstSheet.headers)) {
      // Process all sheets as crosswalk
      let totalEntitiesCreated = 0;
      let totalAliasesMapped = 0;

      for (const sheet of sheets) {
        if (sheet.rows.length === 0) continue;
        const { entitiesCreated, aliasesMapped } = await processCrosswalk(
          orgId,
          sheet.rows as Record<string, unknown>[],
          sheet.headers,
          file.name
        );
        totalEntitiesCreated += entitiesCreated;
        totalAliasesMapped += aliasesMapped;
      }

      return NextResponse.json({
        ok: true,
        isCrosswalk: true,
        entitiesCreated: totalEntitiesCreated,
        aliasesMapped: totalAliasesMapped,
        sheetsProcessed: sheets.length,
        message: `Crosswalk processed: ${totalEntitiesCreated} entities created, ${totalAliasesMapped} aliases mapped.`,
      });
    }

    // --- Regular data upload ---
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
          }) ?? undefined;
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
      isCrosswalk: false,
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
