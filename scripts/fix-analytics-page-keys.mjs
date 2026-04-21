/**
 * Migration: decode URL-encoded keys in userAnalytics Firestore documents.
 *
 * Converts keys like `%2Fen%2Fdashboard` → `en_dashboard` and `%2F` → `home`
 * inside the `pageViewCounts` and `pageDurationSeconds` maps, merging counts
 * when a decoded key already exists.
 *
 * Run with:
 *   GOOGLE_CLOUD_PROJECT=autotrader-b8851 node scripts/fix-analytics-page-keys.mjs
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'autotrader-b8851' });
const db = getFirestore();

/** Mirror of the Angular toPageKey() logic — decode then slugify */
function decodePageKey(raw) {
  try {
    const decoded = decodeURIComponent(raw);
    if (decoded === '/') return 'home';
    return decoded.replace(/^\//, '').replace(/\//g, '_');
  } catch {
    // already decoded or invalid — apply slugify directly
    if (raw === '/') return 'home';
    return raw.replace(/^\//, '').replace(/\//g, '_');
  }
}

/** Returns true if the key contains URL-encoded chars that need fixing */
function needsDecoding(key) {
  return /%[0-9A-Fa-f]{2}/.test(key);
}

/** Merge a map with encoded keys into clean keys, summing duplicates */
function cleanMap(original) {
  if (!original || typeof original !== 'object') return null;

  const cleaned = {};
  let changed = false;

  for (const [key, value] of Object.entries(original)) {
    const cleanKey = needsDecoding(key) ? decodePageKey(key) : key;
    if (cleanKey !== key) changed = true;

    const numValue = typeof value === 'number' ? value : (value?.integerValue ? Number(value.integerValue) : 0);
    cleaned[cleanKey] = (cleaned[cleanKey] ?? 0) + numValue;
  }

  return changed ? cleaned : null;
}

async function migrate() {
  const snapshot = await db.collection('userAnalytics').get();

  if (snapshot.empty) {
    console.log('No documents found in userAnalytics collection.');
    return;
  }

  console.log(`Found ${snapshot.size} documents. Checking for encoded keys…\n`);

  let updatedCount = 0;

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();

    const cleanedViews = cleanMap(data.pageViewCounts);
    const cleanedDuration = cleanMap(data.pageDurationSeconds);

    if (!cleanedViews && !cleanedDuration) {
      console.log(`  ${docSnap.id}: no encoded keys — skipping`);
      continue;
    }

    const update = {};

    if (cleanedViews) {
      // Remove all old pageViewCounts keys first, then set clean ones
      update.pageViewCounts = cleanedViews;
    }

    if (cleanedDuration) {
      update.pageDurationSeconds = cleanedDuration;
    }

    try {
      await docSnap.ref.update(update);
      updatedCount++;
      console.log(`  ✓ ${docSnap.id}: updated`);
      if (cleanedViews) console.log(`      pageViewCounts:     ${JSON.stringify(cleanedViews)}`);
      if (cleanedDuration) console.log(`      pageDurationSeconds: ${JSON.stringify(cleanedDuration)}`);
    } catch (err) {
      console.error(`  ✗ ${docSnap.id}: FAILED — ${err.message}`);
    }
  }

  console.log(`\nDone. Updated ${updatedCount} of ${snapshot.size} documents.`);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
