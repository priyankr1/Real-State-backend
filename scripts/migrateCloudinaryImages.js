/**
 * Copy every Cloudinary image referenced by the imported database into the
 * cPanel uploads folder layout, and write a SQL file that rewrites those URLs.
 *
 * Source of the URLs is scripts/cpanel-data-import.sql (the copy already in
 * wtcsaltlake_db). Run from backend/:
 *   node scripts/migrateCloudinaryImages.js
 *
 * Then, in cPanel:
 *   1. Upload cpanel-upload-pack/uploads into public_html/uploads
 *   2. Import cpanel-upload-pack/rewrite-urls.sql in phpMyAdmin
 */
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dumpPath = path.join(root, 'scripts', 'cpanel-data-import.sql');
const packDir = path.join(root, 'cpanel-upload-pack');
const filesDir = path.join(packDir, 'uploads');
const publicBase = 'https://wtcsaltlake.com/uploads';

const URL_RE = /https?:\/\/res\.cloudinary\.com\/[^\s"'\\<>)]+/g;

const storagePath = (url) => {
  const uploadAt = url.indexOf('/upload/');
  if (uploadAt === -1) return null;
  const parts = url.slice(uploadAt + '/upload/'.length).split('?')[0].split('/');
  const kept = parts.filter((part) => part && !/^v\d+$/.test(part) && !part.includes(',') && !/^[a-z]{1,3}_/.test(part));
  const relative = kept.join('/');
  if (!/^[a-z0-9_./-]+\.[a-z0-9]+$/i.test(relative) || relative.includes('..')) return null;
  return relative;
};

const sqlString = (value) =>
  `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

const sql = fs.readFileSync(dumpPath, 'utf8');
const urls = [...new Set(sql.match(URL_RE) || [])];
const tables = [...sql.matchAll(/INSERT INTO `([^`]+)`/g)].map((match) => match[1]);
const uniqueTables = [...new Set(tables)];

const mapping = [];
const skipped = [];
for (const url of urls) {
  const relative = storagePath(url);
  if (!relative) {
    skipped.push(url);
    continue;
  }
  mapping.push({ url, relative, local: path.join(filesDir, ...relative.split('/')) });
}

console.log(`Found ${mapping.length} image URL(s) across ${uniqueTables.length} table(s).`);
if (skipped.length) console.log(`Skipped ${skipped.length} URL(s) with an unexpected path.`);

let downloaded = 0;
let failed = 0;
for (const item of mapping) {
  await fsp.mkdir(path.dirname(item.local), { recursive: true });
  if (fs.existsSync(item.local) && fs.statSync(item.local).size > 0) {
    downloaded += 1;
    continue;
  }
  const response = await fetch(item.url);
  if (!response.ok) {
    failed += 1;
    console.log(`FAIL ${response.status} ${item.relative}`);
    item.failed = true;
    continue;
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  await fsp.writeFile(item.local, bytes);
  downloaded += 1;
  console.log(`saved ${item.relative} (${bytes.length} bytes)`);
}

const ok = mapping.filter((item) => !item.failed);
const statements = [
  '-- Rewrites Cloudinary URLs to files under public_html/uploads.',
  '-- Import this in phpMyAdmin while wtcsaltlake_db is selected.',
  'SET NAMES utf8mb4;',
  '',
];
for (const table of uniqueTables) {
  for (const item of ok) {
    if (!sql.includes(item.url)) continue;
    const next = `${publicBase}/${item.relative}`;
    statements.push(
      `UPDATE \`${table}\` SET document = REPLACE(document, ${sqlString(item.url)}, ${sqlString(next)}) WHERE document LIKE ${sqlString(`%${item.url}%`)};`
    );
  }
}
statements.push('');
await fsp.mkdir(packDir, { recursive: true });
await fsp.writeFile(path.join(packDir, 'rewrite-urls.sql'), statements.join('\n'));

console.log(`Downloaded ${downloaded}. Failed ${failed}.`);
console.log(`SQL: ${path.join(packDir, 'rewrite-urls.sql')}`);
console.log(`Files: ${filesDir}`);
