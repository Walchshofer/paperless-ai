// Small CommonJS helper for overlay viewer transform math (testable from Node)
function computeUnscaledFromRaw(rawX, rawY, tx, ty, s) {
  return {
    x: (rawX - tx) / s,
    y: (rawY - ty) / s
  };
}

module.exports = { computeUnscaledFromRaw };
