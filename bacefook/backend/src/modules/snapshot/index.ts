import { CONFIG } from 'cmd/api/config';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { GraphModule } from 'modules/graph';
import type { SequencedConnectionEvent } from 'modules/graph/types';
import { MongoClient } from 'mongodb';
import path from 'path';

const uri = CONFIG.MONGO_URI;
const dbName = CONFIG.MONGO_DB;
const collectionName = 'relationship_events';
const DEFAULT_BATCH_SIZE = 100_000;
const OUTPUT_DIR = 'snapshots';
const SNAPSHOT_INTERVAL_MS = 5000;

export let firstSnapshotTime: Date | null = null;
export let lastSnapshotTime: Date | null = null;

function formatFileName(from: number, to: number): string {
  return `snapshot_${String(from).padStart(12, '0')}_to_${String(to).padStart(12, '0')}.json`;
}

async function loadMeta(): Promise<{ total: number; files: number; batchSize: number } | null> {
  const metaPath = path.join(OUTPUT_DIR, 'snapshot.meta.json');
  if (!existsSync(metaPath)) return null;
  try {
    const content = await Bun.file(metaPath).text();
    return JSON.parse(content);
  } catch {
    return null;
  }
}

async function syncSnapshotsFromMongo() {
  console.log(`[${new Date().toISOString()}] Connecting to MongoDB...`);
  const client = new MongoClient(uri);
  await client.connect();

  const db = client.db(dbName);
  const col = db.collection(collectionName);

  console.log(`[${new Date().toISOString()}] Counting documents...`);
  const total = await col.countDocuments();
  console.log(`[${new Date().toISOString()}] 🧮 Total: ${total} documents`);

  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR);
  }

  const meta = await loadMeta();
  const completedFiles = meta?.files ?? 0;
  const batchSize = meta?.batchSize ?? DEFAULT_BATCH_SIZE;
  let resumeFrom = completedFiles * batchSize;

  if (resumeFrom >= total) {
    console.log(`[${new Date().toISOString()}] 🛑 Nothing to write. Already in sync with DB.`);
    await client.close();
    return;
  }

  console.log(`[${new Date().toISOString()}] ↪️ Resuming from offset: ${resumeFrom}`);
  const cursor = col.find().skip(resumeFrom);

  let batch: any[] = [];
  let written = resumeFrom;
  let newFileCount = 0;

  console.log(`[${new Date().toISOString()}] 📦 Starting snapshot batching...`);

  for await (const doc of cursor) {
    batch.push(doc);
    if (batch.length === batchSize) {
      const from = written;
      const to = written + batchSize - 1;
      const fileName = path.join(OUTPUT_DIR, formatFileName(from, to));
      writeFileSync(fileName, JSON.stringify(batch));
      console.log(`[${new Date().toISOString()}] ✅ Wrote ${fileName}`);
      written += batchSize;
      newFileCount++;
      batch = [];
    }
  }

  if (batch.length > 0) {
    const from = written;
    const to = written + batch.length - 1;
    const fileName = path.join(OUTPUT_DIR, formatFileName(from, to));
    writeFileSync(fileName, JSON.stringify(batch));
    console.log(`[${new Date().toISOString()}] ✅ Wrote ${fileName}`);
    newFileCount++;
  }

  const updatedMeta = {
    total,
    files: completedFiles + newFileCount,
    batchSize,
  };
  writeFileSync(path.join(OUTPUT_DIR, 'snapshot.meta.json'), JSON.stringify(updatedMeta, null, 2));
  console.log(`[${new Date().toISOString()}] 📝 Updated snapshot.meta.json`);

  await client.close();
  console.log(`[${new Date().toISOString()}] MongoDB connection closed.`);
}

async function ingestSnapshotsToGraph() {
  const graph = new GraphModule();

  const files = readdirSync(OUTPUT_DIR)
    .filter((f) => f.startsWith('snapshot_') && f.endsWith('.json'))
    .sort();

  const allEvents: { offset: number; createdAt: string; event: any }[] = [];

  let totalReadMs = 0;
  for (const file of files) {
    const fullPath = path.join(OUTPUT_DIR, file);
    const readStart = performance.now();
    const raw = readFileSync(fullPath, 'utf-8');
    const events = JSON.parse(raw);
    const readEnd = performance.now();

    allEvents.push(...events);
    totalReadMs += readEnd - readStart;
  }

  allEvents.sort((a, b) => a.offset - b.offset);

  const seenOffsets = new Set<number>();
  let totalIngestMs = 0;
  let nextSnapshotTime: Date | null = null;
  let snapshotIndex = 0;

  const ingestStart = performance.now();

  let firstRecordTime: Date | null = null;
  let lastRecordTime: Date | null = null;

  for (let i = 0; i < allEvents.length; i++) {
    const raw = allEvents[i]!;
    if (seenOffsets.has(raw.offset)) continue;
    seenOffsets.add(raw.offset);

    const ev: SequencedConnectionEvent = {
      ...raw.event,
      seq: raw.offset,
    };

    const createdAt = new Date(raw.createdAt);
    if (isNaN(createdAt.getTime())) {
      console.warn(`⚠️ Skipping invalid createdAt: ${raw.createdAt}`);
      continue;
    }

    const result = graph.ingest(ev);
    if (!result.applied) {
      console.warn(`⚠️ Event not applied: ${JSON.stringify(ev)}`);
      continue;
    }

    if (i === 0) {
      firstRecordTime = createdAt;
      const firstSnapName = `graph_snapshot_${firstRecordTime.toISOString().replace(/[:.]/g, '-')}.json`;
      const firstSnapPath = path.join(OUTPUT_DIR, firstSnapName);
      writeFileSync(firstSnapPath, JSON.stringify(graph.snapshot()));
      console.log(`📸 First record snapshot saved: ${firstSnapName}`);
    }

    if (!nextSnapshotTime) {
      const ms = createdAt.getTime();
      nextSnapshotTime = new Date(ms - (ms % SNAPSHOT_INTERVAL_MS) + SNAPSHOT_INTERVAL_MS);
    }

    while (createdAt >= nextSnapshotTime) {
      const snapName = `graph_snapshot_${nextSnapshotTime.toISOString().replace(/[:.]/g, '-')}.json`;
      const snapPath = path.join(OUTPUT_DIR, snapName);
      const snapshot = graph.snapshot();
      writeFileSync(snapPath, JSON.stringify(snapshot));
      console.log(`📸 Snapshot saved: ${snapName} with ${snapshot.length} users`);
      snapshotIndex++;
      nextSnapshotTime = new Date(nextSnapshotTime.getTime() + SNAPSHOT_INTERVAL_MS);
    }

    lastRecordTime = createdAt;
  }

  if (lastRecordTime) {
    const finalSnapName = `graph_snapshot_${lastRecordTime.toISOString().replace(/[:.]/g, '-')}.json`;
    const finalSnapPath = path.join(OUTPUT_DIR, finalSnapName);
    writeFileSync(finalSnapPath, JSON.stringify(graph.snapshot()));
    console.log(`📸 Last record snapshot saved: ${finalSnapName}`);
  }

  const ingestEnd = performance.now();
  totalIngestMs += ingestEnd - ingestStart;

  console.log(`\n🧮 Total read time: ${totalReadMs.toFixed(2)} ms`);
  console.log(`⚙️  Total ingest time: ${totalIngestMs.toFixed(2)} ms`);
  console.log(
    `📸 Snapshots written: ${snapshotIndex + (firstRecordTime ? 1 : 0) + (lastRecordTime ? 1 : 0)}`,
  );
  console.log(`⏱️  Total time: ${(totalReadMs + totalIngestMs).toFixed(2)} ms`);

  firstSnapshotTime = firstRecordTime;
  lastSnapshotTime = lastRecordTime;
}

export async function syncAndIngestSnapshots() {
  const t0 = performance.now();
  await syncSnapshotsFromMongo();
  const t1 = performance.now();
  console.log(`⏱️ Sync finished in ${(t1 - t0).toFixed(2)} ms`);

  const t2 = performance.now();
  await ingestSnapshotsToGraph();
  const t3 = performance.now();
  console.log(`⏱️ Read + Ingest finished in ${(t3 - t2).toFixed(2)} ms`);
}

export function getClosestSnapshotPath(date: Date): string | null {
  const files = readdirSync(OUTPUT_DIR)
    .filter((f) => f.startsWith('graph_snapshot_') && f.endsWith('.json'))
    .sort();

  if (files.length === 0) {
    console.warn('[getClosestSnapshotPath] No snapshot files found');
    return null;
  }

  const target = date.getTime();
  let closest: string | null = null;
  let closestDiff = Infinity;

  for (const file of files) {
    const tsPart = file.replace('graph_snapshot_', '').replace('.json', '');

    // This preserves the date part, and only fixes the time part
    const iso = tsPart.replace(/T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/, 'T$1:$2:$3.$4Z');

    const parsedTs = Date.parse(iso);
    if (isNaN(parsedTs)) {
      console.warn(`[getClosestSnapshotPath] Skipping invalid timestamp: ${tsPart} → ${iso}`);
      continue;
    }

    const diff = Math.abs(parsedTs - target);

    if (diff < closestDiff) {
      closestDiff = diff;
      closest = file;
    }
  }

  if (closest) {
    return path.join(OUTPUT_DIR, closest);
  } else {
    console.warn('[getClosestSnapshotPath] No valid snapshot timestamps parsed');
    return null;
  }
}

export function loadSnapshotByDate(date: Date): any[] | null {
  const path = getClosestSnapshotPath(date);
  if (!path || !existsSync(path)) return null;
  const raw = readFileSync(path, 'utf-8');
  return JSON.parse(raw);
}
