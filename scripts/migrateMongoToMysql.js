/**
 * Copy every MongoDB collection into its corresponding MySQL document table.
 *
 * The migration is idempotent: existing IDs are updated, new IDs are inserted,
 * and rows not present in MongoDB are left untouched. Run the application only
 * after the final verification pass to avoid writes occurring in both systems.
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectdb, { closeDatabase, getPool } from '../config/mysql.js';

if (process.env.NODE_ENV !== 'production') dotenv.config({ path: './.env.local' });
dotenv.config();

const args = process.argv.slice(2);
const collectionArg = args.find((arg) => arg.startsWith('--collections='));
const selectedCollections = collectionArg
  ? new Set(collectionArg.split('=', 2)[1].split(',').map((value) => value.trim()).filter(Boolean))
  : null;
const batchSize = Math.max(1, Math.min(1000, Number(args.find((arg) => arg.startsWith('--batch-size='))?.split('=')[1] || 200)));

const safeName = (name) => {
  if (!/^[a-z0-9_]+$/i.test(name)) throw new Error(`Unsafe collection name: ${name}`);
  return name;
};

const normalize = (value) => {
  if (value == null) return value;
  if (value instanceof Date) return value.toISOString();
  if (value?._bsontype === 'ObjectId') return value.toHexString();
  if (value?._bsontype === 'Decimal128') return value.toString();
  if (Buffer.isBuffer(value)) return value.toString('base64');
  if (Array.isArray(value)) return value.map(normalize);
  if (typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalize(item)]));
  return value;
};

async function ensureTable(collection) {
  const table = `mongo_${safeName(collection)}`;
  await getPool().query(`CREATE TABLE IF NOT EXISTS \`${table}\` (
    id CHAR(24) NOT NULL PRIMARY KEY,
    document LONGTEXT NOT NULL,
    created_at DATETIME(3) NULL,
    updated_at DATETIME(3) NULL,
    INDEX idx_created_at (created_at),
    INDEX idx_updated_at (updated_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  return table;
}

async function writeBatch(table, documents) {
  if (!documents.length) return;
  const placeholders = documents.map(() => '(?, ?, ?, ?)').join(',');
  const values = documents.flatMap((document) => [
    String(document._id),
    JSON.stringify(document),
    document.createdAt ? new Date(document.createdAt) : null,
    document.updatedAt ? new Date(document.updatedAt) : null,
  ]);
  await getPool().query(
    `INSERT INTO \`${table}\` (id, document, created_at, updated_at) VALUES ${placeholders}
     ON DUPLICATE KEY UPDATE document=VALUES(document), created_at=VALUES(created_at), updated_at=VALUES(updated_at)`,
    values
  );
}

async function main() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required for the source database');
  for (const key of ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD']) {
    if (!process.env[key]) throw new Error(`${key} is required for the destination database`);
  }

  // Connect separately so a cPanel networking/configuration failure identifies
  // which side failed instead of being hidden inside Promise.all.
  await connectdb();
  await mongoose.connect(process.env.MONGO_URI);
  const source = mongoose.connection.db;
  const available = (await source.listCollections({}, { nameOnly: true }).toArray())
    .map(({ name }) => name)
    .filter((name) => !name.startsWith('system.'));
  const collections = selectedCollections ? available.filter((name) => selectedCollections.has(name)) : available;

  if (!collections.length) throw new Error('No source collections matched the migration selection');
  console.log(`Migrating ${collections.length} collection(s) in batches of ${batchSize}...`);

  const summary = [];
  for (const collectionName of collections) {
    const table = await ensureTable(collectionName);
    const cursor = source.collection(collectionName).find({}).batchSize(batchSize);
    let batch = [];
    let copied = 0;
    for await (const raw of cursor) {
      batch.push(normalize(raw));
      if (batch.length >= batchSize) {
        await writeBatch(table, batch);
        copied += batch.length;
        batch = [];
      }
    }
    await writeBatch(table, batch);
    copied += batch.length;
    const [[{ count: destinationCount }]] = await getPool().query(`SELECT COUNT(*) AS count FROM \`${table}\``);
    const sourceCount = await source.collection(collectionName).countDocuments();
    const verified = Number(destinationCount) >= sourceCount && copied === sourceCount;
    summary.push({ collection: collectionName, source: sourceCount, copied, destination: Number(destinationCount), verified });
    console.log(`${collectionName}: ${copied}/${sourceCount} copied; destination has ${destinationCount} (${verified ? 'verified' : 'CHECK REQUIRED'})`);
  }

  if (summary.some((item) => !item.verified)) throw new Error('Migration completed with count mismatches');
  console.log('Migration and count verification completed successfully.');
}

main()
  .catch((error) => {
    const reason = error?.message || error?.code || String(error) || 'unknown error';
    console.error(`Migration failed: ${reason}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
    await closeDatabase().catch(() => {});
  });

