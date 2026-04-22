import { Router } from 'express';
import asyncHandler from '../utils/asyncHandler';
import { getAdminActivityTable } from '../controllers/adminController';

const router = Router();

router.get('/activity', asyncHandler(getAdminActivityTable));

export default router;
