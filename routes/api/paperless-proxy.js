const express = require('express');
const axios = require('axios');
const config = require('../../config/config');
const { authenticateApi } = require('../../middleware/auth');
const logger = require('../../services/logger');

const router = express.Router();

const HOP_BY_HOP_RESPONSE_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

const FORWARDED_REQUEST_HEADERS = [
  'range',
  'if-none-match',
  'if-modified-since',
  'accept',
  'accept-language',
  'user-agent',
];

function getPaperlessProxyConfig() {
  return {
    apiUrl: String(
      config.paperless?.apiUrl || process.env.PAPERLESS_API_URL || ''
    ).trim(),
    apiToken: String(
      config.paperless?.apiToken || process.env.PAPERLESS_API_TOKEN || ''
    ).trim(),
  };
}

function buildUpstreamUrl(originalUrl, apiUrl) {
  const rawApiUrl = String(apiUrl || '').trim().replace(/\/+$/, '');
  if (!rawApiUrl) return '';

  const baseApiUrl = rawApiUrl.endsWith('/api')
    ? `${rawApiUrl}/`
    : `${rawApiUrl}/api/`;

  const relativePath = String(originalUrl || '')
    .replace(/^\/api\/proxied\/paperless\/?/, '');

  const canonicalPath = relativePath.replace(
    '/download/original/',
    '/download/'
  );

  return new URL(canonicalPath, baseApiUrl).toString();
}

function buildForwardHeaders(req, apiToken) {
  const headers = {
    Authorization: `Token ${apiToken}`,
  };

  FORWARDED_REQUEST_HEADERS.forEach((headerName) => {
    const value = req.headers[headerName];
    if (value !== undefined) {
      const normalizedHeader = headerName
        .split('-')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join('-');
      headers[normalizedHeader] = value;
    }
  });

  return headers;
}

function applyUpstreamHeaders(res, headers = {}) {
  Object.entries(headers).forEach(([name, value]) => {
    if (HOP_BY_HOP_RESPONSE_HEADERS.has(String(name).toLowerCase())) {
      return;
    }
    if (value !== undefined) {
      res.setHeader(name, value);
    }
  });
}

router.use(authenticateApi);

router.use(async (req, res) => {
  const { apiUrl, apiToken } = getPaperlessProxyConfig();
  if (!apiUrl || !apiToken) {
    return res.status(503).json({
      error: 'Paperless proxy unavailable',
      message: 'PAPERLESS_API_URL or PAPERLESS_API_TOKEN is missing',
    });
  }

  const upstreamUrl = buildUpstreamUrl(req.originalUrl, apiUrl);
  if (!upstreamUrl) {
    return res.status(503).json({
      error: 'Paperless proxy unavailable',
      message: 'Unable to resolve upstream Paperless API URL',
    });
  }

  try {
    const upstreamResponse = await axios.request({
      method: req.method,
      url: upstreamUrl,
      headers: buildForwardHeaders(req, apiToken),
      data:
        req.method === 'GET' || req.method === 'HEAD'
          ? undefined
          : req.body,
      responseType: 'stream',
      timeout: 15000,
      validateStatus: () => true,
      maxRedirects: 0,
    });

    applyUpstreamHeaders(res, upstreamResponse.headers);
    res.status(upstreamResponse.status);

    if (req.method === 'HEAD') {
      return res.end();
    }

    upstreamResponse.data.on('error', (streamError) => {
      logger.warn({
        event: 'paperless_proxy_stream_error',
        method: req.method,
        path: req.originalUrl,
        error: streamError.message,
      });
      if (!res.headersSent) {
        res.status(502).json({
          error: 'Paperless upstream stream error',
          message: streamError.message,
        });
      } else {
        res.destroy(streamError);
      }
    });

    upstreamResponse.data.pipe(res);
    return undefined;
  } catch (error) {
    logger.warn({
      event: 'paperless_proxy_upstream_error',
      method: req.method,
      path: req.originalUrl,
      upstreamUrl,
      error: error.message,
      code: error.code || null,
    });

    return res.status(502).json({
      error: 'Paperless upstream request failed',
      message: error.message,
      code: error.code || null,
    });
  }
});

module.exports = router;
module.exports._buildUpstreamUrl = buildUpstreamUrl;
module.exports._buildForwardHeaders = buildForwardHeaders;
module.exports._getPaperlessProxyConfig = getPaperlessProxyConfig;
