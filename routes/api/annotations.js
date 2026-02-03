const express = require('express');
const router = express.Router();
const { authenticateApi } = require('../../middleware/auth');
const annotationService = require('../../services/AnnotationService');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

function getUserIdFromReq(req) {
  if (req.user && req.user.id) return req.user.id;
  try {
    const auth = req.headers.authorization;
    if (!auth) return null;
    const parts = auth.split(' ');
    if (parts.length !== 2) return null;
    if (parts[0] !== 'Bearer') return null;
    const decoded = jwt.verify(parts[1], JWT_SECRET);
    return decoded && decoded.id ? decoded.id : null;
  } catch (e) {
    return null;
  }
}

/**
 * @swagger
 * /api/annotations:
 *   post:
 *     summary: Save user annotations for a document
 *     description: Saves user-created visual annotations (bounding boxes with labels/notes) for a specific document and page
 *     tags:
 *       - Annotations
 *       - API
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - documentId
 *               - annotations
 *             properties:
 *               documentId:
 *                 type: integer
 *               page:
 *                 type: integer
 *                 default: 0
 *               annotations:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     bbox:
 *                       type: object
 *                       properties:
 *                         x: { type: number }
 *                         y: { type: number }
 *                         width: { type: number }
 *                         height: { type: number }
 *                     label:
 *                       type: string
 *                     note:
 *                       type: string
 *     responses:
 *       200:
 *         description: Annotations saved successfully
 *       401:
 *         description: Unauthorized
 */
router.post('/', authenticateApi, async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ error: 'Authentication required' });
    const { documentId, page, annotations } = req.body || {};
    if (!documentId || !Array.isArray(annotations)) return res.status(400).json({ error: 'Invalid payload' });

    const created = [];
    for (const ann of annotations) {
      // allow either normalized bbox object or array
      const bbox = ann.bbox || { x: ann.x, y: ann.y, width: ann.width, height: ann.height };
      const saved = await annotationService.saveAnnotation(userId, documentId, page || 0, bbox, ann.label || null, ann.note || null);
      created.push(saved);
    }

    res.json({ success: true, created });
  } catch (err) {
    console.error('Failed to save annotations:', err && err.message);
    res.status(500).json({ error: err.message || 'Failed to save annotations' });
  }
});

/**
 * @swagger
 * /api/annotations/{documentId}:
 *   get:
 *     summary: Load user annotations for a document
 *     description: Retrieves user-created annotations for a specific document and optionally a specific page
 *     tags:
 *       - Annotations
 *       - API
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Annotations retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/:documentId', authenticateApi, async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ error: 'Authentication required' });
    const { documentId } = req.params;
    const page = req.query.page !== undefined ? Number(req.query.page) : null;
    const anns = await annotationService.loadAnnotations(userId, Number(documentId), page);
    res.json({ annotations: anns });
  } catch (err) {
    console.error('Failed to load annotations:', err && err.message);
    res.status(500).json({ error: err.message || 'Failed to load annotations' });
  }
});

/**
 * @swagger
 * /api/annotations/{id}:
 *   delete:
 *     summary: Delete a user annotation
 *     description: Deletes a specific annotation by ID (user must be the owner)
 *     tags:
 *       - Annotations
 *       - API
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Annotation deleted successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Annotation not found
 */
router.delete('/:id', authenticateApi, async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ error: 'Authentication required' });
    const { id } = req.params;
    const result = await annotationService.deleteAnnotation(userId, id);
    if (!result) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('Failed to delete annotation:', err && err.message);
    res.status(500).json({ error: err.message || 'Failed to delete annotation' });
  }
});

/**
 * @swagger
 * /api/annotations/{id}:
 *   put:
 *     summary: Update a user annotation
 *     description: Updates label, note, or bbox of an existing annotation (user must be the owner)
 *     tags:
 *       - Annotations
 *       - API
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               label:
 *                 type: string
 *               note:
 *                 type: string
 *               bbox:
 *                 type: object
 *     responses:
 *       200:
 *         description: Annotation updated successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Annotation not found
 */
router.put('/:id', authenticateApi, async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ error: 'Authentication required' });
    const { id } = req.params;
    const updates = req.body || {};
    const updated = await annotationService.updateAnnotation(userId, id, updates);
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true, annotation: updated });
  } catch (err) {
    console.error('Failed to update annotation:', err && err.message);
    res.status(500).json({ error: err.message || 'Failed to update annotation' });
  }
});

module.exports = router;
