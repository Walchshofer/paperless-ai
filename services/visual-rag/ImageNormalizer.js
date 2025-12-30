const sharp = require('sharp');
const config = require('../../config/config');
const { pdfRenderer } = require('./PDFRenderer');
const DEFAULT_DPI = config.visualRag?.visionRenderDpi || 300;
const DEFAULT_MAX_PAGES = config.visualRag?.maxVisionPages || 4;
const DEFAULT_FORMAT = 'png';

const SUPPORTED_FORMATS = new Set(['png', 'jpeg', 'jpg', 'webp']);

const clampNumber = (value, min, max) => Math.min(Math.max(value, min), max);

const looksLikePdf = (buffer) => {
    if (!buffer || buffer.length < 5) return false;
    return buffer.slice(0, 5).toString('utf8') === '%PDF-';
};

const normalizeAction = (action, warnings) => {
    if (!action || typeof action !== 'object') return null;
    const type = String(action.type || action.action || '').trim().toLowerCase();
    if (!type) return null;

    if (type === 'rotate') {
        const degrees = Number.parseInt(
            action.degrees ?? action.angle ?? action.rotation ?? 0,
            10
        );
        if (![0, 90, 180, 270].includes(degrees)) {
            warnings.push(`rotate degrees unsupported: ${action.degrees}`);
            return null;
        }
        return { type: 'rotate', degrees };
    }

    if (type === 'crop') {
        const box = action.box || {};
        const unit = String(box.unit || action.unit || 'ratio')
            .trim()
            .toLowerCase();
        const x = Number(box.x ?? action.x);
        const y = Number(box.y ?? action.y);
        const width = Number(box.width ?? action.width);
        const height = Number(box.height ?? action.height);
        const isFiniteBox = [x, y, width, height].every(Number.isFinite);
        if (!isFiniteBox) {
            warnings.push('crop box invalid or missing');
            return null;
        }
        const normalizedUnit = unit === 'pixel' || unit === 'px'
            ? 'pixel'
            : 'ratio';
        return {
            type: 'crop',
            box: { x, y, width, height, unit: normalizedUnit }
        };
    }

    if (type === 'scale') {
        const scale = Number(action.scale ?? action.factor);
        const width = Number.parseInt(action.width, 10);
        const height = Number.parseInt(action.height, 10);
        const maxWidth = Number.parseInt(action.max_width ?? action.maxWidth, 10);
        const maxHeight = Number.parseInt(action.max_height ?? action.maxHeight, 10);
        if (Number.isFinite(scale) && scale > 0) {
            return { type: 'scale', scale };
        }
        if (Number.isFinite(width) || Number.isFinite(height)) {
            return {
                type: 'scale',
                width: Number.isFinite(width) ? width : null,
                height: Number.isFinite(height) ? height : null
            };
        }
        if (Number.isFinite(maxWidth) || Number.isFinite(maxHeight)) {
            return {
                type: 'scale',
                maxWidth: Number.isFinite(maxWidth) ? maxWidth : null,
                maxHeight: Number.isFinite(maxHeight) ? maxHeight : null
            };
        }
        warnings.push('scale action missing width/height/max/scale');
        return null;
    }

    if (type === 'dpi') {
        const target = Number(
            action.target ?? action.target_dpi ?? action.dpi ?? action.value
        );
        if (!Number.isFinite(target) || target <= 0) {
            warnings.push(`dpi target invalid: ${action.target}`);
            return null;
        }
        return { type: 'dpi', target };
    }

    warnings.push(`unknown action type: ${type}`);
    return null;
};

const normalizeActions = (actions = []) => {
    const warnings = [];
    const normalized = Array.isArray(actions)
        ? actions.map(action => normalizeAction(action, warnings)).filter(Boolean)
        : [];
    return { actions: normalized, warnings };
};

const resolveTargetDpi = (actions, options = {}) => {
    const explicit = Number(options.target_dpi ?? options.dpi);
    if (Number.isFinite(explicit) && explicit > 0) {
        return explicit;
    }
    const dpiAction = actions
        .slice()
        .reverse()
        .find(action => action.type === 'dpi' && Number.isFinite(action.target));
    if (dpiAction) {
        return dpiAction.target;
    }
    return DEFAULT_DPI;
};

const resolvePages = (options = {}) => {
    const rawPages = Array.isArray(options.pages)
        ? options.pages
        : null;
    if (rawPages && rawPages.length > 0) {
        const pages = rawPages
            .map(page => Number.parseInt(page, 10))
            .filter(page => Number.isInteger(page) && page > 0);
        if (pages.length > 0) {
            const min = Math.min(...pages);
            const max = Math.max(...pages);
            return { pages, range: { start: min, end: max } };
        }
    }

    const range = options.page_range || options.pageRange || null;
    const start = Number.parseInt(range?.start, 10);
    const end = Number.parseInt(range?.end, 10);
    if (Number.isInteger(start) && Number.isInteger(end) && start > 0 && end > 0) {
        const normalizedStart = Math.min(start, end);
        const normalizedEnd = Math.max(start, end);
        const pages = [];
        for (let page = normalizedStart; page <= normalizedEnd; page += 1) {
            pages.push(page);
        }
        return { pages, range: { start: normalizedStart, end: normalizedEnd } };
    }

    return { pages: null, range: null };
};

const resolveFormat = (format) => {
    const normalized = String(format || DEFAULT_FORMAT).trim().toLowerCase();
    if (!normalized) return DEFAULT_FORMAT;
    if (SUPPORTED_FORMATS.has(normalized)) {
        return normalized === 'jpg' ? 'jpeg' : normalized;
    }
    return DEFAULT_FORMAT;
};

const resolveResizeFromMax = (width, height, maxWidth, maxHeight) => {
    if (!width || !height) return { width, height };
    const widthLimit = maxWidth || width;
    const heightLimit = maxHeight || height;
    if (width <= widthLimit && height <= heightLimit) {
        return { width, height };
    }
    const ratio = width / height;
    let targetWidth = widthLimit;
    let targetHeight = Math.round(widthLimit / ratio);
    if (targetHeight > heightLimit) {
        targetHeight = heightLimit;
        targetWidth = Math.round(heightLimit * ratio);
    }
    return {
        width: Math.max(1, targetWidth),
        height: Math.max(1, targetHeight)
    };
};

class ImageNormalizer {
    static async normalizeBuffer(buffer, options = {}) {
        if (!buffer || !Buffer.isBuffer(buffer)) {
            throw new Error('normalizeBuffer requires a Buffer');
        }
        const { actions, warnings } = normalizeActions(options.actions);
        const targetDpi = resolveTargetDpi(actions, options);
        const format = resolveFormat(options.format);
        const { pages, range } = resolvePages(options);
        const maxPagesRaw = Number.parseInt(options.max_pages, 10);
        const maxPages = Number.isFinite(maxPagesRaw) ? maxPagesRaw : DEFAULT_MAX_PAGES;

        if (looksLikePdf(buffer)) {
            const lastPage = pages?.length
                ? Math.max(...pages)
                : maxPages;
            const renderMax = Number.isFinite(lastPage) && lastPage > 0
                ? lastPage
                : maxPages;
            const rendered = await pdfRenderer.renderBuffer(buffer, {
                dpi: targetDpi,
                maxPages: renderMax,
                docId: options.docId || options.documentId || Date.now()
            });
            const filtered = pages?.length
                ? rendered.filter(page => pages.includes(page.page))
                : rendered;
            const outputs = [];
            for (const page of filtered) {
                const processed = await this._applyActions(
                    Buffer.from(page.base64, 'base64'),
                    actions,
                    { targetDpi, format, warnings }
                );
                outputs.push({
                    page: page.page,
                    ...processed,
                    metadata: {
                        ...processed.metadata,
                        page: page.page
                    }
                });
            }
            return {
                base64Images: outputs.map(output => output.base64),
                metadata: {
                    source: 'pdf',
                    format,
                    target_dpi: targetDpi,
                    page_range: range,
                    pages: outputs.map(output => output.metadata),
                    actions_applied: actions,
                    warnings
                }
            };
        }

        const processed = await this._applyActions(
            buffer,
            actions,
            { targetDpi, format, warnings }
        );
        return {
            base64Images: [processed.base64],
            metadata: {
                source: 'image',
                format,
                target_dpi: targetDpi,
                page_range: range,
                pages: [{
                    ...processed.metadata,
                    page: 1
                }],
                actions_applied: actions,
                warnings
            }
        };
    }

    static async _applyActions(buffer, actions, options) {
        let pipeline = sharp(buffer, { failOnError: false });
        const metadata = await pipeline.metadata();
        let width = metadata.width || null;
        let height = metadata.height || null;
        let density = metadata.density || null;
        const targetDpi = options.targetDpi || DEFAULT_DPI;
        const warnings = options.warnings || [];

        for (const action of actions) {
            if (action.type === 'rotate') {
                if (action.degrees !== 0) {
                    pipeline = pipeline.rotate(action.degrees);
                    if (width && height && (action.degrees === 90 || action.degrees === 270)) {
                        const temp = width;
                        width = height;
                        height = temp;
                    }
                }
                continue;
            }

            if (action.type === 'crop') {
                if (!width || !height) {
                    warnings.push('crop skipped: missing dimensions');
                    continue;
                }
                const unit = action.box.unit || 'ratio';
                let left = action.box.x;
                let top = action.box.y;
                let cropWidth = action.box.width;
                let cropHeight = action.box.height;
                if (unit === 'ratio') {
                    left = Math.round(clampNumber(left, 0, 1) * width);
                    top = Math.round(clampNumber(top, 0, 1) * height);
                    cropWidth = Math.round(clampNumber(cropWidth, 0, 1) * width);
                    cropHeight = Math.round(clampNumber(cropHeight, 0, 1) * height);
                } else {
                    left = Math.round(left);
                    top = Math.round(top);
                    cropWidth = Math.round(cropWidth);
                    cropHeight = Math.round(cropHeight);
                }
                cropWidth = Math.max(1, cropWidth);
                cropHeight = Math.max(1, cropHeight);
                if (left < 0 || top < 0 || left + cropWidth > width || top + cropHeight > height) {
                    warnings.push('crop box out of bounds, clamping');
                    left = clampNumber(left, 0, width - 1);
                    top = clampNumber(top, 0, height - 1);
                    cropWidth = Math.min(cropWidth, width - left);
                    cropHeight = Math.min(cropHeight, height - top);
                }
                pipeline = pipeline.extract({
                    left,
                    top,
                    width: cropWidth,
                    height: cropHeight
                });
                width = cropWidth;
                height = cropHeight;
                continue;
            }

            if (action.type === 'scale') {
                if (!width || !height) {
                    warnings.push('scale skipped: missing dimensions');
                    continue;
                }
                if (Number.isFinite(action.scale)) {
                    const scaledWidth = Math.max(1, Math.round(width * action.scale));
                    const scaledHeight = Math.max(1, Math.round(height * action.scale));
                    pipeline = pipeline.resize(scaledWidth, scaledHeight);
                    width = scaledWidth;
                    height = scaledHeight;
                    continue;
                }
                if (action.width || action.height) {
                    const targetWidth = action.width || Math.round(width * (action.height / height));
                    const targetHeight = action.height || Math.round(height * (action.width / width));
                    pipeline = pipeline.resize(targetWidth, targetHeight);
                    width = targetWidth;
                    height = targetHeight;
                    continue;
                }
                if (action.maxWidth || action.maxHeight) {
                    const resolved = resolveResizeFromMax(
                        width,
                        height,
                        action.maxWidth,
                        action.maxHeight
                    );
                    if (resolved.width !== width || resolved.height !== height) {
                        pipeline = pipeline.resize(resolved.width, resolved.height);
                        width = resolved.width;
                        height = resolved.height;
                    }
                }
                continue;
            }

            if (action.type === 'dpi') {
                if (density && Number.isFinite(action.target) && action.target > 0) {
                    const scaleFactor = action.target / density;
                    if (Math.abs(scaleFactor - 1) > 0.01 && width && height) {
                        const targetWidth = Math.max(1, Math.round(width * scaleFactor));
                        const targetHeight = Math.max(1, Math.round(height * scaleFactor));
                        pipeline = pipeline.resize(targetWidth, targetHeight);
                        width = targetWidth;
                        height = targetHeight;
                    }
                }
                density = action.target || density;
            }
        }

        const format = options.format || DEFAULT_FORMAT;
        if (format === 'jpeg') {
            pipeline = pipeline.jpeg({ quality: 95 });
        } else if (format === 'webp') {
            pipeline = pipeline.webp({ quality: 95 });
        } else {
            pipeline = pipeline.png();
        }

        if (Number.isFinite(targetDpi) && targetDpi > 0) {
            density = targetDpi;
        }

        pipeline = pipeline.withMetadata({
            density: Number.isFinite(density) ? density : undefined
        });

        const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });

        return {
            base64: data.toString('base64'),
            metadata: {
                page: null,
                width: info.width,
                height: info.height,
                density: Number.isFinite(density) ? density : null,
                format,
                bytes: info.size
            }
        };
    }
}

module.exports = { ImageNormalizer };
