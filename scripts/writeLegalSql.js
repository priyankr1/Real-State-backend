import fs from 'fs';
import crypto from 'crypto';

const pages = JSON.parse(fs.readFileSync(new URL('./wtc-legal.json', import.meta.url), 'utf8'));
const now = new Date().toISOString();
const esc = (value) => String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");

const statements = [
  "DELETE FROM mongo_legalpages WHERE JSON_UNQUOTE(JSON_EXTRACT(document, '$.key')) IN ('disclaimer', 'privacy-policy');",
];

for (const page of pages) {
  const id = crypto.randomBytes(12).toString('hex');
  const doc = {
    _id: id,
    key: page.key,
    title: page.title,
    content: page.content,
    effectiveDate: now,
    version: '1.0',
    status: 'published',
    seo: {
      metaTitle: page.title,
      metaDescription: page.description,
      noIndex: false,
    },
    updatedBy: 'publish-legal-script',
    createdAt: now,
    updatedAt: now,
  };
  statements.push(
    `INSERT INTO mongo_legalpages (id, document, created_at, updated_at) VALUES ('${id}', '${esc(JSON.stringify(doc))}', NOW(3), NOW(3));`
  );
}

const out = new URL('./publish-legal.sql', import.meta.url);
fs.writeFileSync(out, `${statements.join('\n')}\n`);
console.log(`wrote ${statements.length} statements`);
