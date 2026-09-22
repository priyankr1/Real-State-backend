/**
 * Seeds the list-shaped content: blog posts, gallery albums, corporate
 * associations, media/events/awards and the legal page shells.
 *
 *   node scripts/seedMerlinCollections.js          # skips anything already present
 *   node scripts/seedMerlinCollections.js --force  # overwrites by slug/key
 *
 * Idempotent by slug. Running it twice does nothing the second time, which
 * matters because the obvious way to use a seed script is to run it again when
 * you are not sure whether you ran it.
 *
 * What is seeded as PUBLISHED and what is seeded as DRAFT is a deliberate
 * split, not an oversight:
 *
 *  · Published — content grounded in facts from Merlin's own site: the
 *    projects, the leadership, the CREDAI Bengal membership, the resident
 *    testimonial, and journal articles written around the real headlines.
 *
 *  · Draft — the Media/Events/Awards records. Press coverage, event records
 *    and award citations are claims about third parties. Publishing an invented
 *    one is a legal problem and an SEO problem at once, so the shapes are
 *    seeded for the editor to fill and left unpublished.
 *
 *  · Draft, deliberately empty — the privacy policy and disclaimer. Legal copy
 *    is supplied and approved by Merlin's legal team; what is seeded is the
 *    section scaffold and a notice, never drafted legal text.
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';

import Blog from '../models/blogModel.js';
import MediaItem from '../models/mediaItemModel.js';
import GalleryAlbum from '../models/galleryAlbumModel.js';
import Association from '../models/associationModel.js';
import LegalPage from '../models/legalPageModel.js';
import { sanitizeRichText } from '../utils/sanitizeHtml.js';

dotenv.config({ path: './.env.local' });
dotenv.config({ path: './.env' });

const force = process.argv.slice(2).includes('--force');

const AUTHOR = {
  name: 'Merlin Editorial Desk',
  role: 'Merlin Group',
  // Photograph still to come from Merlin — an empty avatar renders the byline
  // without one rather than a broken image.
  avatar: '',
  bio:
    'The Merlin editorial desk writes on the Kolkata and Pune property markets — ' +
    'policy, locality analysis and the practicalities of buying well. Merlin Group ' +
    'has developed over 20 million sq ft and delivered more than 150 projects across ' +
    'five cities since the mid-1980s.',
};

// ── Blog posts ──────────────────────────────────────────────────────────────

const posts = [
  {
    slug: 'bengal-is-rewriting-its-real-estate-playbook',
    title: 'Bengal is finally rewriting its real estate playbook',
    excerpt:
      'Policy that was written for a smaller, slower market is being replaced. What the changes mean for buyers deciding between Rajarhat, New Town and the older city.',
    category: 'Market',
    tags: ['West Bengal', 'Policy', 'Kolkata', 'Market outlook'],
    coverImage: '/merlin/journal/bengal-real-estate-playbook.jpeg',
    coverImageAlt: 'Kolkata skyline and new development along the EM Bypass',
    publishedAt: '2026-06-24',
    content: `
      <p>For most of the last two decades, buying property in West Bengal meant working around the rules rather than with them. Land records were fragmented, approvals moved at their own pace, and the gap between what a project promised at launch and what it delivered at handover was wide enough that buyers learned to discount both.</p>
      <p>That is changing, and faster than the market's reputation suggests.</p>
      <h2>What has actually moved</h2>
      <p>Three things matter more than the headlines. Digitised land records have made title verification something a buyer can complete in days rather than months. A functioning regulator means a published possession date is now a commitment with consequences attached. And infrastructure spending along the eastern corridor has turned locations that were a compromise five years ago into locations that are a choice.</p>
      <h2>Where that leaves a buyer</h2>
      <p>The practical effect is that the old rule of thumb — pay more for the older, central address because it is the safer one — no longer holds automatically. Rajarhat and New Town now offer newer stock, better planned road networks and shorter commutes to the sectors where the jobs actually are. Konnagar and Baruipur, further out, are being priced today on the connectivity they will have in three years.</p>
      <p>None of this removes the need to check the fundamentals. A published possession date is only as good as the developer's record of meeting them, and infrastructure that is announced is not infrastructure that exists. But the questions a buyer has to ask in Bengal are now the same questions they would ask in any other Indian metro, which was not true for a long time.</p>
      <h2>What we are watching</h2>
      <p>Two things. First, whether the pace of approvals holds once volumes rise — a regulator that works at low volume and stalls at high volume helps nobody. Second, whether the rental market in New Town deepens enough to support investors as well as end users. Both will be clearer by the end of the financial year.</p>
    `,
  },
  {
    slug: 'credai-seeks-policy-reform',
    title: 'CREDAI seeks policy reform on legacy land ceiling provisions',
    excerpt:
      'The industry body has asked the state to revisit land ceiling rules written for a different era. Why the request matters to anyone buying a home in Kolkata.',
    category: 'Policy',
    tags: ['CREDAI', 'Policy', 'Land', 'West Bengal'],
    coverImage: '/merlin/journal/credai-policy-reform.jpeg',
    coverImageAlt: 'Land parcel awaiting development on the edge of Kolkata',
    publishedAt: '2026-06-24',
    content: `
      <p>CREDAI has asked the state government to revisit land ceiling provisions that date from a period when the assumptions behind them — about how cities grow, how much land a single project needs, and who holds it — were entirely different from today's.</p>
      <p>Merlin Group is a founder member of CREDAI Bengal, so the position here is not a neutral one. It is worth setting out the reasoning anyway, because the effect of these rules is felt by buyers long before it is felt by developers.</p>
      <h2>Why ceiling rules raise prices</h2>
      <p>Land ceiling provisions cap how much land a single entity may hold. The intent was to prevent concentration. The effect, in a city that has grown outward for forty years, is that assembling a parcel large enough for a planned township requires many separate transactions, each with its own title history, each adding months and cost.</p>
      <p>That cost does not disappear. It arrives in the price per square foot, and it pushes developers toward small, dense infill projects rather than the planned developments — with their own roads, open space and services — that a growing city actually needs.</p>
      <h2>What reform would and would not do</h2>
      <p>Revisiting the ceilings would not make housing cheap. Land cost is only one input, and construction cost, finance cost and approval timelines all matter. What it would do is make large planned developments viable in places where today they are not, which changes the kind of housing that gets built rather than only the price of it.</p>
      <p>The request is with the state. Whatever comes of it, the underlying point stands: rules written for the city Kolkata was in 1976 are a poor fit for the city it is becoming.</p>
    `,
  },
  {
    slug: 'f-residences-redefining-luxury-in-kolkata',
    title: 'F Residences: redefining the luxury lifestyle in Kolkata',
    excerpt:
      'Inside Merlin F Residences in Rajarhat — how the plan, the plot sizes and the amenity programme were set, and who the address is actually for.',
    category: 'Projects',
    tags: ['F Residences', 'Rajarhat', 'Luxury', 'New launch'],
    coverImage: '/merlin/projects/f-residences.jpeg',
    coverImageAlt: 'Merlin F Residences building view, Rajarhat',
    publishedAt: '2025-04-07',
    content: `
      <p>Rajarhat has more new supply than any other part of Kolkata, which makes the question for a buyer less "is this a good area" and more "what distinguishes this address from the five others within two kilometres".</p>
      <p>F Residences was planned with that question in front of us rather than behind us.</p>
      <h2>Space, before amenity</h2>
      <p>The first decision was to be generous with the apartment itself rather than with the brochure. Larger floor plates, deeper balconies and genuine cross-ventilation cost saleable area, and they are the first things cut when a project is optimised for price per square foot. They are also the things a resident notices every single day, long after the clubhouse has stopped being novel.</p>
      <h2>An amenity programme that gets used</h2>
      <p>The second decision was to build fewer amenities and build them properly. A well-run pool, a gym sized for the number of homes rather than for the render, landscaped open space that gets afternoon shade. A list of forty facilities is a maintenance bill, not a lifestyle.</p>
      <h2>Who it is for</h2>
      <p>F Residences suits a household that wants the newer infrastructure of Rajarhat without giving up the scale of home they would have had in the older city — typically a family moving from a south Kolkata apartment, or a returning buyer who wants a low-maintenance address with a real handover date.</p>
      <p>Possession is scheduled for June 2030. As with every Merlin project, that date is published because we intend to meet it.</p>
    `,
  },
  {
    slug: 'the-majesty-of-rise-returns-to-rajarhat',
    title: 'The majesty of Rise returns in Rajarhat',
    excerpt:
      'Merlin Rise brings 2 and 3 BHK apartments back to Rajarhat, with a December 2027 possession date and a plan built around how families actually use space.',
    category: 'Projects',
    tags: ['Rise', 'Rajarhat', '2 BHK', '3 BHK'],
    coverImage: '/merlin/journal/rise-rajarhat.jpeg',
    coverImageAlt: 'Merlin Rise towers in Rajarhat, Kolkata',
    publishedAt: '2022-11-29',
    content: `
      <p>Merlin Rise returns to Rajarhat with 2 and 3 BHK apartments aimed squarely at the buyer who has been priced out of the older city but is not willing to trade away daily quality of life to get there.</p>
      <h2>The plan</h2>
      <p>Rise is organised around a simple idea: the rooms a family spends time in should be the rooms that get the light. Living areas face the open side of the plot, bedrooms are placed to stay usable through a Kolkata summer, and every apartment has a service balcony that is actually deep enough to use.</p>
      <h2>Connectivity</h2>
      <p>Rajarhat's road network was planned rather than inherited, which is why a commute here behaves predictably in a way that a commute through the older city does not. The IT sectors, the airport and the New Town commercial spine are all within a comfortable drive.</p>
      <h2>Possession</h2>
      <p>December 2027. Published at launch, tracked through construction, and the number we expect to be judged on.</p>
    `,
  },
  {
    slug: 'benefits-of-living-in-an-integrated-township',
    title: 'The benefits of living in an integrated township',
    excerpt:
      'Schools, retail, healthcare and open space inside the boundary wall. What an integrated township changes about daily life — and what it does not.',
    category: 'Guides',
    tags: ['Township', 'Buying guide', 'Community living'],
    coverImage: '/merlin/journal/integrated-township.jpeg',
    coverImageAlt: 'Landscaped open space inside an integrated township',
    publishedAt: '2022-11-29',
    content: `
      <p>"Integrated township" is one of the more abused phrases in Indian real estate. Used honestly, it means something specific: a development large enough that the things a household needs weekly — a school run, a chemist, groceries, somewhere for children to play outdoors — sit inside the development rather than at the end of a drive.</p>
      <h2>What genuinely changes</h2>
      <p><strong>Time.</strong> The single biggest difference is the number of short car journeys that disappear. A school inside the boundary is twenty minutes a day returned to a family, every day, for a decade.</p>
      <p><strong>Safety at the margins.</strong> Children who can walk to a friend's block, and older residents who can walk to a shop, get a kind of independence that a standalone tower on an arterial road cannot offer.</p>
      <p><strong>Open space that survives.</strong> Green space inside a planned township is part of the approved layout. Green space next to a standalone project is somebody else's land, and usually becomes somebody else's project.</p>
      <h2>What does not change</h2>
      <p>A township does not make the commute to a city-centre office shorter. It does not guarantee the quality of the school, the clinic or the retail — those depend on the operators, not the developer. And it only works at scale: the same amenities across too few homes means either high maintenance charges or facilities that quietly stop being maintained.</p>
      <h2>The question to ask</h2>
      <p>Not "does it have a clubhouse", but "how many homes share the running cost of this, and who is contracted to run it in year seven". The answer tells you more about how the place will feel to live in than any render will.</p>
    `,
  },

  {
    slug: 'take-the-plunge-a-good-time-to-buy',
    title: 'Take the plunge — now may be a good time to buy a home',
    excerpt:
      'Waiting for the bottom of a property market is a strategy almost nobody executes. What actually decides whether this is your moment.',
    category: 'Buying Guide',
    tags: ['Buying guide', 'Home loan', 'Market timing', 'Kolkata'],
    coverImage: '/merlin/journal/take-the-plunge.jpeg',
    coverImageAlt: 'A completed Merlin residential development at dusk',
    publishedAt: '2022-01-14',
    content: `
      <p>Every prospective buyer asks the same question, and it is the wrong one: is this the bottom? Nobody rings a bell at the bottom of a property market, and the people who wait for one generally buy later and higher, having paid rent throughout.</p>
      <h2>The three things that actually decide it</h2>
      <p><strong>Whether you are buying to live in it.</strong> An end user's timing question is not "will this be 5% cheaper next year" but "how many more years am I paying someone else's mortgage". Over a seven-to-ten year hold, the entry month barely registers.</p>
      <p><strong>Your loan eligibility today.</strong> Sanction is a function of income, existing obligations and age. Waiting three years for a better price while your eligibility window narrows is a poor trade.</p>
      <p><strong>What is actually available.</strong> In a slow market you have choice: the better-facing units, the lower floors with a garden view, the corner plans. In a fast one, you get what is left. That difference is permanent and it is not reflected in the price per square foot.</p>
      <h2>When to wait</h2>
      <p>If the down payment would empty your emergency fund, wait. If your job is under review, wait. If you have not seen the title documents, wait until you have. Those are real reasons. "The market might dip" is not one you can act on.</p>
      <h2>The practical test</h2>
      <p>Take the EMI you would pay and set it aside for three months without touching it. If that works comfortably, the timing question has answered itself.</p>
    `,
  },
  {
    slug: 'rajarhat-or-new-town-which-suits-you',
    title: 'Rajarhat or New Town: which one is actually right for you',
    excerpt:
      'Two names used interchangeably, two quite different places to live. A straight comparison on commute, supply, price and what daily life is like.',
    category: 'Guides',
    tags: ['Rajarhat', 'New Town', 'Kolkata', 'Locality guide'],
    coverImage: '/merlin/projects/lakescape.jpeg',
    coverImageAlt: 'Merlin Lakescape at night, New Town, Kolkata',
    publishedAt: '2026-02-11',
    content: `
      <p>Buyers use "Rajarhat" and "New Town" as if they were one address. Brokers do not correct them, because the confusion usually works in the seller's favour. They are adjacent, they share a road network, and they are not the same decision.</p>
      <h2>New Town</h2>
      <p>Planned from nothing, on a grid, with the widest roads in the metropolitan area and services laid before the buildings went up. That shows in daily life: the commute behaves predictably, there is genuine open space, and the retail and healthcare have arrived rather than been promised.</p>
      <p>The trade is price and character. You pay for the planning, and the place still feels new in a way that some buyers like and others do not.</p>
      <h2>Rajarhat</h2>
      <p>Denser, older, more mixed, and closer to the established city. More supply, which means more negotiating room and a wider spread of quality. The best Rajarhat addresses are as good as anything in New Town for less; the worst are on service roads that were never designed for the volume now using them.</p>
      <h2>How to choose</h2>
      <p>Drive the actual commute at the actual hour. Not the distance, the journey — twice, on different days. Then walk the immediate block on a weekday evening. Nearly every regret we hear about either location traces back to somebody who skipped one of those two steps.</p>
      <p>Merlin builds in both: <strong>Rise</strong> and <strong>F Residences</strong> in Rajarhat, <strong>Lakescape</strong> in New Town.</p>
    `,
  },
  {
    slug: 'what-a-possession-date-is-worth',
    title: 'What a possession date is worth, and how to check one',
    excerpt:
      'Every brochure prints a possession date. Very few buyers know how to tell a commitment from a hope. Four checks that take an afternoon.',
    category: 'Buying Guide',
    tags: ['Possession', 'RERA', 'Due diligence', 'Buying guide'],
    coverImage: '/merlin/brand/inner-banner.jpeg',
    coverImageAlt: 'A Merlin development under construction',
    publishedAt: '2026-04-03',
    content: `
      <p>A possession date is the single most consequential number in a brochure, and the one buyers scrutinise least. It determines how long you pay rent and EMI at the same time — which, on a two-year slip, is often more money than you negotiated off the price.</p>
      <h2>Check the RERA date, not the brochure date</h2>
      <p>The date filed with the regulator is the one with consequences attached. It is public. If it differs from the brochure, the filed date is the real one and the difference tells you something about the seller.</p>
      <h2>Check the developer's last three deliveries</h2>
      <p>Not their best delivery — their last three. Registration dates are public record. A developer who has handed over on schedule repeatedly is making a different kind of promise from one who has not.</p>
      <h2>Check what stage the site is actually at</h2>
      <p>Visit. Count the floors cast against the months remaining. Structure is the slow part; if the frame is not up with two years to go on a high-rise, the date is arithmetic that does not work.</p>
      <h2>Check what happens if they miss</h2>
      <p>Read the delay clause in the agreement, not the brochure. What is the compensation, from when, and is it capped? A developer confident of the date will have no difficulty discussing it.</p>
      <p>Every Merlin project on this site publishes its possession date, because it is the number we expect to be judged on.</p>
    `,
  },
  {
    slug: 'kolkata-northern-corridor-bt-road-sodepur',
    title: "Kolkata's northern corridor: BT Road, Sodepur and a changing commute",
    excerpt:
      'The north has been the city’s quiet value belt for a decade. Metro extensions and road widening are closing the gap with the south.',
    category: 'Market',
    tags: ['BT Road', 'Sodepur', 'North Kolkata', 'Market outlook'],
    coverImage: '/merlin/projects/serenia.jpeg',
    coverImageAlt: 'Merlin Serenia on BT Road, Kolkata',
    publishedAt: '2026-05-19',
    content: `
      <p>South Kolkata has set the city's price expectations for thirty years. The north has been where people went when the south became unaffordable — a compromise rather than a choice. That framing is now several years out of date.</p>
      <h2>What changed</h2>
      <p>Metro extension along the northern spine, sustained widening on BT Road, and a generation of planned developments replacing the older low-rise stock. The practical result is that a Sodepur address now has a commute that behaves, which was the north's real weakness rather than its housing.</p>
      <h2>What it means for value</h2>
      <p>The gap in price per square foot between a comparable north and south address has narrowed and will narrow further, because the underlying reason for the gap — connectivity — is being removed. Buyers who moved north for affordability are finding they also bought the improvement.</p>
      <h2>What has not changed</h2>
      <p>The north is not homogeneous. A hundred metres off the main road the infrastructure can be twenty years older. As everywhere in this city, the arterial road is doing the work; verify what the approach to your specific building is actually like.</p>
      <p>Merlin has built along this corridor for two decades — <strong>Serenia</strong> on BT Road and <strong>Maximus</strong> at Sodepur among them.</p>
    `,
  },
  {
    slug: 'buying-in-kolkata-the-paperwork-in-order',
    title: 'Buying in Kolkata: the paperwork, in the order you will need it',
    excerpt:
      'From title search to registration, the documents a Kolkata purchase actually turns on — sequenced, with what each one proves.',
    category: 'Guides',
    tags: ['Documents', 'Registration', 'Due diligence', 'West Bengal'],
    coverImage: '/merlin/projects/niyasa.jpeg',
    coverImageAlt: 'Merlin Niyasa near Ruby, EM Bypass, Kolkata',
    publishedAt: '2026-07-22',
    content: `
      <p>Most of the difficulty in an Indian property purchase is sequencing. Buyers collect documents in the order they are offered rather than the order that protects them, and discover the problem after the booking amount has moved.</p>
      <h2>Before you pay anything</h2>
      <p><strong>Title deed and the chain behind it.</strong> Thirty years is the convention. What you are looking for is an unbroken chain of ownership with no gap somebody will have to explain later.</p>
      <p><strong>Encumbrance certificate.</strong> Proves the property is not already mortgaged or subject to a charge. Digitised land records have made this a days-long exercise rather than a months-long one.</p>
      <p><strong>RERA registration.</strong> Verify it on the regulator's own site, not from a screenshot. Confirm the registration covers the specific tower and phase you are buying into.</p>
      <h2>Before you sign the agreement</h2>
      <p><strong>Sanctioned plan and completion certificate</strong> — that the building approved is the building being built. <strong>Mutation records</strong>, so the land is recorded in the seller's name. <strong>Tax receipts</strong>, showing nothing outstanding.</p>
      <h2>At registration</h2>
      <p>Stamp duty and registration fee are payable in West Bengal on the higher of consideration or circle rate. Budget for them from the start — they are a real part of the cost, not a formality at the end.</p>
      <h2>The one rule</h2>
      <p>Have your own lawyer read the agreement. Not the developer's, not the broker's recommendation. It is the cheapest line item in the entire transaction and the only one that is purely on your side.</p>
    `,
  },
];

// ── Corporate associations ──────────────────────────────────────────────────

const associations = [
  {
    slug: 'credai-bengal',
    name: 'CREDAI Bengal',
    category: 'institution',
    categoryLabel: 'Industry bodies',
    logo: '/merlin/identity/credai-bengal.jpeg',
    logoAlt: 'CREDAI Bengal',
    description:
      'Merlin Group is a Founder Member of CREDAI Bengal, the state chapter of the Confederation of Real Estate Developers Associations of India. The association represents the organised development sector in West Bengal on policy, regulation and industry standards.',
    website: 'https://www.credaibengal.in',
    status: 'published',
    featured: true,
    order: 1,
  },
];

// ── Gallery albums ──────────────────────────────────────────────────────────

const albums = [
  {
    slug: 'world-trade-center-salt-lake',
    title: 'World Trade Center Salt Lake',
    description:
      "Architectural renders of Eastern India's first integrated World Trade Center campus — a 5 million sq ft venture by Merlin and Aryan Realty at Block-BP, Sector-V, Salt Lake.",
    category: 'Projects',
    location: 'Salt Lake Sector V, Kolkata',
    coverImage: '/merlin/wtc/tower-02-evening.jpg',
    coverImageAlt: 'World Trade Center Salt Lake, evening elevation from the road',
    status: 'published',
    featured: true,
    order: 0,
    images: [
      { url: '/merlin/wtc/tower-02-evening.jpg', alt: 'World Trade Center Salt Lake tower elevation at evening, road side', caption: 'Tower elevation · evening', width: 2400, height: 1440 },
      { url: '/merlin/wtc/aerial-day.jpg', alt: 'Aerial view of the World Trade Center Salt Lake campus by day', caption: 'The campus from above', width: 2400, height: 1350 },
      { url: '/merlin/wtc/tower-01-evening.jpg', alt: 'World Trade Center Salt Lake, road-side elevation at evening', caption: 'Road-side elevation · evening', width: 2400, height: 1440 },
      { url: '/merlin/wtc/courtyard.jpg', alt: 'Landscaped courtyard at World Trade Center Salt Lake', caption: 'The courtyard · 2+ acres of green space', width: 2400, height: 1800 },
      { url: '/merlin/wtc/elevation-concept.jpg', alt: 'World Trade Center Salt Lake tower elevation lighting concept', caption: 'Elevation lighting concept', width: 2400, height: 1440 },
    ],
  },
  {
    slug: 'featured-projects',
    title: 'Featured projects',
    description:
      'Current Merlin developments across Kolkata and its growth corridors, from Chowringhee to Baruipur.',
    category: 'Projects',
    location: 'Kolkata, West Bengal',
    coverImage: '/merlin/projects/lakescape.jpeg',
    coverImageAlt: 'Merlin Lakescape at night, New Town',
    status: 'published',
    featured: true,
    order: 1,
    images: [
      { url: '/merlin/projects/imperia.jpeg', alt: 'Merlin Imperia, Konnagar, GT Road', caption: 'Imperia · Konnagar, GT Road' },
      { url: '/merlin/projects/ivy.jpeg', alt: 'Merlin IVY, Beliaghata', caption: 'Merlin IVY · Beliaghata' },
      { url: '/merlin/projects/niyasa.jpeg', alt: 'Merlin Niyasa, near Ruby, EM Bypass', caption: 'Niyasa · Near Ruby, EM Bypass' },
      { url: '/merlin/projects/f-residences.jpeg', alt: 'Merlin F Residences, Rajarhat', caption: 'F Residences · Rajarhat' },
      { url: '/merlin/projects/rise.jpeg', alt: 'Merlin Rise, Rajarhat', caption: 'Rise · Rajarhat' },
      { url: '/merlin/projects/avana.jpeg', alt: 'Merlin Avana, Tollygunge', caption: 'Avana · Tollygunge' },
      { url: '/merlin/projects/serenia.jpeg', alt: 'Merlin Serenia, BT Road', caption: 'Serenia · BT Road' },
      { url: '/merlin/projects/azure.jpeg', alt: 'Merlin Azure, Chowringhee', caption: 'Azure · Chowringhee' },
      { url: '/merlin/projects/skygaze.jpeg', alt: 'Merlin Skygaze, Chowhati, Sonarpur', caption: 'Skygaze · Chowhati, Sonarpur' },
      { url: '/merlin/projects/lakescape.jpeg', alt: 'Merlin Lakescape, New Town', caption: 'Lakescape · New Town' },
      { url: '/merlin/projects/merlin-x.jpeg', alt: 'Merlin X, Topsia', caption: 'X · Topsia' },
      { url: '/merlin/projects/oikyo.jpeg', alt: 'Merlin Oikyo, Baruipur', caption: 'Oikyo · Baruipur' },
    ],
  },
  {
    slug: 'adding-to-skylines',
    title: 'Adding to skylines',
    description:
      'Delivered Merlin addresses that changed the map — Acropolis, Ventana, The Summit, Ibiza, Altair and 5th Avenue.',
    category: 'Delivered',
    location: 'Kolkata and Chennai',
    coverImage: '/merlin/projects/story-5th-avenue.jpeg',
    coverImageAlt: 'Merlin 5th Avenue',
    status: 'published',
    order: 2,
    images: [
      { url: '/merlin/projects/story-acropolis.jpeg', alt: 'Merlin Acropolis', caption: 'Acropolis' },
      { url: '/merlin/projects/story-ventana.jpeg', alt: 'Merlin Ventana', caption: 'Ventana' },
      { url: '/merlin/projects/story-summit.jpeg', alt: 'Merlin The Summit', caption: 'The Summit' },
      { url: '/merlin/projects/story-chennai.jpeg', alt: 'Merlin project in Chennai', caption: 'Chennai' },
      { url: '/merlin/projects/story-ibiza.jpeg', alt: 'Merlin Ibiza', caption: 'Ibiza' },
      { url: '/merlin/projects/story-altair.jpeg', alt: 'Merlin Altair', caption: 'Altair' },
      { url: '/merlin/projects/story-5th-avenue.jpeg', alt: 'Merlin 5th Avenue', caption: '5th Avenue' },
    ],
  },
  {
    slug: 'merlin-residents',
    title: 'Merlin residents',
    description: 'The families who live in Merlin homes.',
    category: 'People',
    coverImage: '/merlin/testimonials/debdas-nirmal-dutta.jpeg',
    coverImageAlt: 'Mr. Debdas Dutta and Nirmal Dutta at their Merlin home',
    status: 'published',
    order: 3,
    images: [
      { url: '/merlin/testimonials/pijus-sarkar.png', alt: 'Mr. Pijus Sarkar, resident of Merlin Maximus', caption: 'Mr. Pijus Sarkar · Merlin Maximus, Sodepur' },
      { url: '/merlin/testimonials/debdas-nirmal-dutta.jpeg', alt: 'Mr. Debdas Dutta and Nirmal Dutta', caption: 'Mr. Debdas Dutta and Nirmal Dutta' },
      { url: '/merlin/testimonials/angshuman-suparna-mitra.jpeg', alt: 'Mr. Angshuman Mitra and Suparna Mitra', caption: 'Mr. Angshuman Mitra and Suparna Mitra' },
    ],
  },
];

// ── Media, events and awards ────────────────────────────────────────────────

/**
 * Seeded as drafts, with the summary saying so.
 *
 * These records make claims about third parties — that a publication ran a
 * piece, that a body gave an award, that an event took place on a date. An
 * invented one is a legal exposure and, once indexed, an SEO liability that
 * outlives the correction. The shape is here so the editor has a working
 * example; the facts come from Merlin.
 */
const mediaItems = [
  {
    slug: 'sample-press-coverage',
    kind: 'media',
    title: 'Sample — press coverage record',
    summary:
      'TEMPLATE, NOT REAL COVERAGE. Replace the title, publication, date and link with a supplied press clipping, then publish.',
    publication: 'Publication name',
    date: '2026-01-01',
    externalUrl: '',
    coverImage: '/merlin/brand/inner-banner.jpeg',
    coverImageAlt: 'Placeholder image — replace with the scanned clipping',
    status: 'draft',
    order: 1,
  },
  {
    slug: 'sample-event',
    kind: 'event',
    title: 'Sample — event record',
    summary:
      'TEMPLATE, NOT A REAL EVENT. Replace the name, date, venue, description and photographs with a supplied event, then publish.',
    location: 'Venue, Kolkata',
    date: '2026-01-01',
    coverImage: '/merlin/brand/hero-skygaze.jpeg',
    coverImageAlt: 'Placeholder image — replace with event photography',
    status: 'draft',
    order: 2,
  },
  {
    slug: 'sample-award',
    kind: 'award',
    title: 'Sample — award record',
    summary:
      'TEMPLATE, NOT A REAL AWARD. Replace the award name, awarding body, year and certificate image with a supplied award, then publish.',
    publication: 'Awarding body',
    category: 'Award category',
    date: '2026-01-01',
    coverImage: '/merlin/brand/transformation.jpeg',
    coverImageAlt: 'Placeholder image — replace with the certificate',
    status: 'draft',
    order: 3,
  },
];

// ── Legal pages ─────────────────────────────────────────────────────────────

/**
 * Scaffolds only.
 *
 * Merlin's legal team supplies and approves this copy; we do not draft it. What
 * is seeded is the set of headings a policy of this type is expected to cover,
 * so the gap is visible rather than implied, plus a notice at the top. Both
 * stay unpublished: an unpublished legal page renders a noindex holding notice
 * and stays out of the sitemap, which is the correct state until real text
 * arrives.
 */
const legalPages = [
  {
    key: 'privacy-policy',
    title: 'Privacy Policy',
    content: `
      <p><strong>This page is awaiting copy from Merlin's legal team. Nothing below is legal advice or approved text — the headings are a checklist of what a policy of this kind is normally expected to cover.</strong></p>
      <h2>Who we are</h2>
      <p>Identity and contact details of the data controller.</p>
      <h2>What we collect</h2>
      <p>Enquiry form fields, call records, site analytics, cookies.</p>
      <h2>Why we collect it and on what basis</h2>
      <h2>Who we share it with</h2>
      <p>CRM, marketing platforms, channel partners, service providers.</p>
      <h2>How long we keep it</h2>
      <h2>Your rights, and how to exercise them</h2>
      <h2>Cookies and tracking</h2>
      <h2>Grievance officer</h2>
      <p>Name, designation, address, email and response timeline, as applicable.</p>
      <h2>Changes to this policy</h2>
    `,
  },
  {
    key: 'disclaimer',
    title: 'Disclaimer',
    content: `
      <p><strong>This page is awaiting copy from Merlin's legal team. Nothing below is legal advice or approved text — the headings are a checklist of what a disclaimer of this kind is normally expected to cover.</strong></p>
      <h2>Nature of the information on this site</h2>
      <p>Renders, plans, dimensions and specifications, and the extent to which they are indicative.</p>
      <h2>No offer or contract</h2>
      <h2>RERA registration and project approvals</h2>
      <h2>Prices, availability and possession dates</h2>
      <h2>Third-party links and content</h2>
      <h2>Intellectual property</h2>
      <h2>Governing law and jurisdiction</h2>
    `,
  },
];

// ── Runner ──────────────────────────────────────────────────────────────────

/** Upserts one document by a unique field, reporting what it did. */
async function upsert(Model, uniqueField, value, build, label) {
  const query = { [uniqueField]: value };
  const existing = await Model.findOne(query);

  if (existing && !force) {
    console.log(`  · ${String(value).padEnd(44)} exists — left alone`);
    return 'skipped';
  }

  const doc = existing || new Model(query);
  build(doc);
  doc.createdBy = doc.createdBy || 'seed';
  await doc.save();

  console.log(`  ✓ ${String(value).padEnd(44)} ${existing ? 'updated' : 'created'} (${doc.status || label})`);
  return existing ? 'updated' : 'created';
}

async function main() {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is not set. Add it to backend/.env.local.');
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB\n');

  console.log('Blog posts');
  for (const post of posts) {
    await upsert(Blog, 'slug', post.slug, (doc) => {
      doc.title = post.title;
      doc.excerpt = post.excerpt;
      // Sanitized on the way in, exactly as the admin API does it, so what is
      // stored is already safe for every consumer to render.
      doc.content = sanitizeRichText(post.content);
      doc.coverImage = post.coverImage;
      doc.coverImageAlt = post.coverImageAlt;
      doc.category = post.category;
      doc.tags = post.tags;
      doc.author = AUTHOR;
      doc.status = 'published';
      doc.publishedAt = new Date(post.publishedAt);
      doc.seo = {
        metaTitle: post.title.slice(0, 70),
        metaDescription: post.excerpt.slice(0, 180),
        keywords: post.tags,
      };
    });
  }

  console.log('\nCorporate associations');
  for (const association of associations) {
    await upsert(Association, 'slug', association.slug, (doc) => {
      Object.assign(doc, association);
    });
  }

  console.log('\nGallery albums');
  for (const album of albums) {
    await upsert(GalleryAlbum, 'slug', album.slug, (doc) => {
      Object.assign(doc, album);
    });
  }

  console.log('\nMedia, events and awards (seeded as drafts — see the note in this file)');
  for (const item of mediaItems) {
    await upsert(MediaItem, 'slug', item.slug, (doc) => {
      Object.assign(doc, item, { date: new Date(item.date) });
    });
  }

  console.log('\nLegal pages (scaffolds, unpublished — copy comes from Merlin legal)');
  for (const page of legalPages) {
    await upsert(LegalPage, 'key', page.key, (doc) => {
      doc.title = page.title;
      doc.content = sanitizeRichText(page.content);
      doc.status = 'draft';
      doc.version = doc.version || '0.1';
      doc.effectiveDate = doc.effectiveDate || new Date();
      doc.updatedBy = 'seed';
    });
  }

  console.log('\nDone.');
  console.log('Next: fill Media/Events/Awards with supplied records, and replace the');
  console.log('legal scaffolds with approved copy, before publishing either.');
}

main()
  .catch((error) => {
    console.error('\nSeed failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close().catch(() => {});
  });
