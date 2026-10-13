/**
 * One-off: write a phpMyAdmin import of every Mongo collection.
 * Same table shape as scripts/migrateMongoToMysql.js.
 */
import { writeFileSync } from 'fs';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config({ path: './.env.local' });

const outPath = new URL('./cpanel-data-import.sql', import.meta.url);

const normalize = (value) => {
  if (value == null) return value;
  if (value instanceof Date) return value.toISOString();
  if (value?._bsontype === 'ObjectId') return value.toHexString();
  if (value?._bsontype === 'Decimal128') return value.toString();
  if (Buffer.isBuffer(value)) return value.toString('base64');
  if (Array.isArray(value)) return value.map(normalize);
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalize(item)]));
  }
  return value;
};

const sqlString = (value) => {
  if (value == null) return 'NULL';
  const escaped = String(value)
    .replace(/\\/g, '\\\\')
    .replace(/\0/g, '\\0')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\u001a/g, '\\Z')
    .replace(/'/g, "\\'");
  return `'${escaped}'`;
};

const sqlDate = (value) => {
  if (!value) return 'NULL';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'NULL';
  return sqlString(date.toISOString().slice(0, 23).replace('T', ' '));
};

const safeName = (name) => {
  if (!/^[a-z0-9_]+$/i.test(name)) throw new Error(`Unsafe collection name: ${name}`);
  return name;
};

await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 20000 });
const source = mongoose.connection.db;
const names = (await source.listCollections({}, { nameOnly: true }).toArray())
  .map(({ name }) => name)
  .filter((name) => !name.startsWith('system.'))
  .sort();

const chunks = [
  '-- Full MongoDB copy for wtcsaltlake_db. Import this in phpMyAdmin while that database is selected.',
  'SET NAMES utf8mb4;',
  'SET FOREIGN_KEY_CHECKS=0;',
  '',
];

let documents = 0;
for (const collectionName of names) {
  const table = `mongo_${safeName(collectionName)}`;
  const rawDocs = await source.collection(collectionName).find({}).toArray();
  const docs = rawDocs.map(normalize);
  const widest = docs.reduce((max, doc) => Math.max(max, String(doc._id || '').length), 0);
  if (widest > 24) throw new Error(`${collectionName} has an id longer than 24 characters`);

  chunks.push(`CREATE TABLE IF NOT EXISTS \`${table}\` (
  id CHAR(24) NOT NULL PRIMARY KEY,
  document LONGTEXT NOT NULL,
  created_at DATETIME(3) NULL,
  updated_at DATETIME(3) NULL,
  INDEX idx_created_at (created_at),
  INDEX idx_updated_at (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);

  const batchSize = 100;
  for (let i = 0; i < docs.length; i += batchSize) {
    const batch = docs.slice(i, i + batchSize);
    const values = batch.map((doc) => `(${[
      sqlString(String(doc._id)),
      sqlString(JSON.stringify(doc)),
      sqlDate(doc.createdAt),
      sqlDate(doc.updatedAt),
    ].join(', ')})`).join(',\n');
    chunks.push(
      `INSERT INTO \`${table}\` (id, document, created_at, updated_at) VALUES\n${values}\nON DUPLICATE KEY UPDATE document=VALUES(document), created_at=VALUES(created_at), updated_at=VALUES(updated_at);`
    );
  }
  documents += docs.length;
  console.log(`${collectionName}: ${docs.length}`);
}

chunks.push('SET FOREIGN_KEY_CHECKS=1;', '');
writeFileSync(outPath, chunks.join('\n'));
console.log(`Wrote ${documents} documents`);
await mongoose.disconnect();
