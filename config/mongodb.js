// Backward-compatible import for older deployment scripts.
// The application database is MySQL; new code should import ./mysql.js.
export { default } from './mysql.js';
export * from './mysql.js';
