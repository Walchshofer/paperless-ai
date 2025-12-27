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

        // Create temp directory
        await fs.mkdir(this.tempDir, { recursive: true });

        // Write PDF to temp file
        const tempPdfPath = path.join(this.tempDir, `doc-${docId}.pdf`);
        await fs.writeFile(tempPdfPath, pdfBuffer);

        try {
            // Render PDF to images - prefer native on Linux
            if (hasNative) {
                return await this._renderPdfNative(tempPdfPath, docId, dpi, maxPages);
            } else {
                return await this._renderPdfPackage(tempPdfPath, docId, dpi, maxPages);
            }
        } finally {
            // Cleanup temp PDF
            try {
                await fs.unlink(tempPdfPath);
            } catch (err) {
                // Ignore cleanup errors
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

        // Create temp directory for output
        await fs.mkdir(this.tempDir, { recursive: true });

        if (hasNative) {
            return this._renderPdfNative(pdfPath, docId, dpi, maxPages);
        } else {
            return this._renderPdfPackage(pdfPath, docId, dpi, maxPages);
        }
    }

    /**
     * Render PDF using native pdftoppm command (Linux/Docker)
     * @private
     */
    async _renderPdfNative(pdfPath, docId, dpi, maxPages) {
        const outputPrefix = path.join(this.tempDir, `render-${docId}`);

        logger.debug(`[PDFRenderer] Rendering ${pdfPath} at ${dpi} DPI using native pdftoppm`);

        try {
            // Build pdftoppm command
            // pdftoppm -png -r <dpi> -l <lastPage> <input.pdf> <output-prefix>
            const cmd = `pdftoppm -png -r ${dpi} -l ${maxPages} "${pdfPath}" "${outputPrefix}"`;

            await execAsync(cmd, { timeout: 60000 });

            // Find rendered images (pdftoppm names them: prefix-1.png, prefix-2.png, etc.)
            const files = await fs.readdir(this.tempDir);
            const imageFiles = files
                .filter(f => f.startsWith(`render-${docId}`) && f.endsWith('.png'))
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
                    // Ignore cleanup errors
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
    async _renderPdfPackage(pdfPath, docId, dpi, maxPages) {
        const poppler = getPdfPoppler();

        const opts = {
            format: this.format,
            out_dir: this.tempDir,
            out_prefix: `render-${docId}`,
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
                .filter(f => f.startsWith(`render-${docId}`) && f.endsWith(`.${this.format}`))
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
                    // Ignore cleanup errors
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
        const poppler = getPdfPoppler();
        if (!poppler) {
            return { pageCount: 0, canRender: false };
        }

        try {
            // pdf-poppler doesn't have a direct info method, so we'd need to use pdfinfo
            // For now, return a placeholder
            return { pageCount: -1, canRender: true };
        } catch (error) {
            return { pageCount: 0, canRender: false, error: error.message };
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
                    await fs.unlink(path.join(this.tempDir, file));
                }
            }
            logger.debug('[PDFRenderer] Temp files cleaned up');
        } catch (err) {
            // Ignore cleanup errors
        }
    }
}

// Export singleton and class
const pdfRenderer = new PDFRenderer();

module.exports = {
    PDFRenderer,
    pdfRenderer
};
