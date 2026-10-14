import fs from 'fs';
import '../config/loadEnv.js';
import connectdb from '../config/mysql.js';
import LegalPage from '../models/legalPageModel.js';

const pages = JSON.parse(fs.readFileSync(new URL('./wtc-legal.json', import.meta.url), 'utf8'));

await connectdb();

for (const page of pages) {
  const doc = (await LegalPage.findOne({ key: page.key })) || new LegalPage({ key: page.key });
  doc.title = page.title;
  doc.content = page.content;
  doc.status = 'published';
  doc.version = doc.version || '1.0';
  doc.effectiveDate = doc.effectiveDate || new Date();
  doc.seo = {
    metaTitle: page.title,
    metaDescription: page.description,
    noIndex: false,
  };
  doc.updatedBy = 'publish-legal-script';
  await doc.save();
  console.log(`published ${page.key}`);
}

process.exit(0);
