import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import config from '../config';
import * as web3Service from '../services/web3Service';

const MONGO_STATE: Record<number, string> = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
  99: 'uninitialized',
};

export async function getHealth(_req: Request, res: Response): Promise<void> {
  res.json({
    status: 'ok',
    uptimeSec: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    mongo: MONGO_STATE[mongoose.connection.readyState] ?? 'unknown',
    chainId: config.chain.chainId,
    escrow: web3Service.getEscrowAddress() || null,
  });
}
