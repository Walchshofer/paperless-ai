---
applyTo: "routes/**/*.js"
description: Express route and API documentation standards
---

# Route & API Standards

## JSDoc/Swagger Documentation

Every route must have OpenAPI 3.0.0 documentation:

```javascript
/**
 * @swagger
 * /api/example:
 *   get:
 *     summary: Brief description of endpoint
 *     description: |
 *       Detailed explanation of the endpoint functionality.
 *       This should cover what the endpoint does and important behaviors.
 *     tags:
 *       - Documents
 *       - API
 *     parameters:
 *       - in: query
 *         name: id
 *         schema:
 *           type: integer
 *         description: Document ID
 *     responses:
 *       200:
 *         description: Success response
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 */
router.get('/api/example', async (req, res) => {
    // Implementation
});

/**
 * @swagger
 * /api/visual-rag/batch/start:
 *   post:
 *     summary: Start a batch visual re-ingest job
 *     description: |
 *       Start a re-ingest job for Paperless originals. Accepts filters such as `pdfOnly` and a list of `ids`.
 *     tags:
 *       - Documents
 *       - API
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               filters:
 *                 type: object
 *                 properties:
 *                   pdfOnly:
 *                     type: boolean
 *                   ids:
 *                     type: array
 *                     items:
 *                       type: integer
 *     responses:
 *       200:
 *         description: Re-ingest job accepted
 *       400:
 *         description: Bad request
 *       429:
 *         description: Rate limit exceeded - batch re-ingests should be rate limited to protect sidecars
 */
router.post('/api/visual-rag/batch/start', async (req, res) => {
    // Implementation
});
```

## Available Tags
- `Authentication` - User auth endpoints
- `Documents` - Document management
- `History` - Processing history
- `Navigation` - UI page routes
- `System` - Config, health, admin
- `Chat` - Document chat functionality
- `API` - Data API endpoints

## Route Path Conventions
- Use kebab-case for multi-word paths: `/api/document-types`
- Path parameters in curly braces: `/api/documents/{id}`
- No trailing slashes
- Base path: `/api/`

## Request Handling

### Authentication
```javascript
// Check authentication first
if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
}
```

### Input Validation
```javascript
// Validate required parameters
const { id } = req.params;
if (!id) {
    return res.status(400).json({ error: 'Missing document ID' });
}
```

### Error Responses
```javascript
// Consistent error format
res.status(500).json({
    error: 'Operation failed',
    message: error.message,
    requestId: req.headers['x-request-id']
});
```

## Response Formats

### Success
```javascript
res.json({
    success: true,
    data: result,
    meta: { count: result.length }
});
```

### Pagination
```javascript
res.json({
    data: items,
    pagination: {
        page: currentPage,
        pageSize: limit,
        total: totalCount,
        hasMore: hasNextPage
    }
});
```

## Security
- Validate all user input
- Sanitize data before database operations
- Use parameterized queries
- Check permissions for sensitive operations
