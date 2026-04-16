import { Router } from 'express';
import asyncHandler from '../utils/asyncHandler';
import { createPost, getPost } from '../controllers/postController';

const router = Router();

/**
 * @swagger
 * /api/posts:
 *   post:
 *     summary: Create a post (uploads media to IPFS, persists in DB)
 *     tags: [Posts]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreatePostRequest'
 *     responses:
 *       201:
 *         description: Post created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Post'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 */
router.post('/', asyncHandler(createPost));

/**
 * @swagger
 * /api/posts/{postId}:
 *   get:
 *     summary: Fetch a single post (reveals ipfsHash if viewer has unlocked)
 *     tags: [Posts]
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: viewer
 *         required: false
 *         schema: { type: string, description: "Viewer wallet address (0x...)" }
 *     responses:
 *       200:
 *         description: The post (with ipfsHash conditionally hidden)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FeedItem'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:postId', asyncHandler(getPost));

export default router;
