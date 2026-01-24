import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const cfg = require('./config.js');

// Export a default ESM-friendly wrapper for CommonJS config
export default cfg;
export const config = cfg;
