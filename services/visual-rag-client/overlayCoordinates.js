/**
 * Overlay coordinate normalization helpers.
 *
 * Canonical legacy array format is:
 *   box = [xmin, ymin, xmax, ymax]
 *
 * Normalized UI format is:
 *   { x, y, width, height } in 0..1
 */

function clamp01(value) {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(1, value));
}

function getScaleFromValues(values) {
    const maxValue = Math.max(...values.map((v) => Math.abs(v)));
    if (maxValue <= 1) return 1;
    if (maxValue <= 1000) return 1000;
    // Fallback for unexpected absolute coordinates.
    return maxValue;
}

function normalizeBoxObject(box) {
    if (!box || typeof box !== 'object') return null;

    const x = Number(box.x);
    const y = Number(box.y);
    const width = Number(box.width);
    const height = Number(box.height);

    if (![x, y, width, height].every(Number.isFinite)) return null;

    const scale = getScaleFromValues([x, y, width, height]);
    return {
        x: clamp01(x / scale),
        y: clamp01(y / scale),
        width: clamp01(width / scale),
        height: clamp01(height / scale)
    };
}

function normalizeLegacyBoxArray(box) {
    if (!Array.isArray(box) || box.length < 4) return null;

    const [rawX1, rawY1, rawX2, rawY2] = box.map(Number);
    if (![rawX1, rawY1, rawX2, rawY2].every(Number.isFinite)) return null;

    const x1 = Math.min(rawX1, rawX2);
    const x2 = Math.max(rawX1, rawX2);
    const y1 = Math.min(rawY1, rawY2);
    const y2 = Math.max(rawY1, rawY2);

    const scale = getScaleFromValues([x1, y1, x2, y2]);
    return {
        x: clamp01(x1 / scale),
        y: clamp01(y1 / scale),
        width: clamp01((x2 - x1) / scale),
        height: clamp01((y2 - y1) / scale)
    };
}

function normalizeOverlayBoundingBox(data) {
    if (!data || typeof data !== 'object') return null;

    // Canonical source for persisted overlays in this project.
    if (Array.isArray(data.box)) {
        const fromArray = normalizeLegacyBoxArray(data.box);
        if (fromArray) return fromArray;
    }

    if (data.boundingBox && typeof data.boundingBox === 'object') {
        const fromBoundingBox = normalizeBoxObject(data.boundingBox);
        if (fromBoundingBox) return fromBoundingBox;
    }

    if (data.bbox && typeof data.bbox === 'object' && !Array.isArray(data.bbox)) {
        const fromBbox = normalizeBoxObject(data.bbox);
        if (fromBbox) return fromBbox;
    }

    if (
        Number.isFinite(Number(data.x_min)) &&
        Number.isFinite(Number(data.y_min)) &&
        Number.isFinite(Number(data.x_max)) &&
        Number.isFinite(Number(data.y_max))
    ) {
        return normalizeLegacyBoxArray([data.x_min, data.y_min, data.x_max, data.y_max]);
    }

    return null;
}

module.exports = {
    normalizeBoxObject,
    normalizeLegacyBoxArray,
    normalizeOverlayBoundingBox
};
