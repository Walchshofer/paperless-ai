// services/customFieldUtils.js

const MAX_LENGTH = 255;

function normalizeCustomFieldValue(value) {
  // Handle null/undefined
  if (value === null || value === undefined) return '';

  // Objects / Arrays: JSON-stringify
  if (typeof value === 'object') {
    try {
      const s = JSON.stringify(value);
      return s.length > MAX_LENGTH ? s.substring(0, MAX_LENGTH) : s;
    } catch (e) {
      // Fallback to coarse string
      const s = String(value);
      return s.length > MAX_LENGTH ? s.substring(0, MAX_LENGTH) : s;
    }
  }

  // Coerce to string
  const s = String(value);
  return s.length > MAX_LENGTH ? s.substring(0, MAX_LENGTH) : s;
}

module.exports = {
  normalizeCustomFieldValue,
  MAX_LENGTH
};
