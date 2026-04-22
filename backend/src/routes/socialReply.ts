import { Router } from 'express';
import asyncHandler from '../utils/asyncHandler';
import {
  createSocialReplyRequestRecord,
  fulfillSocialReplyRecord,
  listSocialRepliesForPost,
} from '../controllers/socialReplyController';

const router = Router();

router.post('/request', asyncHandler(createSocialReplyRequestRecord));
router.get('/post/:postObjectId', asyncHandler(listSocialRepliesForPost));
router.post('/fulfill', asyncHandler(fulfillSocialReplyRecord));

export default router;
