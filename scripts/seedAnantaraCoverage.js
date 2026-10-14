/**
 * Publishes the April 2026 Anantara / World Trade Center Kolkata coverage
 * into the Media, Events & Awards collection the admin panel edits.
 *
 *   node scripts/seedAnantaraCoverage.js
 *
 * Idempotent by slug. Running it again updates these records and leaves
 * every other media item alone.
 *
 * Bodies are summaries with a link to the original. They do not reproduce
 * the articles. Where a supplied clipping prints a figure that later
 * coverage states differently, both are attributed to the source that
 * printed them.
 */

import dotenv from 'dotenv';
import mongoose from '../lib/mysqlMongoose.js';

import MediaItem from '../models/mediaItemModel.js';
import { sanitizeRichText } from '../utils/sanitizeHtml.js';

dotenv.config({ path: './.env.local' });
dotenv.config({ path: './.env' });

const CEREMONY = '/merlin/media/anantara-signing-ceremony.jpg';
const TRAVTALK = '/merlin/media/anantara-travtalk.jpg';
const ET_CLIP = '/merlin/media/anantara-et-clipping.jpg';
const PLANS_CLIP = '/merlin/media/anantara-major-plans-clipping.jpg';
const TOURISM_CLIP = '/merlin/media/anantara-tourism-clipping.jpg';

const items = [
  {
    slug: 'anantara-kolkata-signing',
    kind: 'event',
    title: 'Anantara Kolkata signing at World Trade Center',
    summary:
      'Minor Hotels signed a management contract to operate a 170-key Anantara hotel at World Trade Center Kolkata, developed by Merlin Group and Aryan Realty in Salt Lake Sector V.',
    date: '2026-04-06',
    location: 'Kolkata',
    coverImage: CEREMONY,
    coverImageAlt:
      'Signing ceremony for the Anantara hotel at World Trade Center Kolkata, with Merlin and Aryan Realty on the backdrop',
    images: [
      {
        url: TRAVTALK,
        alt: 'Sushil Mohta, William Heinecke and Sanjay Saraf at the Anantara Kolkata announcement',
        caption: 'Sushil Mohta, William Heinecke and Sanjay Saraf, from coverage of the announcement.',
      },
    ],
    featured: true,
    order: 1,
    content: `
      <p>On 6 April 2026 Minor Hotels signed a management contract to operate an Anantara hotel at World Trade Center Kolkata. The campus is a joint development by Merlin Group and Aryan Realty at Block-BP, Sector V, Salt Lake. Minor Hotels operates the hotel and does not hold equity in the project.</p>
      <p>Press reports of the signing describe about 170 guest rooms and suites, two restaurants including a rooftop speciality restaurant, a ballroom, a spa, a gym and a swimming pool. The hotel is scheduled to open in 2032. It is described as Minor Hotels’ first urban Anantara in India. Reports put the hotel cost at about ₹200 crore, inside the wider World Trade Center development, which Merlin Group chairman Sushil Mohta has put at ₹2,400 crore.</p>
      <p>William Heinecke, founder and chairman of Minor International, and Sanjay Saraf, co-chairman of Aryan Realty, spoke at the announcement alongside Mr Mohta. Coverage of the signing is listed under In the media.</p>
    `,
    seo: {
      metaTitle: 'Anantara Kolkata signing at World Trade Center',
      metaDescription:
        'Minor Hotels signed to operate a 170-key Anantara hotel at World Trade Center Kolkata, opening in 2032.',
    },
  },
  {
    slug: 'pti-anantara-world-trade-centre-kolkata',
    kind: 'media',
    title: 'Minor Hotels to operate Anantara at the ₹2,400 crore World Trade Centre in Kolkata',
    summary:
      'PTI reported Minor Hotels’ management contract for an Anantara hotel at the World Trade Centre in Salt Lake, a Merlin Group and Aryan Realty development.',
    date: '2026-04-06',
    publication: 'Press Trust of India',
    externalUrl:
      'https://www.ptinews.com/story/business/minor-hotels-to-operate-anantara-property-at-rs-2-400-cr-world-trade-centre-in-kolkata/3536054',
    coverImage: CEREMONY,
    coverImageAlt: 'Signing ceremony for the Anantara hotel at World Trade Center Kolkata',
    order: 2,
    content: `
      <p>The Press Trust of India reported on 6 April 2026 that Minor Hotels will operate an Anantara hotel at the World Trade Centre in Salt Lake, Kolkata. The development is by Merlin Group and Aryan Realty.</p>
      <p>The same day’s reports, including the PTI copy carried by Rediff, describe a management contract with no equity for Minor Hotels, about 170 keys, and an opening in 2032. The hotel estimate given to PTI was about ₹200 crore. Sushil Mohta put the World Trade Center project at ₹2,400 crore.</p>
      <p><a href="https://www.ptinews.com/story/business/minor-hotels-to-operate-anantara-property-at-rs-2-400-cr-world-trade-centre-in-kolkata/3536054">Read the PTI report</a></p>
    `,
    seo: {
      metaTitle: 'PTI: Anantara to operate at World Trade Centre Kolkata',
      metaDescription:
        'PTI covered Minor Hotels’ Anantara management contract at the ₹2,400 crore World Trade Centre in Kolkata.',
    },
  },
  {
    slug: 'toi-minor-hotels-second-bengal-property',
    kind: 'media',
    title: 'Thai hotel chain plans a second Bengal property',
    summary:
      'The Times of India reported William Heinecke’s plan for a second Minor Hotels property in Bengal, after the Anantara signing at World Trade Center Kolkata.',
    date: '2026-04-07',
    publication: 'The Times of India',
    externalUrl:
      'https://timesofindia.indiatimes.com/city/kolkata/thai-star-hotel-chain-plans-second-bengal-property/articleshow/130070499.cms',
    coverImage: CEREMONY,
    coverImageAlt: 'The Anantara Kolkata announcement in Kolkata',
    featured: true,
    order: 3,
    content: `
      <p>On 7 April 2026 The Times of India reported that Minor Hotels plans a second property in Bengal. William Heinecke, founder and group chairperson, said it would be announced by the end of the year and that he would not disclose the location yet.</p>
      <p>The report describes the Sector V hotel as a 170-key Anantara with two restaurants and a ballroom, developed by Merlin Group and Aryan Realty with the World Trade Centers Association. It is Minor Hotels’ first hotel in an Indian metro. The group already operates in Jaipur and has signed properties in Visakhapatnam and Coorg. Heinecke said Minor Hotels plans 50 properties in India over the next decade, on an asset-light model, with six further Indian announcements expected by year-end.</p>
      <p>Sushil Mohta told the paper the World Trade Center is five million square feet, a ₹2,400 crore investment, expected to generate about 30,000 jobs.</p>
      <p><a href="https://timesofindia.indiatimes.com/city/kolkata/thai-star-hotel-chain-plans-second-bengal-property/articleshow/130070499.cms">Read the Times of India report</a></p>
    `,
    seo: {
      metaTitle: 'Times of India: Minor Hotels plans a second Bengal hotel',
      metaDescription:
        'The Times of India on Minor Hotels’ second Bengal property and the Anantara hotel at World Trade Center Kolkata.',
    },
  },
  {
    slug: 'et-middle-east-crisis-travellers-india',
    kind: 'media',
    title: 'Middle East crisis could drive travellers to India',
    summary:
      'The Economic Times interviewed William Heinecke on Middle East travel disruption and Minor Hotels’ India plans, including the 170-key Anantara at World Trade Center Kolkata.',
    date: '2026-04-07',
    publication: 'The Economic Times',
    externalUrl:
      'https://m.economictimes.com/industry/services/travel/middle-east-crisis-could-drive-travellers-to-india/amp_articleshow/130074695.cms',
    coverImage: ET_CLIP,
    coverImageAlt:
      'Economic Times clipping of the interview with William E. Heinecke on India travel and the Kolkata Anantara',
    order: 4,
    content: `
      <p>In an interview published by The Economic Times on 7 April 2026, William E. Heinecke said the conflict in the Middle East was postponing bookings into the fourth quarter, and that he expected more travel interest in India as a result.</p>
      <p>The interview records Minor Hotels’ plan for 50 hotels in India over the next decade, the Anantara resort signed in Coorg, and a 170-key Anantara at World Trade Center Kolkata scheduled to open in 2032. The company already runs Anantara Jewel Bagh Jaipur and has signed an Avani resort in Visakhapatnam. Heinecke said most India projects would be asset-light, while the group would also look at investments. He described the current global mix as about two-thirds owned or leased, with a target closer to half and half.</p>
      <p><a href="https://m.economictimes.com/industry/services/travel/middle-east-crisis-could-drive-travellers-to-india/amp_articleshow/130074695.cms">Read the Economic Times interview</a></p>
    `,
    seo: {
      metaTitle: 'Economic Times: Heinecke on India travel and Anantara Kolkata',
      metaDescription:
        'William Heinecke’s Economic Times interview covering India demand and the Anantara hotel at World Trade Center Kolkata.',
    },
  },
  {
    slug: 'hospitality-biz-anantara-kolkata-wtc',
    kind: 'media',
    title: 'Minor Hotels signs Anantara at Kolkata’s World Trade Centre',
    summary:
      'Hospitality Biz India reported the Anantara management contract at World Trade Center Kolkata: about 170 keys, a ₹200 crore hotel, opening in 2032.',
    date: '2026-04-06',
    publication: 'Hospitality Biz India',
    externalUrl:
      'https://hospitalitybizindia.com/news-track/minor-hotels-signs-anantara-luxury-hotel-at-kolkatas-world-trade-centre/',
    coverImage: CEREMONY,
    coverImageAlt: 'Signing ceremony for the Anantara hotel at World Trade Center Kolkata',
    order: 5,
    content: `
      <p>Hospitality Biz India reported the signing on 6 April 2026. Minor Hotels will operate the hotel under a management contract, without equity. The hotel is estimated at ₹200 crore inside the ₹2,400 crore World Trade Center development by Aryan Realty and Merlin Group.</p>
      <p>The report lists about 170 rooms and suites, a rooftop speciality restaurant, a ballroom, a spa, a gym and a swimming pool, with opening set for 2032. It notes the Jaipur Anantara, opened in 2025, and the group’s aim of 50 India properties within a decade.</p>
      <p><a href="https://hospitalitybizindia.com/news-track/minor-hotels-signs-anantara-luxury-hotel-at-kolkatas-world-trade-centre/">Read the Hospitality Biz India report</a></p>
    `,
    seo: {
      metaTitle: 'Hospitality Biz India: Anantara signed at Kolkata WTC',
      metaDescription:
        'Hospitality Biz India on the Anantara management contract at World Trade Center Kolkata.',
    },
  },
  {
    slug: 'rediff-anantara-hotel-kolkata-wtc',
    kind: 'media',
    title: 'Anantara hotel to open at Kolkata WTC',
    summary:
      'Rediff Money carried the PTI report: Minor Hotels will operate the Anantara at World Trade Center Kolkata from 2032, under a management contract.',
    date: '2026-04-06',
    publication: 'Rediff Money',
    externalUrl: 'https://money.rediff.com/news/market/anantara-hotel-to-open-at-kolkata-wtc/44836920260406',
    coverImage: TRAVTALK,
    coverImageAlt: 'Sushil Mohta, William Heinecke and Sanjay Saraf at the Anantara Kolkata announcement',
    order: 6,
    content: `
      <p>Rediff Money published the Press Trust of India account on 6 April 2026. A Minor Hotels spokesperson told PTI the Kolkata hotel is a management contract: the operator does not have equity, and the hotel cost estimate is ₹200 crore.</p>
      <p>The report describes about 170 guest rooms and suites, two restaurants including a rooftop speciality restaurant, a ballroom, a spa, a gym and a pool. William Heinecke called the signing the group’s first urban Anantara in India. Sanjay Saraf called World Trade Center Kolkata a landmark for the city. Sushil Mohta said the partnership would bring business and hospitality together in eastern India, and that the project cost had reached ₹2,400 crore. Opening is scheduled for 2032.</p>
      <p><a href="https://money.rediff.com/news/market/anantara-hotel-to-open-at-kolkata-wtc/44836920260406">Read the Rediff report</a></p>
    `,
    seo: {
      metaTitle: 'Rediff: Anantara hotel to open at Kolkata WTC',
      metaDescription:
        'Rediff Money’s PTI report on the Anantara hotel at World Trade Center Kolkata.',
    },
  },
  {
    slug: 'devdiscourse-anantara-kolkata-wtc',
    kind: 'media',
    title: 'Anantara Kolkata at World Trade Centre',
    summary:
      'Devdiscourse reported Minor Hotels’ Anantara management agreement at World Trade Center Salt Lake, with about 170 rooms and an opening in 2032.',
    date: '2026-04-06',
    publication: 'Devdiscourse',
    externalUrl:
      'https://www.devdiscourse.com/article/entertainment/3863971-anantara-kolkata-redefining-luxury-at-world-trade-centre',
    coverImage: '/merlin/wtc/tower-01-evening.jpg',
    coverImageAlt: 'World Trade Center Kolkata tower in the evening',
    order: 7,
    content: `
      <p>Devdiscourse reported on 6 April 2026 that Minor Hotels had signed to operate an Anantara hotel at World Trade Center, Salt Lake. The report describes a ₹2,400 crore joint venture with Aryan Realty and Merlin Group, completion by 2032, and about 170 rooms. It identifies the hotel as Minor Hotels’ first urban Anantara in India.</p>
      <p>The illustration on that page is labelled as generated and is not a photograph of the project or the signing.</p>
      <p><a href="https://www.devdiscourse.com/article/entertainment/3863971-anantara-kolkata-redefining-luxury-at-world-trade-centre">Read the Devdiscourse report</a></p>
    `,
    seo: {
      metaTitle: 'Devdiscourse: Anantara Kolkata at World Trade Centre',
      metaDescription:
        'Devdiscourse on the Anantara management agreement at World Trade Center Kolkata.',
    },
  },
  {
    slug: 'bengalinfo-minor-hotels-second-bengal-property',
    kind: 'media',
    title: 'BengalInfo: second Bengal property planned',
    summary:
      'BengalInfo carried The Times of India’s report that Minor Hotels will look for a second hotel in Bengal after the World Trade Center Anantara.',
    date: '2026-04-07',
    publication: 'BengalInfo',
    externalUrl: 'https://bengalinfo.com/newsdetail.php?newsid=473228',
    coverImage: '/merlin/wtc/towers-night.jpg',
    coverImageAlt: 'World Trade Center Kolkata towers at night',
    order: 8,
    content: `
      <p>BengalInfo republished The Times of India report of 7 April 2026. It records William Heinecke’s comment that Minor Hotels will look for a second hotel in Bengal, to be announced by the end of the year, and the 170-key Anantara at World Trade Center Sector V developed by Merlin Group and Aryan Realty.</p>
      <p><a href="https://bengalinfo.com/newsdetail.php?newsid=473228">Read the BengalInfo page</a></p>
    `,
    seo: {
      metaTitle: 'BengalInfo on Minor Hotels’ second Bengal property',
      metaDescription:
        'BengalInfo’s carry of the Times of India report on a second Minor Hotels property in Bengal.',
    },
  },
  {
    slug: 'travtalk-anantara-kolkata-announcement',
    kind: 'media',
    title: 'TravTalk on the Anantara signing',
    summary:
      'TravTalk posted the announcement photograph of Sushil Mohta, William Heinecke and Sanjay Saraf, with comments on the Anantara at World Trade Center Salt Lake.',
    date: '2026-04-06',
    publication: 'TravTalk',
    coverImage: TRAVTALK,
    coverImageAlt: 'Sushil Mohta, William Heinecke and Sanjay Saraf in the TravTalk post on Anantara Kolkata',
    order: 9,
    content: `
      <p>TravTalk posted the announcement photograph of Sushil Mohta, William Heinecke and Sanjay Saraf. The post describes the Kolkata hotel as a step in Minor Hotels’ growth in India, across both city and resort hotels, and identifies World Trade Center Salt Lake as a joint venture of Aryan Realty and Merlin Group.</p>
      <p>Sanjay Saraf is quoted calling World Trade Center Kolkata a landmark for Kolkata and West Bengal. The post says the partnership with Minor Hotels introduces Anantara to the development. No public article URL was supplied with the clipping, so this record uses the photograph that was provided.</p>
    `,
    seo: {
      metaTitle: 'TravTalk on the Anantara Kolkata announcement',
      metaDescription:
        'TravTalk’s photograph and comments from the Anantara signing at World Trade Center Kolkata.',
    },
  },
  {
    slug: 'minor-hotels-crafts-major-plans',
    kind: 'media',
    title: 'Minor Hotels crafts major plans',
    summary:
      'A supplied clipping by Sambit Saha reports Minor Hotels’ India plan, including an Anantara at the World Trade Centre in Sector V. The clipping prints an opening year of 2031 and a hotel cost of about ₹170 crore.',
    date: '2026-04-06',
    publication: 'Press clipping — Sambit Saha',
    coverImage: PLANS_CLIP,
    coverImageAlt:
      'Newspaper clipping headed Minor Hotels crafts major plans, with Sushil Mohta, William Heinecke and Sanjay Saraf',
    order: 10,
    content: `
      <p>The supplied clipping, bylined Sambit Saha with a Calcutta dateline, reports that Minor Hotels will look to build a portfolio of 50 properties in India through the decade and hopes to tie up at least eight projects in India that year, including one each in Calcutta and Coorg. It says the company operates over 600 properties in over 50 countries.</p>
      <p>On Kolkata, the clipping says a 170-key Anantara is being built by Merlin Group and Aryan Mining as part of the World Trade Centre in Sector V, at about ₹170 crore, and that it will be operated by Anantara under a management contract. The opening year printed on this clipping is 2031. The photograph is captioned Sushil Mohta, William Ellwood Heinecke and Sanjay Saraf.</p>
      <p>Reports dated 6 and 7 April 2026, including Press Trust of India, The Times of India and The Economic Times, state a 2032 opening, a hotel estimate of about ₹200 crore, and Aryan Realty as the development partner with Merlin Group. Those later figures are the ones used on the event record. This entry keeps what the clipping itself prints. The clipping does not show a publication date or a masthead.</p>
    `,
    seo: {
      metaTitle: 'Clipping: Minor Hotels crafts major plans',
      metaDescription:
        'Sambit Saha’s clipping on Minor Hotels’ India plans and the Anantara at World Trade Centre Kolkata.',
    },
  },
  {
    slug: 'indian-tourism-global-turmoil-heinecke',
    kind: 'media',
    title: 'Indian tourism may gain from global turmoil: Minor Hotels’ Heinecke',
    summary:
      'A supplied Mumbai clipping quotes William Heinecke on Indian travel demand and records about 170 rooms at the Anantara inside the World Trade Center campus.',
    date: '2026-04-06',
    publication: 'Press clipping',
    coverImage: TOURISM_CLIP,
    coverImageAlt:
      'Newspaper clipping headed Indian tourism may gain from global turmoil, with William Heinecke',
    order: 11,
    content: `
      <p>The supplied clipping, with a Mumbai dateline, quotes William E. Heinecke on travellers looking beyond the Middle East and on demand for leisure and experiential resorts in India. It identifies him as founder and chairman of Minor International, which runs the Avani and Anantara brands.</p>
      <p>The clipping says the company will have about 170 rooms and will run an Anantara at the World Trade Center campus in Kolkata. It also records a target of 50 hotels in India. The clipping does not show a publication date or a masthead, so this record is dated with the April 2026 announcement and does not add a publication name that is not on the page.</p>
    `,
    seo: {
      metaTitle: 'Clipping: Indian tourism and Minor Hotels’ Heinecke',
      metaDescription:
        'A Mumbai clipping of William Heinecke on Indian tourism and the Anantara at World Trade Center Kolkata.',
    },
  },
];

async function main() {
  if (!process.env.DB_HOST || !process.env.DB_NAME || !process.env.DB_USER || !process.env.DB_PASSWORD) {
    throw new Error('MySQL DB_* settings are incomplete. Add them to backend/.env.local.');
  }

  await mongoose.connect();
  console.log('Connected.\n');

  for (const item of items) {
    const existing = await MediaItem.findOne({ slug: item.slug });
    const doc = existing || new MediaItem({ slug: item.slug });
    doc.kind = item.kind;
    doc.title = item.title;
    doc.summary = item.summary;
    doc.content = sanitizeRichText(item.content);
    doc.date = new Date(item.date);
    doc.publication = item.publication || '';
    doc.externalUrl = item.externalUrl || '';
    doc.location = item.location || '';
    doc.category = '';
    doc.coverImage = item.coverImage || '';
    doc.coverImageAlt = item.coverImageAlt || '';
    doc.images = item.images || [];
    doc.status = 'published';
    doc.featured = Boolean(item.featured);
    doc.order = item.order;
    doc.seo = item.seo;
    doc.createdBy = doc.createdBy || 'admin';
    await doc.save();
    console.log(`${existing ? 'updated' : 'created'}  ${item.kind.padEnd(6)}  ${item.slug}`);
  }

  const covers = [
    CEREMONY,
    TRAVTALK,
    '/merlin/wtc/tower-01-evening.jpg',
    '/merlin/wtc/towers-night.jpg',
    '/merlin/wtc/courtyard-plaza.jpg',
  ];
  const rest = await MediaItem.find({});
  let index = 0;
  for (const doc of rest) {
    if (doc.coverImage) continue;
    doc.coverImage = covers[index % covers.length];
    doc.coverImageAlt = doc.coverImageAlt || doc.title;
    index += 1;
    await doc.save();
    console.log(`image     ${(doc.kind || '').padEnd(6)}  ${doc.slug}`);
  }

  await mongoose.disconnect();
  console.log('\nDone. These records are published in Media, Events & Awards.');
}

main().catch(async (error) => {
  console.error(error.message || error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
