import mongoose from 'mongoose';

/**
 * A website enquiry, with the campaign attribution that produced it.
 *
 * The point of this collection is not the enquiry — it is the join between an
 * enquiry and the ad spend that created it. Every field below the contact
 * details exists so marketing can answer "which campaign produced this lead".
 *
 * Attribution is stored as BOTH first touch and last touch, deliberately.
 * Which one counts is a business decision Merlin has not made yet, and
 * recording only one is irreversible — the discarded half cannot be
 * reconstructed later. `SALESFORCE_ATTRIBUTION_MODEL` decides which set is
 * mapped onto the Salesforce Lead; the other travels in the description.
 */

const touchSchema = new mongoose.Schema(
  {
    source: { type: String, default: '', trim: true },   // utm_source
    medium: { type: String, default: '', trim: true },   // utm_medium
    campaign: { type: String, default: '', trim: true }, // utm_campaign
    term: { type: String, default: '', trim: true },     // utm_term
    content: { type: String, default: '', trim: true },  // utm_content
    id: { type: String, default: '', trim: true },       // utm_id

    // Click identifiers. These are what actually reconcile against the ad
    // platforms — UTMs can be stripped or rewritten, a gclid cannot.
    gclid: { type: String, default: '', trim: true },
    fbclid: { type: String, default: '', trim: true },
    msclkid: { type: String, default: '', trim: true },

    referrer: { type: String, default: '', trim: true },
    landingPage: { type: String, default: '', trim: true },
    at: { type: Date, default: null },
  },
  { _id: false }
);

const enquirySchema = new mongoose.Schema(
  {
    // ── Who ────────────────────────────────────────────────────────────────
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 200 },
    phone: { type: String, default: '', trim: true, maxlength: 32 },
    message: { type: String, default: '', trim: true, maxlength: 4000 },

    /** Free-text interest ("City residences", a project name, …). */
    interest: { type: String, default: '', trim: true, maxlength: 200 },

    // ── Salesforce enquiry detail ──────────────────────────────────────────
    // Fields the Merlin InsertNewEnquiry endpoint carries. All optional: no
    // form collects every one, and the endpoint only insists on name, mobile
    // and campaign code. They exist so a campaign landing page or a site-visit
    // booking form can supply them without a second integration being written.

    /** Dial code, e.g. "+91". Derived from the phone number when not sent. */
    countryCode: { type: String, default: '', trim: true, maxlength: 8 },
    country: { type: String, default: '', trim: true, maxlength: 60 },

    /**
     * The campaign this enquiry belongs to, as Salesforce knows it.
     *
     * Mandatory on the endpoint, and the field Salesforce uses to derive the
     * project, source and sub-source — so it is stored on the enquiry rather
     * than recomputed at send time. A retry weeks later then reproduces the
     * code the visitor actually arrived under, not the code today's mapping
     * would infer.
     */
    campaignCode: { type: String, default: '', trim: true, maxlength: 60 },

    /** "Same State" / "Other State" / "NRI" — free text, echoed as sent. */
    customerOrigin: { type: String, default: '', trim: true, maxlength: 60 },
    /** Unit configuration, e.g. "2 BHK". */
    configuration: { type: String, default: '', trim: true, maxlength: 120 },
    /** Budget bucket, e.g. "2_bhk_-_78_lakhs_onw". */
    budget: { type: String, default: '', trim: true, maxlength: 120 },

    /** When the visitor asked to be called. */
    preferredCallAt: { type: Date, default: null },
    /** When the visitor asked to visit, and how. */
    preferredVisitAt: { type: Date, default: null },
    preferredVisitType: { type: String, default: '', trim: true, maxlength: 40 },

    // ── Where it came from on the site ──────────────────────────────────────
    formType: {
      type: String,
      enum: ['contact', 'callback', 'project', 'brochure', 'gallery', 'chatbot', 'other'],
      default: 'contact',
      index: true,
    },
    /** Path the form was submitted from, e.g. "/gallery/merlin-rise". */
    pagePath: { type: String, default: '', trim: true, maxlength: 500 },
    pageTitle: { type: String, default: '', trim: true, maxlength: 300 },

    // ── Attribution ────────────────────────────────────────────────────────
    firstTouch: { type: touchSchema, default: () => ({}) },
    lastTouch: { type: touchSchema, default: () => ({}) },

    /**
     * The phone number this visitor was actually shown. Source-wise number
     * swapping is only auditable if the number served is recorded next to the
     * lead — otherwise an inbound call cannot be tied back to a campaign.
     */
    displayedPhone: { type: String, default: '', trim: true, maxlength: 32 },
    /** The key from the phone-number map that produced `displayedPhone`. */
    phoneSource: { type: String, default: '', trim: true, maxlength: 60 },

    // ── Consent ────────────────────────────────────────────────────────────
    // India's DPDP Act expects consent to be demonstrable, which means storing
    // the wording shown at the time, not just a boolean.
    consent: { type: Boolean, default: false },
    consentText: { type: String, default: '', trim: true, maxlength: 500 },

    // ── Lifecycle ──────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: ['new', 'contacted', 'qualified', 'unqualified', 'converted', 'closed'],
      default: 'new',
      index: true,
    },
    notes: { type: String, default: '', trim: true, maxlength: 4000 },

    // ── Salesforce ─────────────────────────────────────────────────────────
    salesforce: {
      status: {
        type: String,
        enum: ['pending', 'synced', 'failed', 'skipped'],
        default: 'pending',
        index: true,
      },
      /** The record id Salesforce returned. Empty for web-to-lead, which returns none. */
      leadId: { type: String, default: '' },
      syncedAt: { type: Date, default: null },
      attempts: { type: Number, default: 0 },
      lastError: { type: String, default: '' },
      /** 'enquiry-api' | 'rest' | 'web-to-lead' — which transport handled it. */
      mode: { type: String, default: '' },

      /**
       * False once Salesforce has rejected this enquiry for a reason that
       * cannot change on its own — a missing mandatory field, an unknown
       * campaign code, a 404 on the Apex path. The retry sweep skips these:
       * replaying a rejection every ten minutes for six hours consumes the
       * org's API limits and buries the failures that are worth retrying.
       * It still shows as failed in the admin panel, where a human can fix
       * the data and resync.
       */
      retryable: { type: Boolean, default: true },

      /** The message the endpoint returned, verbatim — its wording is the diagnosis. */
      message: { type: String, default: '' },

      /** The campaign code actually sent, which may have been inferred from UTMs. */
      campaignCode: { type: String, default: '' },
    },

    // ── Request metadata ───────────────────────────────────────────────────
    userAgent: { type: String, default: '', maxlength: 500 },
    /**
     * Hashed, never raw. The IP is only needed to spot abuse bursts; keeping
     * it in the clear turns a lead table into personal data with no upside.
     */
    ipHash: { type: String, default: '' },

    /**
     * reCAPTCHA v3 outcome.
     *
     * Recorded rather than acted on silently. v3 returns a probability, not a
     * verdict, so a hard block at a fixed threshold turns away some genuine
     * buyers invisibly and nobody ever finds out. Storing the score means the
     * threshold can be tuned against real submissions, and a borderline lead
     * can be judged by a human instead of discarded by a number.
     *
     * `verified: false` with `score: null` means Google was unreachable, not
     * that the visitor failed — see utils/recaptcha.js.
     */
    recaptcha: {
      verified: { type: Boolean, default: false },
      score: { type: Number, default: null },
      action: { type: String, default: '' },
      reason: { type: String, default: '' },
    },
  },
  { timestamps: true }
);

// The admin list is "newest first, optionally filtered by status/formType".
enquirySchema.index({ createdAt: -1 });
enquirySchema.index({ status: 1, createdAt: -1 });
enquirySchema.index({ 'salesforce.status': 1, createdAt: -1 });
// Campaign reporting reads by source/campaign.
enquirySchema.index({ 'firstTouch.source': 1, 'firstTouch.campaign': 1 });

/**
 * Bound to the pre-existing `forms` collection so the enquiries already
 * captured by the old contact form remain visible in the admin panel. Those
 * documents simply have empty attribution — they predate it.
 */
const Enquiry = mongoose.model('Enquiry', enquirySchema, 'forms');

export default Enquiry;
