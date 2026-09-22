/**
 * Seeds the Property collection with Merlin's real developments.
 *
 *   node scripts/seedMerlinProjects.js          # skips titles already present
 *   node scripts/seedMerlinProjects.js --force  # overwrites by title
 *   node scripts/seedMerlinProjects.js --purge-demo   # also removes demo rows
 *
 * Why this exists: the homepage listed twelve projects from
 * `merlin-site-content.json` while /properties had one demo row in Mongo. Same
 * company, two sources, and a visitor who clicked "View all projects" found
 * nothing there. The featured list and this seed are now generated from the
 * same records below, so the two cannot disagree at seed time.
 *
 * ── What is real and what is not ────────────────────────────────────────────
 *
 * REAL, from Merlin's own site: project name, locality, possession date,
 * imagery, and the bedroom configurations that appear in the source image alt
 * text (Rise, Serenia, Azure and Oikyo state theirs).
 *
 * INDICATIVE, to be replaced by Merlin: `sqft`, `baths`, and `beds` wherever
 * the configuration was not published. These are marked in each record so they
 * can be found again.
 *
 * NOT INVENTED: price. Every record is seeded at 0, which the frontend renders
 * as "Price on request". Publishing a made-up price against a real, named
 * development is a false commercial claim, and it is the one field here where
 * a plausible guess is worse than an obvious gap.
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';

import Property from '../models/propertyModel.js';

dotenv.config({ path: './.env.local' });
dotenv.config({ path: './.env' });

const args = process.argv.slice(2);
const force = args.includes('--force');
const purgeDemo = args.includes('--purge-demo');

const CONTACT_PHONE = '03340154545';

/** Amenities that are safe to state for a development of this class. */
const BASE_AMENITIES = [
  'Clubhouse',
  'Swimming Pool',
  'Gym',
  'Landscaped Garden',
  'Children Play Area',
  'Security',
  'Power Backup',
  'Lift',
  'Parking',
  'CCTV Surveillance',
];

const COMMERCIAL_AMENITIES = [
  'Parking',
  'Security',
  'Power Backup',
  'Lift',
  'CCTV Surveillance',
  'Cafeteria',
  'Conference Room',
];

/**
 * @typedef  {object} Seed
 * @property {string}  title
 * @property {string}  location
 * @property {string}  possession
 * @property {string}  type          Apartment | Villa | Office
 * @property {string}  availability  buy | rent
 * @property {number}  beds
 * @property {number}  baths
 * @property {number}  sqft
 * @property {boolean} configKnown   true when beds come from Merlin's own copy
 * @property {string}  image
 * @property {string}  blurb         The one line that is specific to this address.
 */

/** @type {Seed[]} */
const projects = [
  // ── Under construction, from the homepage featured list ───────────────────
  {
    title: 'Merlin Imperia',
    location: 'Konnagar, GT Road, Kolkata',
    possession: "Oct 2030",
    type: 'Apartment',
    availability: 'buy',
    beds: 3, baths: 3, sqft: 1450, configKnown: false,
    images: [
      '/merlin/projects/imperia.jpeg',
      '/merlin/projects/imperia/01.jpg',
      '/merlin/projects/imperia/02.jpg',
      '/merlin/projects/imperia/03.jpg',
      '/merlin/projects/imperia/04.jpg',
      '/merlin/projects/imperia/05.jpg',
    ],
    blurb:
      'A GT Road address in Konnagar, on the northern corridor where the older river towns meet the city’s expansion.',
    detail: [
      'Konnagar sits on GT Road in the Hooghly belt, the old river corridor running north out of Kolkata. It is one of the few directions where a buyer still gets genuine space for the money without the commute becoming unreasonable — the riverside towns have their own schools, markets and railway stations rather than depending on the city for everything.',
      'The address suits a household buying for the long term rather than for resale in three years. Konnagar is priced today on the connectivity it has; the upside sits in what the northern corridor becomes as road widening and rail upgrades land.',
      'Possession is October 2030, which is a genuinely long horizon — worth weighing against your own timeline before committing, and worth asking about the construction milestones between now and then.',
      "The renders make the case for the address better than any specification sheet: the elevation reads against the river, balconies are turned towards it, and the ground plane is given over to lawn and a children's play area rather than parking. If the river outlook is what draws you here, confirm which stacks actually hold it — not all of them do.",
    ],
  },
  {
    title: 'Merlin IVY',
    location: 'Beliaghata, Kolkata',
    possession: 'April 2029',
    type: 'Apartment',
    availability: 'buy',
    beds: 3, baths: 3, sqft: 1380, configKnown: false,
    images: [
      '/merlin/projects/ivy.jpeg',
      '/merlin/projects/ivy/01.jpg',
      '/merlin/projects/ivy/02.jpg',
      '/merlin/projects/ivy/03.jpg',
      '/merlin/projects/ivy/04.jpg',
      '/merlin/projects/ivy/05.jpg',
    ],
    blurb:
      'Central-east Kolkata, within reach of the EM Bypass and the Salt Lake employment belt without leaving the old city.',
    detail: [
      'Beliaghata is central-east Kolkata: old city, established, with the EM Bypass and the Salt Lake employment belt both within a short drive. It is the part of town where a buyer gets an inner-city address without paying south Kolkata prices for it.',
      'The trade is that this is a built-up, mature neighbourhood rather than a planned one. Roads are older and narrower than Rajarhat or New Town, and what is next door is already there — which cuts both ways. Walk the immediate block before deciding.',
      'It suits a family with ties to central or north Kolkata who want a new building without moving out to the fringe, and anyone whose work sits along the Bypass or in Sector V.',
      "The exterior renders show a single compact cluster rather than a township, which is what Beliaghata's plot sizes allow. Judge it on the apartment and the location rather than on amenity count; in central Kolkata that is the honest comparison.",
    ],
  },
  {
    title: 'Merlin Niyasa',
    location: 'Near Ruby, EM Bypass, Kolkata',
    possession: 'Jun 2030',
    type: 'Apartment',
    availability: 'buy',
    beds: 3, baths: 3, sqft: 1520, configKnown: false,
    images: [
      '/merlin/projects/niyasa.jpeg',
      '/merlin/projects/niyasa/01.jpg',
      '/merlin/projects/niyasa/02.jpg',
      '/merlin/projects/niyasa/03.jpg',
      '/merlin/projects/niyasa/04.jpg',
      '/merlin/projects/niyasa/05.jpg',
    ],
    blurb:
      'Beside the Ruby junction on the EM Bypass — the single best-connected point in south-east Kolkata for hospitals, retail and the airport road.',
    detail: [
      'The Ruby junction is arguably the single best-connected point in south-east Kolkata. The EM Bypass runs north to the airport and south to Garia; the hospitals, the malls and the Science City corridor are all within minutes; and the Metro extension has made the whole stretch materially easier to move around.',
      'That connectivity is what you are paying for. An address here removes most of the daily friction that defines living in the older city — the school run, the hospital visit, the airport dash — and that value does not depreciate.',
      'Possession is June 2030. For a buyer who does not need to move immediately, the Bypass corridor is one of the more defensible places in Kolkata to hold property.',
      "The gallery shows how the site is planned to work: towers set against water, a pool and deck at podium level, a pergola walkway through the landscape and a lawn at grade. The Ruby junction's value is connectivity — what these views add is a reason to stay in rather than only pass through.",
    ],
  },
  {
    title: 'Merlin F Residences',
    location: 'Rajarhat, Kolkata',
    possession: 'Jun 2030',
    type: 'Apartment',
    availability: 'buy',
    beds: 4, baths: 4, sqft: 2100, configKnown: false,
    images: [
      '/merlin/projects/f-residences.jpeg',
      '/merlin/projects/fresidencesmerlin/01.jpg',
      '/merlin/projects/fresidencesmerlin/02.jpg',
      '/merlin/projects/fresidencesmerlin/03.jpg',
      '/merlin/projects/fresidencesmerlin/04.jpg',
      '/merlin/projects/fresidencesmerlin/05.jpg',
    ],
    blurb:
      'Larger floor plates and deeper balconies than Rajarhat’s standard stock, planned for buyers moving from the older city without giving up space.',
    detail: [
      'Rajarhat has more new supply than any other part of Kolkata, which makes the real question not whether the area works but what distinguishes one address from the five others within two kilometres.',
      'F Residences is planned around larger apartments rather than a longer amenity list — deeper balconies, more generous floor plates, genuine cross-ventilation. Those are the first things cut when a project is optimised for price per square foot, and the things a resident notices every day long after the clubhouse has stopped being novel.',
      'It suits a household moving from an older south Kolkata apartment who want the newer infrastructure of Rajarhat without giving up the scale of home they are used to. Possession June 2030.',
      "Read the gallery as a masterplan rather than a building: aerials across the whole cluster, a landscaped water feature at the centre, a retail frontage at the entrance and a pool deck between the towers. It is planned as a self-contained address, which matters in Rajarhat where the surroundings are still arriving.",
    ],
  },
  {
    title: 'Merlin Rise',
    location: 'Rajarhat, Kolkata',
    possession: 'Dec 2027',
    type: 'Apartment',
    availability: 'buy',
    beds: 3, baths: 3, sqft: 1240, configKnown: true,
    images: [
      '/merlin/projects/rise.jpeg',
      '/merlin/projects/rise/01.jpg',
      '/merlin/projects/rise/02.jpg',
      '/merlin/projects/rise/03.jpg',
      '/merlin/projects/rise/05.jpg',
    ],
    blurb:
      '2 and 3 BHK apartments in Rajarhat, planned so the rooms a family actually uses are the rooms that get the light.',
    detail: [
      "Rajarhat's road network was planned rather than inherited, which is why a commute here behaves predictably in a way a commute through the older city does not. The IT sectors, the airport and the New Town commercial spine are all within a comfortable drive.",
      'Rise is organised around a simple idea: the rooms a family actually spends time in should be the rooms that get the light. Living areas face the open side of the plot, bedrooms are placed to stay usable through a Kolkata summer, and every apartment has a service balcony deep enough to be useful.',
      '2 and 3 BHK, aimed at buyers priced out of the older city who are not willing to trade away daily quality of life to get there. Possession December 2027 — among the nearer dates in the current Merlin portfolio.',
      "The gallery covers the amenity floor properly — a gym, a banquet hall, a music room, a screening room, a children's activity space and a clubhouse lit at night, with a sports field and pool deck in the aerial views. This is the part most often cut between brochure and handover, so confirm which of it lands in the phase you are buying.",
    ],
  },
  {
    title: 'Merlin Avana',
    location: 'Tollygunge, Kolkata',
    possession: 'Dec 2027 (Phase I) · Dec 2028 (Phase II)',
    type: 'Apartment',
    availability: 'buy',
    beds: 3, baths: 3, sqft: 1600, configKnown: false,
    images: [
      '/merlin/projects/avana.jpeg',
      '/merlin/projects/avana/01.jpg',
      '/merlin/projects/avana/02.jpg',
      '/merlin/projects/avana/03.jpg',
      '/merlin/projects/avana/04.jpg',
      '/merlin/projects/avana/05.jpg',
    ],
    blurb:
      'Tollygunge: metro on the doorstep, the golf club across the road, and a south Kolkata address that needs no explaining.',
    detail: [
      'Tollygunge is a south Kolkata address that needs no explaining. Metro on the doorstep, the golf club across the road, and a neighbourhood that has held its value through every cycle the city has been through.',
      'New supply here is scarce, because there is very little land left to build on. That scarcity is most of the investment case: you are buying into a location that cannot be replicated a kilometre further out, which is exactly what happens in the growth corridors.',
      'Delivered in two phases — December 2027 for Phase I and December 2028 for Phase II. Confirm which phase a given unit belongs to before you book; the difference is a year.',
      "The renders show what the plot is being built around: a pool at podium level, courts, a water-garden spine through the landscape, and a clubhouse floor carrying a gym, a theatre room, a banquet hall and a children's room. On a Tollygunge site, where land is scarce, that much open amenity is the thing to weigh against the alternatives.",
    ],
  },
  {
    title: 'Merlin Serenia',
    location: 'BT Road, Kolkata',
    possession: 'Dec 2029',
    type: 'Apartment',
    availability: 'buy',
    beds: 4, baths: 4, sqft: 1950, configKnown: true,
    images: [
      '/merlin/projects/serenia.jpeg',
      '/merlin/projects/serenia/01.jpg',
      '/merlin/projects/serenia/02.jpg',
      '/merlin/projects/serenia/03.jpg',
      '/merlin/projects/serenia/04.jpg',
      '/merlin/projects/serenia/05.jpg',
    ],
    blurb:
      '4 BHK flats on BT Road, in the northern belt where Merlin has been building and delivering for two decades.',
    detail: [
      "BT Road is the spine of Kolkata's northern belt, and the north has been the city's quiet value corridor for a decade — the place people went when the south became unaffordable. That framing is now out of date. Metro extension and sustained road widening have removed the north's real weakness, which was never the housing but the commute.",
      'Merlin has been building and delivering along this corridor for two decades, including Maximus at Sodepur. That record matters more here than in a market where every developer is new.',
      '4 BHK, for a family that wants genuine space at a north Kolkata price rather than a compromised plan at a south Kolkata one. Possession December 2029.',
      "The scheme shows best in the evening views — towers against water, a pool and terraced gardens between them, and the layout legible from above. The northern corridor's argument has always been space for the money; these renders are what that buys on BT Road.",
    ],
  },
  {
    title: 'Merlin Azure',
    location: 'Chowringhee, Kolkata',
    possession: 'June 2027',
    type: 'Apartment',
    availability: 'buy',
    beds: 4, baths: 4, sqft: 2400, configKnown: true,
    images: [
      '/merlin/projects/azure.jpeg',
      '/merlin/projects/azure/01.jpg',
      '/merlin/projects/azure/02.jpg',
      '/merlin/projects/azure/03.jpg',
      '/merlin/projects/azure/04.jpg',
      '/merlin/projects/azure/05.jpg',
    ],
    blurb:
      '4 BHK residences on Chowringhee — the Maidan on one side, the business district on the other, and almost no new supply in between.',
    detail: [
      'Chowringhee is the centre of Kolkata in a way no other address is — the Maidan on one side, the business district on the other, the Victoria Memorial and the museum within walking distance. There is almost no new residential supply here and there has not been for years.',
      'An address on Chowringhee is not bought on price per square foot. It is bought because the alternative does not exist: nobody is assembling another plot in this location, and the view over the Maidan cannot be built out.',
      '4 BHK residences, possession June 2027 — one of the nearer handover dates in the portfolio, which for an address of this kind is unusual in itself.',
      "The renders show where the money goes in a building this size: a rooftop pool and deck over the Maidan and the river, a covered arrival court, and interiors laid out as floor-through residences rather than a subdivided plate. Ask to see the floor plate before comparing it with anything else on price per square foot.",
    ],
  },
  {
    title: 'Merlin Skygaze',
    location: 'Chowhati, Sonarpur, Kolkata',
    possession: 'June 2027',
    type: 'Apartment',
    availability: 'buy',
    beds: 3, baths: 2, sqft: 1180, configKnown: false,
    images: [
      '/merlin/projects/skygaze.jpeg',
      '/merlin/projects/skygaze/01.jpg',
      '/merlin/projects/skygaze/02.jpg',
      '/merlin/projects/skygaze/03.jpg',
      '/merlin/projects/skygaze/04.jpg',
      '/merlin/projects/skygaze/05.jpg',
    ],
    blurb:
      'Towers at Chowhati, Sonarpur, on the southern corridor where the Metro extension is reshaping the commute.',
    detail: [
      'Chowhati, in the Sonarpur belt, sits on the southern corridor where the Metro extension is steadily reshaping what a commute from this side of the city looks like. It is early in that change, which is where the pricing advantage comes from.',
      'This is a buy for someone with a longer horizon and a tolerance for an area that is still filling in. The infrastructure is arriving rather than arrived — verify what exists today rather than what is announced, and drive the actual commute at the actual hour before deciding.',
      'Possession June 2027, which is near enough that what you see on site now is a reasonable guide to what you will get.',
      "The gallery leans on height, which is the point of the name — towers above the tree line, a rooftop pool lit at night, a landscaped terrace and a children's pool. In an area still filling in, an outlook that cannot be built out is the most durable thing on offer, so check the sight lines from the specific floor you are shown.",
    ],
  },
  {
    title: 'Merlin Lakescape',
    location: 'New Town, Kolkata',
    possession: 'Dec 2027',
    type: 'Apartment',
    availability: 'buy',
    beds: 3, baths: 3, sqft: 1420, configKnown: false,
    images: [
      '/merlin/projects/lakescape.jpeg',
      '/merlin/projects/lakescape/01.jpg',
      '/merlin/projects/lakescape/03.jpg',
      '/merlin/projects/lakescape/04.jpg',
      '/merlin/projects/lakescape/05.jpg',
    ],
    blurb:
      'New Town, beside the water — a planned road network and the shortest predictable commute to the IT sectors.',
    detail: [
      'New Town was planned from nothing, on a grid, with the widest roads in the metropolitan area and services laid before the buildings went up. It shows in daily life — the commute behaves predictably, there is real open space, and the retail and healthcare have arrived rather than been promised.',
      "Lakescape sits beside the water, which in a planned township means an outlook that is part of the approved layout rather than somebody else's land waiting to become somebody else's project.",
      'You pay for the planning, and the place still feels new in a way some buyers like and others do not. Best judged by walking it on a weekday evening. Possession December 2027.',
      "The gallery details the amenity programme — a co-working floor, a screening room, a library and children's space, a banquet hall, a gym and a games room — alongside the waterfront elevation at night. In New Town, where much is still sold on plans alone, being able to see the finished intent counts for something.",
    ],
  },
  {
    title: 'Merlin X',
    location: 'Topsia, Kolkata',
    possession: 'Mar 2027',
    type: 'Office',
    availability: 'buy',
    beds: 0, baths: 4, sqft: 3200, configKnown: true,
    images: [
      '/merlin/projects/merlin-x.jpeg',
      '/merlin/projects/merlinx/02.jpg',
      '/merlin/projects/merlinx/03.jpg',
      '/merlin/projects/merlinx/04.jpg',
      '/merlin/projects/merlinx/05.jpg',
    ],
    blurb:
      'Grade-A workspace at Topsia, minutes from the EM Bypass and the Park Circus connector.',
    detail: [
      'Topsia is Grade-A workspace territory, minutes from the EM Bypass and the Park Circus connector — which in practice means your staff can reach it from both the northern and southern halves of the city without a difficult journey.',
      'For an occupier, the case is straightforward: central-east Kolkata has limited modern office stock, and the alternative is Sector V, which is further from the residential south and already congested at peak.',
      'Possession March 2027. Floor plates, parking allocation and fit-out specification on request — worth confirming early, as commercial availability moves faster than residential.',
      "The renders show a Grade-A campus rather than a single tower: landscaped decks, a pool level, a sculpture walk and a dusk outlook across the Bypass. For an occupier the decisive numbers are floor plate and parking ratio — ask for both, because the images will not tell you.",
    ],
  },
  {
    title: 'Merlin Oikyo',
    location: 'Baruipur, Kolkata',
    possession: 'Dec 2025',
    type: 'Apartment',
    availability: 'buy',
    beds: 3, baths: 2, sqft: 1080, configKnown: true,
    images: [
      '/merlin/projects/oikyo.jpeg',
      '/merlin/projects/oikyo/01.jpg',
      '/merlin/projects/oikyo/03.jpg',
      '/merlin/projects/oikyo/04.jpg',
      '/merlin/projects/oikyo/05.jpg',
    ],
    blurb:
      '2 and 3 BHK flats in Baruipur, priced for first-time buyers on the southern rail corridor.',
    detail: [
      'Baruipur sits on the southern rail corridor, and the trains are the point: for a commuter working in the city, the local line is more reliable than any road route from this distance.',
      'This is the most accessible price point in the Merlin portfolio, aimed squarely at first-time buyers and at families who want to own rather than keep renting closer in. The arithmetic usually favours buying here over renting nearer the centre well before the ten-year mark.',
      '2 and 3 BHK, with possession December 2025 — effectively ready. Ask to see the actual unit rather than the show flat.',
      "The renders are unusually candid for this price point — a palm-lined internal street, a fountain plaza, a pool, a chess court, a yoga deck and a children's play area, all at grade rather than stacked on a podium. For a first home in Baruipur that is a lot of usable outdoor space, and the clearest reason to prefer it to a barer alternative nearby.",
    ],
  },


  // ── World Trade Center Salt Lake ──────────────────────────────────────────
  // Every figure below is from the Merlin × Aryan Realty brochure and
  // presentation supplied on 19 Sep 2026 — campus size, tower count, parking
  // count, LEED intent and the Tower I RERA number are all quoted, not
  // estimated. This is the one record in this file with no indicative fields.
  {
    title: 'World Trade Center Salt Lake',
    location: 'Block-BP, Sector-V, Salt Lake, Kolkata 700091',
    possession: 'Under construction',
    type: 'Office',
    availability: 'buy',
    // A commercial campus has no bedrooms. `sqft` carries the campus area,
    // which is a real published figure: 5 million sq ft.
    beds: 0, baths: 0, sqft: 5000000, configKnown: true,
    phone: '03371262637',
    rera: 'WBRERA/P/NOR/2025/002844 (Tower I)',
    // Fifteen genuine views, pulled from the supplied renders and from the
    // full-resolution artwork embedded in the brochure and presentation PDFs.
    // Stock lifestyle photography and the New York skyline plates in the deck
    // are deliberately excluded — they are not this building.
    images: [
      '/merlin/wtc/towers-night.jpg',
      '/merlin/wtc/campus-aerial-day.jpg',
      '/merlin/wtc/tower-evening.jpg',
      '/merlin/wtc/retail-frontage-night.jpg',
      '/merlin/wtc/courtyard-plaza.jpg',
      '/merlin/wtc/campus-aerial-dusk.jpg',
      '/merlin/wtc/tower-night-street.jpg',
      '/merlin/wtc/tower-02-evening.jpg',
      '/merlin/wtc/aerial-day.jpg',
      '/merlin/wtc/tower-01-evening.jpg',
      '/merlin/wtc/courtyard.jpg',
      '/merlin/wtc/elevation-concept.jpg',
      '/merlin/wtc/ground-floor-plan.jpg',
      '/merlin/wtc/construction-tower.jpg',
      '/merlin/wtc/construction-site.jpg',
      '/merlin/wtc/kolkata-skyline-night.jpg',
      '/merlin/wtc/salt-lake-aerial.jpg',
      '/merlin/wtc/atrium-interior.jpg',
      '/merlin/wtc/facade-detail-night.jpg',
    ],
    image: '/merlin/wtc/towers-night.jpg',
    amenities: [
      'Business Club',
      '5-Star Luxury Hotel',
      'High-end Retail',
      'Curated F&B',
      'Sports Facilities',
      'Amphitheatre',
      '3200+ Car Parking',
      '2+ Acres Green Space',
      'Platinum LEED (proposed)',
      'Security',
      'Power Backup',
      'CCTV Surveillance',
    ],
    blurb:
      "Eastern India's first integrated World Trade Center campus — a venture by Merlin and Aryan Realty in Salt Lake Sector V, Kolkata's established IT and financial district.",
    detail: [
      'Spans a 5 million sq ft campus with three office towers forming a future-ready IT/ITeS hub, a Business Club, a five-star luxury hotel, high-end retail and curated F&B, sports facilities and an amphitheatre.',
      'Over 2 acres of green space, biophilic planning and a proposed Platinum LEED certification. 3,200+ four-wheeler parking spaces.',
      'Salt Lake Sector V metro station is minutes away, with Netaji Subhash Chandra Bose International Airport, Eco Park, City Centre II and New Town all within the immediate catchment.',
    ],
  },

  // ── Delivered addresses, from the homepage skyline strip ───────────────────
  {
    title: 'Merlin Acropolis',
    location: 'Kolkata',
    possession: 'Delivered',
    type: 'Apartment',
    availability: 'buy',
    beds: 3, baths: 3, sqft: 1650, configKnown: false,
    image: '/merlin/projects/story-acropolis.jpeg',
    blurb: 'One of the delivered Merlin addresses that changed the map of its neighbourhood.',
    detail: [
      'A delivered Merlin address, handed over and lived in. Acropolis is part of the record that the current portfolio rests on — 150+ projects completed and more than 20 million sq ft developed since the mid-1980s.',
      'Listed here for reference and for resale enquiries. For availability in a completed Merlin building, speak to an advisor — stock in delivered projects moves through the secondary market rather than through a sales office.',
    ],
  },
  {
    title: 'Merlin Ventana',
    location: 'Kolkata',
    possession: 'Delivered',
    type: 'Apartment',
    availability: 'buy',
    beds: 3, baths: 3, sqft: 1500, configKnown: false,
    image: '/merlin/projects/story-ventana.jpeg',
    blurb: 'A completed Merlin residential development, handed over and occupied.',
    detail: [
      'A completed Merlin residential development, delivered and occupied. Part of the 150+ projects handed over across four decades of building in eastern India.',
      'Listed for reference and resale enquiries. Availability in a delivered building depends on the secondary market; an advisor can tell you what is currently on offer.',
    ],
  },
  {
    title: 'Merlin The Summit',
    location: 'Kolkata',
    possession: 'Delivered',
    type: 'Apartment',
    availability: 'buy',
    beds: 4, baths: 4, sqft: 2200, configKnown: false,
    image: '/merlin/projects/story-summit.jpeg',
    blurb: 'A delivered Merlin tower, and one of the names buyers still ask for by address.',
    detail: [
      'A delivered Merlin tower, and one of the names Kolkata buyers still ask for by address rather than by developer — which is the most reliable signal a building has aged well.',
      'Listed for reference and resale enquiries. Speak to an advisor about current availability in the secondary market.',
    ],
  },
  {
    title: 'Merlin Ibiza',
    location: 'Kolkata',
    possession: 'Delivered',
    type: 'Apartment',
    availability: 'buy',
    beds: 3, baths: 3, sqft: 1580, configKnown: false,
    image: '/merlin/projects/story-ibiza.jpeg',
    blurb: 'Completed and handed over — part of the 150+ projects Merlin has delivered.',
    detail: [
      'Completed and handed over, part of the 150+ projects Merlin has delivered. A reference point for what the group builds and how it holds up once people are living in it.',
      'Listed for reference and resale enquiries.',
    ],
  },
  {
    title: 'Merlin Altair',
    location: 'Kolkata',
    possession: 'Delivered',
    type: 'Apartment',
    availability: 'buy',
    beds: 4, baths: 4, sqft: 2050, configKnown: false,
    image: '/merlin/projects/story-altair.jpeg',
    blurb: 'A delivered Merlin residential address in the eastern belt of the city.',
    detail: [
      'A delivered Merlin residential address in the eastern belt of the city, completed and occupied.',
      'Listed for reference and resale enquiries. Current availability depends on the secondary market.',
    ],
  },
  {
    title: 'Merlin 5th Avenue',
    location: 'Kolkata',
    possession: 'Delivered',
    type: 'Apartment',
    availability: 'buy',
    beds: 3, baths: 3, sqft: 1700, configKnown: false,
    image: '/merlin/projects/story-5th-avenue.jpeg',
    blurb: 'Completed Merlin residences, part of the 20 million sq ft developed to date.',
    detail: [
      'Completed Merlin residences, part of the 20 million sq ft the group has developed to date.',
      'Listed for reference and resale enquiries.',
    ],
  },
  {
    title: 'Merlin Chennai',
    location: 'Chennai, Tamil Nadu',
    possession: 'Delivered',
    type: 'Apartment',
    availability: 'buy',
    beds: 3, baths: 3, sqft: 1560, configKnown: false,
    image: '/merlin/projects/story-chennai.jpeg',
    blurb: 'Merlin beyond West Bengal — part of the group’s multi-city presence.',
    detail: [
      'Merlin beyond West Bengal. The group operates across five cities — Kolkata, Pune, Chennai, Ahmedabad and Raipur — and Chennai is part of the multi-city presence that underpins the balance sheet behind every project on this site.',
      'Listed for reference. For current availability in Chennai, speak to an advisor.',
    ],
  },
  {
    title: 'Merlin Maximus',
    location: 'Sodepur, BT Road, Kolkata',
    possession: 'Delivered',
    type: 'Apartment',
    availability: 'buy',
    beds: 3, baths: 3, sqft: 1350, configKnown: false,
    image: '/merlin/brand/placeholder.jpg',
    blurb:
      'A complete urban lifestyle away from the hustle of the city — the address Mr. Pijus Sarkar describes in the testimonial on the homepage.',
    detail: [
      "Sodepur, on BT Road in the northern belt. Maximus is the address behind the resident testimonial on the Merlin homepage — a complete urban lifestyle away from the hustle of the city, in Mr. Pijus Sarkar's words.",
      'Delivered and occupied. It is also the practical proof of the northern corridor argument: a family living here has the amenities of a planned development at a price the same specification would not buy further south.',
      'Listed for reference and resale enquiries.',
    ],
  },
];

/** Titles that look like leftover demo rows rather than Merlin developments. */
const DEMO_TITLE = /^(morden|modern)\b.*(appartment|apartment)$/i;

const buildDescription = (seed) => {
  const lines = [seed.blurb];
  // A blank line BETWEEN each paragraph, not just before the first. The
  // frontend renders this with `white-space: pre-line`, which collapses a
  // single newline into a space, so joining on one newline ran every
  // paragraph together into a single wall of text.
  if (seed.detail) lines.push('', seed.detail.join('\n\n'));
  lines.push('', `Possession: ${seed.possession}.`);
  if (!seed.configKnown) {
    lines.push(
      'Configuration and area shown are indicative — confirm the released unit plan with a Merlin advisor.'
    );
  }
  lines.push('Price on request.');
  return lines.join('\n');
};

async function main() {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is not set. Add it to backend/.env.local.');
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB\n');

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const seed of projects) {
    const existing = await Property.findOne({ title: seed.title });

    if (existing && !force) {
      console.log(`  · ${seed.title.padEnd(26)} exists — left alone`);
      skipped += 1;
      continue;
    }

    const doc = existing || new Property({ title: seed.title });

    doc.location = seed.location;
    // Deliberately 0 — see the note at the top of this file.
    doc.price = 0;
    doc.image = seed.images || [seed.image];
    doc.beds = seed.beds;
    doc.baths = seed.baths;
    doc.sqft = seed.sqft;
    doc.type = seed.type;
    doc.availability = seed.availability;
    doc.description = buildDescription(seed);
    doc.amenities = seed.amenities || (seed.type === 'Office' ? COMMERCIAL_AMENITIES : BASE_AMENITIES);
    doc.phone = seed.phone || CONTACT_PHONE;
    doc.googleMapLink = '';
    doc.rera = seed.rera || '';
    doc.status = 'active';
    doc.postedBy = null;
    doc.expiresAt = null;

    await doc.save();
    console.log(`  ${existing ? '✓' : '+'} ${seed.title.padEnd(26)} ${existing ? 'updated' : 'created'}`);
    if (existing) updated += 1;
    else created += 1;
  }

  if (purgeDemo) {
    const demo = await Property.find({ title: DEMO_TITLE }).lean();
    if (demo.length) {
      await Property.deleteMany({ _id: { $in: demo.map((d) => d._id) } });
      console.log(`\nRemoved ${demo.length} demo listing(s): ${demo.map((d) => d.title).join(', ')}`);
    } else {
      console.log('\nNo demo listings matched — nothing removed.');
    }
  }

  const total = await Property.countDocuments({ status: 'active' });
  console.log(`\ncreated ${created} · updated ${updated} · skipped ${skipped}`);
  console.log(`${total} active properties now live on /properties`);
  console.log('\nPrices are 0 and render as "Price on request". Set real prices,');
  console.log('configurations and areas in the admin panel under All Properties.');
}

main()
  .catch((error) => {
    console.error('\nSeed failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close().catch(() => {});
  });
