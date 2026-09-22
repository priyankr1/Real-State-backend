/**
 * Seeds the Home, About Us and site-settings documents.
 *
 *   node scripts/seedSiteContent.js            # only writes keys that do not exist
 *   node scripts/seedSiteContent.js --force    # overwrites whatever is there
 *   node scripts/seedSiteContent.js --draft    # seed unpublished, publish by hand
 *
 * The content is read from the frontend's `src/content/merlin-site-content.json`,
 * which is the same file the frontend compiles in as its offline fallback.
 * Seeding from that one file rather than from a copy kept here is what stops
 * the database and the shipped defaults drifting apart — the failure mode being
 * a homepage that renders one thing locally and another in production, with no
 * obvious reason why.
 *
 * Every document goes through `normalizeSiteContent`, the same validator the
 * admin API uses. A seed that could write a shape the API would reject is a
 * seed that produces a database the admin panel cannot open.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

import SiteContent from '../models/siteContentModel.js';
import {
  normalizeSiteContent,
  SITE_CONTENT_KEYS,
  SITE_CONTENT_LABELS,
} from '../controller/siteContentController.js';

dotenv.config({ path: './.env.local' });
dotenv.config({ path: './.env' });

const here = path.dirname(fileURLToPath(import.meta.url));

/** Where the canonical content lives, relative to backend/scripts. */
const DEFAULT_CONTENT_PATH = path.resolve(
  here,
  '../../Real-Estate-Website/frontend/src/content/merlin-site-content.json'
);

const args = process.argv.slice(2);
const force = args.includes('--force');
const asDraft = args.includes('--draft');
const fileArg = args.find((arg) => arg.startsWith('--file='));
const contentPath = fileArg ? path.resolve(fileArg.slice('--file='.length)) : DEFAULT_CONTENT_PATH;

async function main() {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is not set. Add it to backend/.env.local.');
  }

  if (!fs.existsSync(contentPath)) {
    // The backend deploys on its own (Render root directory `backend`), so the
    // frontend file is not always alongside it. Say so plainly rather than
    // failing on a JSON parse error three lines later.
    throw new Error(
      `Content file not found: ${contentPath}\n` +
        'Run this from the monorepo, or pass --file=/path/to/merlin-site-content.json'
    );
  }

  const raw = JSON.parse(fs.readFileSync(contentPath, 'utf8'));

  await mongoose.connect(process.env.MONGO_URI);
  console.log(`Connected to MongoDB\nReading ${contentPath}\n`);

  const status = asDraft ? 'draft' : 'published';

  for (const key of SITE_CONTENT_KEYS) {
    if (!raw[key]) {
      console.log(`· ${key.padEnd(9)} skipped — no "${key}" block in the content file`);
      continue;
    }

    const existing = await SiteContent.findOne({ key });
    if (existing && !force) {
      console.log(`· ${key.padEnd(9)} exists (rev ${existing.revision}) — left alone, use --force`);
      continue;
    }

    const doc = existing || new SiteContent({ key });
    doc.label = SITE_CONTENT_LABELS[key];
    doc.data = normalizeSiteContent(key, raw[key]);
    doc.status = status;
    doc.revision = (doc.revision || 0) + 1;
    doc.updatedBy = 'seed';
    // `data` is Mixed — without this Mongoose cannot see the nested tree
    // changed and the save is a silent no-op.
    doc.markModified('data');
    await doc.save();

    console.log(`✓ ${key.padEnd(9)} ${existing ? 'updated' : 'created'} (${status}, rev ${doc.revision})`);
  }

  console.log('\nDone. The frontend picks these up within its ISR window (300s),');
  console.log('or immediately if REVALIDATE_SECRET and FRONTEND_URL are configured.');
}

main()
  .catch((error) => {
    console.error('\nSeed failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close().catch(() => {});
  });
