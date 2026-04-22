import { Router } from 'express';
import asyncHandler from '../utils/asyncHandler';
import { deleteAdminPost, getAdminActivityTable } from '../controllers/adminController';

const router = Router();

router.get('/activity', asyncHandler(getAdminActivityTable));
router.delete('/posts/:postObjectId', asyncHandler(deleteAdminPost));

export default router;
