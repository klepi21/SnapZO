import { Router } from 'express';
import asyncHandler from '../utils/asyncHandler';
import { createTip, getTipsForPost } from '../controllers/tipController';

const router = Router();

/**
 * @swagger
 * /api/tip:
 *   post:
 *     summary: Pay-to-Like — record a tip after verifying the on-chain MUSD transfer
 *     description: |
 *       The client sends an MUSD `transfer` from `fromWallet` to the post's
 *       `creatorWallet` for `amount`, then submits the resulting `txHash`
 *       here. The backend verifies the transfer on-chain, persists the Tip,
 *       and increments `Post.totalTips`.
 *     tags: [Tip]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TipRequest'
 *     responses:
 *       201:
 *         description: Tip recorded
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Tip'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 */
router.post('/', asyncHandler(createTip));
router.get('/post/:postObjectId', asyncHandler(getTipsForPost));

export default router;
