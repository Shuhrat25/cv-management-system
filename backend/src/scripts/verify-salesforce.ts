import 'dotenv/config';
import { getJwtSecret } from '../middleware/auth';
import { SalesforceError, verifySalesforceConnection } from '../services/salesforce';

async function main() {
  if (process.env.SF_VERIFY_ON_START !== 'true') return;
  try {
    getJwtSecret();
    const result = await verifySalesforceConnection();
    console.log(`Salesforce verification: CONNECTED (read-only check; CRM writes ${result.writesEnabled ? 'enabled' : 'disabled'}).`);
  } catch (error) {
    // An optional CRM outage must not take the independent course demo offline.
    console.warn('Salesforce verification: NOT CONNECTED.', error instanceof SalesforceError ? error.message : 'Check private integration configuration.');
  }
}
void main();
