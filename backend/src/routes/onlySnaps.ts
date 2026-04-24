import { Router } from 'express';
import asyncHandler from '../utils/asyncHandler';
import {
  getOnlySnapsPlan,
  getOnlySnapsStatus,
  recordOnlySnapsSubscription,
  upsertOnlySnapsPlan,
} from '../controllers/onlySnapsController';

const router = Router();

router.get('/plan/:creatorWallet', asyncHandler(getOnlySnapsPlan));
router.post('/plan', asyncHandler(upsertOnlySnapsPlan));
router.post('/subscription/record', asyncHandler(recordOnlySnapsSubscription));
router.get('/status', asyncHandler(getOnlySnapsStatus));

export default router;
