import { Router } from 'express';
import asyncHandler from '../utils/asyncHandler';
import { getUser, listUsers, updateProfile } from '../controllers/userController';

const router = Router();

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: List all users (with optional search and pagination)
 *     tags: [Users]
 *     parameters:
 *       - in: query
 *         name: limit
 *         required: false
 *         schema: { type: integer, minimum: 1, maximum: 200, default: 50 }
 *       - in: query
 *         name: offset
 *         required: false
 *         schema: { type: integer, minimum: 0, default: 0 }
 *       - in: query
 *         name: search
 *         required: false
 *         schema:
 *           type: string
 *           description: "Case-insensitive substring match on walletAddress or username."
 *     responses:
 *       200:
 *         description: Paged list of users
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/User'
 *                 total:      { type: integer }
 *                 limit:      { type: integer }
 *                 offset:     { type: integer }
 *                 nextOffset: { type: integer, nullable: true }
 */
router.get('/', asyncHandler(listUsers));

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

/**
 * @swagger
 * /api/user/{wallet}:
 *   patch:
 *     summary: Update profile fields for a wallet
 *     description: |
 *       Partial update. Any subset of `displayName`, `username`, `bio`,
 *       `avatarBase64` may be provided. Pass `null` on a field to clear
 *       it. When `avatarBase64` is supplied, the backend uploads it to
 *       IPFS and stores the resulting CID as `profileImage`.
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: wallet
 *         required: true
 *         schema: { type: string, description: "User wallet address (0x...)" }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateProfileRequest'
 *     responses:
 *       200:
 *         description: Updated user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.patch('/:wallet', asyncHandler(updateProfile));

export default router;
