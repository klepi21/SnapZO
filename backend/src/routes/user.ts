import { Router } from 'express';
import asyncHandler from '../utils/asyncHandler';
import { getUser } from '../controllers/userController';

const router = Router();

/**
 * @swagger
 * /api/user/{wallet}:
 *   get:
 *     summary: Fetch user profile and their posts
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: wallet
 *         required: true
 *         schema: { type: string, description: "User wallet address (0x...)" }
 *     responses:
 *       200:
 *         description: User + their posts
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *                 posts:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Post'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 */
router.get('/:wallet', asyncHandler(getUser));

export default router;
