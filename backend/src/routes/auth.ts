import { Router } from 'express';
import asyncHandler from '../utils/asyncHandler';
import { login } from '../controllers/authController';

const router = Router();

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Idempotent wallet login / first-time signup
 *     description: |
 *       Call this immediately after the user connects their wallet on the
 *       frontend. Behavior:
 *
 *         - If the wallet is **not** in the DB yet → a User row is created
 *           and the response has `isNew: true` (HTTP 201).
 *         - If the wallet already exists → nothing is written and the
 *           existing user is returned with `isNew: false` (HTTP 200).
 *
 *       Optional `username`, `bio`, and `profileImage` are only persisted
 *       on the first insert; they are never used to overwrite an existing
 *       profile (use a dedicated profile-update endpoint for that).
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Existing user returned (no write)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *       201:
 *         description: New user created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 */
router.post('/login', asyncHandler(login));

export default router;
