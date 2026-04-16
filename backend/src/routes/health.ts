import { Router } from 'express';
import asyncHandler from '../utils/asyncHandler';
import { getHealth } from '../controllers/healthController';

const router = Router();

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Health check
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Health'
 */
router.get('/', asyncHandler(getHealth));

export default router;
