import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Always read env from the backend folder. Passenger does not use that folder
// as the process working directory, so a relative ".env" lookup misses the file.
const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: path.join(backendRoot, '.env.local') });
}
dotenv.config({ path: path.join(backendRoot, '.env') });
