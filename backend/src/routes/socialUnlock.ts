import { Router } from 'express';
import asyncHandler from '../utils/asyncHandler';
import { createSocialUnlockRecord } from '../controllers/socialUnlockController';

const router = Router();

router.post('/record', asyncHandler(createSocialUnlockRecord));

export default router;
