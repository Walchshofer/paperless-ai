/**
 * PDFRenderer.js
 *
 * Renders PDF documents to high-resolution images for vision model processing.
 * Uses pdf-poppler for rendering at configurable DPI (default 300).
 *
 * Architecture Reference: PROMPT-003 (Dual-Path Ingestion)
 *
 * Requirements:
 * - npm install pdf-poppler
 * - Poppler binaries must be installed:
 *   - Windows: Download from https://github.com/oschwartz10612/poppler-windows/releases
 *   - Linux: apt-get install poppler-utils
 *   - Docker: Already included in visual-rag-sidecar
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const logger = require('../logger');
const config = require('../../config/config');

// Lazy-load pdf-poppler to allow graceful degradation (Windows only)
let pdfPoppler = null;
let useNativePoppler = null; // true = use system pdftoppm, false = use npm package
const isWindows = os.platform() === 'win32';

/**
 * Check if system pdftoppm is available (Linux/Docker)
 */
async function checkNativePoppler() {
    if (useNativePoppler !== null) return useNativePoppler;

    // On Windows, use the npm package instead of native
    if (isWindows) {
        useNativePoppler = false;
        return false;
    }

    try {
        const cmd = isWindows ? 'where pdftoppm' : 'which pdftoppm';
        await execAsync(cmd);
        useNativePoppler = true;
        logger.info('[PDFRenderer] Using native pdftoppm from system');
        return true;
    } catch {
        useNativePoppler = false;
        return false;
    }
}

function getPdfPoppler() {
    // pdf-poppler npm package only works on Windows - don't even try to load on Linux
    if (!isWindows) {
        pdfPoppler = false;
        return null;
    }

    if (pdfPoppler === null) {
        try {
            pdfPoppler = require('pdf-poppler');
        } catch (err) {
            logger.warn('[PDFRenderer] pdf-poppler not available:', err.message);
            pdfPoppler = false;
        }
    }
    return pdfPoppler || null;
}

class PDFRenderer {
    constructor(options = {}) {
        this.dpi = options.dpi || config.visualRag?.visionRenderDpi || 300;
        this.maxPages = options.maxPages || config.visualRag?.maxVisionPages || 4;
        this.format = options.format || 'png';
        this.tempDir = options.tempDir || path.join(os.tmpdir(), 'paperless-ai-render');
    }

    /**
     * Build a unique, filesystem-safe token for a single render request.
     * Using per-request tokens prevents filename collisions under concurrency.
     * @private
     * @param {string|number} docId
     * @returns {string}
     */
    _buildRenderToken(docId) {
        const raw = String(docId || 'doc');
        const safe = raw
            .replace(/[^a-zA-Z0-9_-]/g, '_')
            .replace(/_+/g, '_')
            .slice(0, 80) || 'doc';
        const nonce = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        return `${safe}-${nonce}`;
    }

    /**
     * Check if PDF rendering is available
     * @returns {boolean}
     */
    isAvailable() {
        // Check synchronously first for cached value
        if (useNativePoppler === true) return true;
        if (getPdfPoppler() !== null) return true;
        // If neither is available yet, assume native will be checked
        return useNativePoppler !== false;
    }

    /**
     * Async check for availability (more reliable)
     * @returns {Promise<boolean>}
     */
    async isAvailableAsync() {
        if (await checkNativePoppler()) return true;
        return getPdfPoppler() !== null;
    }

    /**
     * Render a PDF buffer to images
     * @param {Buffer} pdfBuffer - PDF file as buffer
     * @param {Object} options - Rendering options
     * @returns {Promise<Array<{page: number, base64: string, path: string}>>}
     */
    async renderBuffer(pdfBuffer, options = {}) {
        // Check for native poppler first (Linux/Docker)
        const hasNative = await checkNativePoppler();
        const hasPackage = getPdfPoppler() !== null;

        if (!hasNative && !hasPackage) {
            throw new Error('PDF rendering not available. Install poppler-utils or pdf-poppler.');
        }

        const dpi = options.dpi || this.dpi;
        const maxPages = options.maxPages || this.maxPages;
        const docId = options.docId || Date.now();
        const renderToken = this._buildRenderToken(docId);

        // Create temp directory
        await fs.mkdir(this.tempDir, { recursive: true });

        // Write PDF to temp file
        const tempPdfPath = path.join(this.tempDir, `doc-${renderToken}.pdf`);
        await fs.writeFile(tempPdfPath, pdfBuffer);

        try {
            // Render PDF to images - prefer native on Linux
            if (hasNative) {
                return await this._renderPdfNative(tempPdfPath, renderToken, dpi, maxPages);
            } else {
                return await this._renderPdfPackage(tempPdfPath, renderToken, dpi, maxPages);
            }
        } finally {
            // Cleanup temp PDF
            try {
                await fs.unlink(tempPdfPath);
            } catch (err) {
                // Log cleanup errors for diagnostics
                logger.debug(`[PDFRenderer] Failed to remove temp PDF ${tempPdfPath}: ${err.message}`);
            }
        }
    }

    /**
     * Render a PDF file to images
     * @param {string} pdfPath - Path to PDF file
     * @param {Object} options - Rendering options
     * @returns {Promise<Array<{page: number, base64: string, path: string}>>}
     */
    async renderFile(pdfPath, options = {}) {
        const hasNative = await checkNativePoppler();
        const hasPackage = getPdfPoppler() !== null;

        if (!hasNative && !hasPackage) {
            throw new Error('PDF rendering not available. Install poppler-utils or pdf-poppler.');
        }

        const dpi = options.dpi || this.dpi;
        const maxPages = options.maxPages || this.maxPages;
        const docId = options.docId || path.basename(pdfPath, '.pdf');
        const renderToken = this._buildRenderToken(docId);

        // Create temp directory for output
        await fs.mkdir(this.tempDir, { recursive: true });

        if (hasNative) {
            return this._renderPdfNative(pdfPath, renderToken, dpi, maxPages);
        } else {
            return this._renderPdfPackage(pdfPath, renderToken, dpi, maxPages);
        }
    }

    /**
     * Render PDF using native pdftoppm command (Linux/Docker)
     * @private
     */
    async _renderPdfNative(pdfPath, renderToken, dpi, maxPages) {
        const outputBase = `render-${renderToken}`;
        const outputPrefix = path.join(this.tempDir, outputBase);

        logger.debug(`[PDFRenderer] Rendering ${pdfPath} at ${dpi} DPI using native pdftoppm`);

        try {
            // Build pdftoppm command
            // pdftoppm -png -r <dpi> -l <lastPage> <input.pdf> <output-prefix>
            const cmd = `pdftoppm -png -r ${dpi} -l ${maxPages} "${pdfPath}" "${outputPrefix}"`;

            await execAsync(cmd, { timeout: 60000 });

            // Find rendered images (pdftoppm names them: prefix-1.png, prefix-2.png, etc.)
            const files = await fs.readdir(this.tempDir);
            const imageFiles = files
                .filter(f => f.startsWith(outputBase) && f.endsWith('.png'))
                .sort()
                .slice(0, maxPages);

            logger.debug(`[PDFRenderer] Native pdftoppm rendered ${imageFiles.length} pages`);

            // Read images as base64
            const results = [];
            for (let i = 0; i < imageFiles.length; i++) {
                const imagePath = path.join(this.tempDir, imageFiles[i]);
                const imageBuffer = await fs.readFile(imagePath);
                const base64 = imageBuffer.toString('base64');

                results.push({
                    page: i + 1,
                    base64: base64,
                    path: imagePath,
                    size: imageBuffer.length,
                    format: 'png'
                });

                // Cleanup image file after reading
                try {
                    await fs.unlink(imagePath);
                } catch (err) {
                    // Log cleanup errors for diagnostics
                    logger.debug(`[PDFRenderer] Failed to remove rendered image ${imagePath}: ${err.message}`);
                }
            }

            logger.info(`[PDFRenderer] Successfully rendered ${results.length} pages at ${dpi} DPI (native)`);

            return results;
        } catch (error) {
            logger.error(`[PDFRenderer] Native rendering failed: ${error.message}`);
            throw new Error(`PDF rendering failed: ${error.message}`);
        }
    }

    /**
     * Render PDF using pdf-poppler npm package (Windows)
     * @private
     */
    async _renderPdfPackage(pdfPath, renderToken, dpi, maxPages) {
        const poppler = getPdfPoppler();
        const outputBase = `render-${renderToken}`;

        const opts = {
            format: this.format,
            out_dir: this.tempDir,
            out_prefix: outputBase,
            page: null  // All pages
        };

        // Set resolution
        if (dpi) {
            opts.scale = dpi;  // pdf-poppler uses scale for DPI
        }

        logger.debug(`[PDFRenderer] Rendering ${pdfPath} at ${dpi} DPI using pdf-poppler package`);

        try {
            // Convert PDF to images
            await poppler.convert(pdfPath, opts);

            // Find rendered images
            const files = await fs.readdir(this.tempDir);
            const imageFiles = files
                .filter(f => f.startsWith(outputBase) && f.endsWith(`.${this.format}`))
                .sort()
                .slice(0, maxPages);

            logger.debug(`[PDFRenderer] Package rendered ${imageFiles.length} pages`);

            // Read images as base64
            const results = [];
            for (let i = 0; i < imageFiles.length; i++) {
                const imagePath = path.join(this.tempDir, imageFiles[i]);
                const imageBuffer = await fs.readFile(imagePath);
                const base64 = imageBuffer.toString('base64');

                results.push({
                    page: i + 1,
                    base64: base64,
                    path: imagePath,
                    size: imageBuffer.length,
                    format: this.format
                });

                // Cleanup image file after reading
                try {
                    await fs.unlink(imagePath);
                } catch (err) {
                    // Log cleanup errors for diagnostics
                    logger.debug(`[PDFRenderer] Failed to remove rendered image ${imagePath}: ${err.message}`);
                }
            }

            logger.info(`[PDFRenderer] Successfully rendered ${results.length} pages at ${dpi} DPI (package)`);

            return results;
        } catch (error) {
            logger.error(`[PDFRenderer] Package rendering failed: ${error.message}`);
            throw new Error(`PDF rendering failed: ${error.message}`);
        }
    }

    /**
     * Render PDF and return only base64 strings (convenience method)
     * @param {Buffer|string} pdfSource - PDF buffer or file path
     * @param {Object} options - Rendering options
     * @returns {Promise<Array<string>>} Array of base64 encoded images
     */
    async renderToBase64(pdfSource, options = {}) {
        let results;

        if (Buffer.isBuffer(pdfSource)) {
            results = await this.renderBuffer(pdfSource, options);
        } else if (typeof pdfSource === 'string') {
            results = await this.renderFile(pdfSource, options);
        } else {
            throw new Error('Invalid PDF source: must be Buffer or file path');
        }

        return results.map(r => r.base64);
    }

    /**
     * Get info about rendered pages
     * @param {Buffer|string} pdfSource - PDF buffer or file path
     * @returns {Promise<{pageCount: number, canRender: boolean}>}
     */
    async getInfo(pdfSource) {
        let tempPdfPath = null;
        try {
            // Normalize source to a file path when provided as Buffer
            let pdfPath;
            if (Buffer.isBuffer(pdfSource)) {
                await fs.mkdir(this.tempDir, { recursive: true });
                tempPdfPath = path.join(this.tempDir, `doc-info-${Date.now()}.pdf`);
                await fs.writeFile(tempPdfPath, pdfSource);
                pdfPath = tempPdfPath;
            } else if (typeof pdfSource === 'string') {
                pdfPath = pdfSource;
            } else {
                throw new Error('Invalid PDF source: must be Buffer or file path');
            }

            // If native poppler (pdfinfo) is available, use it to get page count
            if (await checkNativePoppler()) {
                try {
                    const { stdout } = await execAsync(`pdfinfo "${pdfPath}"`, { timeout: 15000 });
                    const match = stdout.match(/Pages:\s+(\d+)/i);
                    const pageCount = match ? parseInt(match[1], 10) : -1;
                    return { pageCount, canRender: pageCount > 0 };
                } catch (err) {
                    logger.error(`[PDFRenderer] pdfinfo failed: ${err.message}`);
                    return { pageCount: 0, canRender: false, error: err.message };
                }
            }

            // If only pdf-poppler package is available, we can say rendering is possible
            if (getPdfPoppler() !== null) {
                // pdf-poppler does not provide page-count info easily without rendering;
                // return best-effort response that rendering is possible, but pageCount unknown.
                return { pageCount: -1, canRender: true };
            }

            // No rendering capability
            return { pageCount: 0, canRender: false };
        } catch (err) {
            logger.error(`[PDFRenderer] getInfo failed: ${err.message}`);
            return { pageCount: 0, canRender: false, error: err.message };
        } finally {
            if (tempPdfPath) {
                try {
                    await fs.unlink(tempPdfPath);
                } catch (err) {
                    logger.debug(`[PDFRenderer] Failed to remove temp info PDF ${tempPdfPath}: ${err.message}`);
                }
            }
        }
    }

    /**
     * Cleanup temp directory
     */
    async cleanup() {
        try {
            const files = await fs.readdir(this.tempDir);
            for (const file of files) {
                if (file.startsWith('render-') || file.startsWith('doc-')) {
                    try {
                        await fs.unlink(path.join(this.tempDir, file));
                    } catch (err) {
                        logger.debug(`[PDFRenderer] cleanup: failed to remove ${file}: ${err.message}`);
                    }
                }
            }
            logger.debug('[PDFRenderer] Temp files cleaned up');
        } catch (err) {
            // Log read/cleanup failures
            logger.debug(`[PDFRenderer] cleanup failed: ${err.message}`);
        }
    }
}

// Export singleton and class
const pdfRenderer = new PDFRenderer();

module.exports = {
    PDFRenderer,
    pdfRenderer
};
