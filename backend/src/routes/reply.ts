import { Router } from 'express';
import asyncHandler from '../utils/asyncHandler';
import {
  requestReply,
  getPendingReplies,
  respondReply,
  refundReply,
  runRefundPass,
} from '../controllers/replyController';

const router = Router();

/**
 * @swagger
 * /api/reply/request:
 *   post:
 *     summary: Pay-to-Reply — request a reply (escrow MUSD until creator responds)
 *     description: |
 *       The client sends an MUSD `transfer` from `requesterWallet` to the
 *       backend's escrow wallet, then submits the `txHash` here. The
 *       backend verifies the transfer, creates a `pending` Reply with a
 *       deadline of `now + REPLY_WINDOW_HOURS` (default 24h). If the
 *       creator does not respond before the deadline, the cron job (or a
 *       manual call to `/api/reply/refund`) refunds the requester.
 *     tags: [Reply]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ReplyRequestRequest'
 *     responses:
 *       201:
 *         description: Pending reply created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Reply'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 */
router.post('/request', asyncHandler(requestReply));

/**
 * @swagger
 * /api/reply/pending:
 *   get:
 *     summary: List a creator's pending replies (sorted by soonest deadline)
 *     tags: [Reply]
 *     parameters:
 *       - in: query
 *         name: creatorWallet
 *         required: true
 *         schema: { type: string, description: "Creator wallet address (0x...)" }
 *     responses:
 *       200:
 *         description: Pending replies
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Reply'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 */
router.get('/pending', asyncHandler(getPendingReplies));

/**
 * @swagger
 * /api/reply/respond:
 *   post:
 *     summary: Creator responds to a pending reply (uploads optional media to IPFS)
 *     tags: [Reply]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ReplyRespondRequest'
 *     responses:
 *       200:
 *         description: Reply marked as responded
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Reply'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 */
router.post('/respond', asyncHandler(respondReply));

/**
 * @swagger
 * /api/reply/refund:
 *   post:
 *     summary: Refund a pending reply whose deadline has passed (manual trigger)
 *     description: |
 *       Performs the same refund the cron job would. Sends MUSD from the
 *       backend escrow wallet back to `requesterWallet`. Allowed only when
 *       the deadline has elapsed and the reply is still `pending`.
 *     tags: [Reply]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ReplyRefundRequest'
 *     responses:
 *       200:
 *         description: Refund issued
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Reply'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 */
router.post('/refund', asyncHandler(refundReply));

/**
 * @swagger
 * /api/reply/refund/run:
 *   post:
 *     summary: Trigger one full refund-pass (admin / debug)
 *     description: Runs the same logic as the scheduled cron job, immediately.
 *     tags: [Reply]
 *     responses:
 *       200:
 *         description: Pass complete
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 processed: { type: integer }
 *                 succeeded: { type: integer, nullable: true }
 *                 skipped:   { type: boolean, nullable: true }
 */
router.post('/refund/run', asyncHandler(runRefundPass));

export default router;
