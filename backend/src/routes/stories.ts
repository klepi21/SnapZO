import { Router } from 'express';
import asyncHandler from '../utils/asyncHandler';
import { createStory, getStoriesFeed, markStorySeen } from '../controllers/storyController';

const router = Router();

router.get('/feed', asyncHandler(getStoriesFeed));
router.post('/', asyncHandler(createStory));
router.post('/seen', asyncHandler(markStorySeen));

export default router;
