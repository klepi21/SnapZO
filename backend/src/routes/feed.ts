import { Router } from 'express';
import asyncHandler from '../utils/asyncHandler';
import { getFeed } from '../controllers/postController';

const router = Router();

/**
 * @swagger
 * /api/feed:
 *   get:
 *     summary: Public feed (blurred for locked posts, revealed for unlocked)
 *     tags: [Feed]
 *     parameters:
 *       - in: query
 *         name: viewer
 *         required: false
 *         schema: { type: string, description: "Viewer wallet address (0x...). Used to mark unlockedByMe and reveal ipfsHash." }
 *       - in: query
 *         name: limit
 *         required: false
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *       - in: query
 *         name: cursor
 *         required: false
 *         schema: { type: string, format: date-time, description: "ISO timestamp — returns posts created strictly before this." }
 *     responses:
 *       200:
 *         description: Feed page
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/FeedItem'
 *                 nextCursor:
 *                   type: string
 *                   format: date-time
 *                   nullable: true
 */
router.get('/', asyncHandler(getFeed));

export default router;
