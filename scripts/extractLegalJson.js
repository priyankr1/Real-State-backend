import fs from 'fs';

const text = fs.readFileSync(
  new URL('../../Real-Estate-Website/frontend/src/content/legal-copy.ts', import.meta.url),
  'utf8'
);
const site = 'https://www.wtcsaltlake.com/';

function grab(key) {
  const marker = key === 'disclaimer' ? 'disclaimer:' : "'privacy-policy':";
  const start = text.indexOf(marker);
  const token = 'content: `';
  const contentIdx = text.indexOf(token, start);
  const end = text.indexOf('`.trim()', contentIdx);
  const content = text
    .slice(contentIdx + token.length, end)
    .replaceAll('${SITE}', site)
    .trim();
  const description =
    key === 'disclaimer'
      ? 'Disclaimer for the WTC Centre Salt Lake website: how information, imagery and commercial details on wtcsaltlake.com may be used.'
      : 'How WTC Centre Salt Lake collects, uses, stores and shares personal information submitted through wtcsaltlake.com.';
  return {
    key,
    title: key === 'disclaimer' ? 'Disclaimer' : 'Privacy Policy',
    description,
    content,
  };
}

const pages = [grab('disclaimer'), grab('privacy-policy')];
fs.writeFileSync(new URL('./wtc-legal.json', import.meta.url), JSON.stringify(pages));
console.log(pages.map((page) => `${page.key} ${page.content.length}`).join('\n'));
