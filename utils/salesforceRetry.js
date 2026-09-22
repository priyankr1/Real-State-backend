import cron from 'node-cron';
import Enquiry from '../models/enquiryModel.js';
import { isSalesforceConfigured } from '../services/salesforceService.js';
import { syncToSalesforce } from '../controller/enquiryController.js';
import logger from '../utils/logger.js';

const MAX_ATTEMPTS = 6;

/**
 * Retries enquiries that failed to reach Salesforce.
 *
 * Salesforce goes down, tokens get revoked, validation rules get added on a
 * Friday afternoon. Without this, those leads would sit in MongoDB with
 * nobody in sales ever seeing them — the enquiry looks captured and is
 * effectively lost. Runs every 10 minutes and gives up after MAX_ATTEMPTS so
 * a permanently malformed lead cannot spin forever; the admin panel still
 * shows it as failed with the error, and a human can resync it.
 */
export function startSalesforceRetryJob() {
  if (!isSalesforceConfigured()) return;

  cron.schedule('*/10 * * * *', async () => {
    try {
      const stuck = await Enquiry.find({
        'salesforce.status': { $in: ['pending', 'failed'] },
        'salesforce.attempts': { $lt: MAX_ATTEMPTS },
      })
        .sort({ createdAt: 1 })
        .limit(25)
        .select('_id')
        .lean();

      if (!stuck.length) return;

      // Sequential on purpose: a burst of parallel writes into a recovering
      // org is how you trip Salesforce's API limits and fail all of them.
      for (const { _id } of stuck) {
        await syncToSalesforce(_id);
      }

      logger.info('Salesforce retry sweep complete', { attempted: stuck.length });
    } catch (error) {
      logger.error('Salesforce retry sweep failed', { error: error.message });
    }
  });
}

export default startSalesforceRetryJob;
