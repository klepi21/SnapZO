import { Router } from 'express';
import asyncHandler from '../utils/asyncHandler';
import { createUnlock } from '../controllers/unlockController';

const router = Router();

/**
 * @swagger
 * /api/unlock:
 *   post:
 *     summary: Unlock a locked post (verifies the on-chain MUSD transfer)
 *     description: |
 *       The client first sends an MUSD `transfer` from `userWallet` to the
 *       post's `creatorWallet` for at least `unlockPrice`. The resulting
 *       `txHash` is submitted here. The backend verifies the transfer
 *       on-chain (Mezo testnet), persists an Unlock record, and returns
 *       the unlocked `ipfsHash`.
 *     tags: [Unlock]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UnlockRequest'
 *     responses:
 *       201:
 *         description: Unlock recorded
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 unlock:
 *                   $ref: '#/components/schemas/Unlock'
 *                 ipfsHash:
 *                   type: string
 *                   description: CID of the now-unlocked media
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 */
router.post('/', asyncHandler(createUnlock));

export default router;
