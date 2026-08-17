import emailService from '../services/emailService.js';

const result = await emailService.getHealthStatus();
console.log(JSON.stringify(result, null, 2));

if (result.status !== 'healthy') {
  process.exitCode = 1;
}
