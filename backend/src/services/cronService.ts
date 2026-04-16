/**
 * Cron service — periodically scans for `pending` replies whose 24h
 * deadline has elapsed and refunds them via the escrow wallet.
 */

import cron, { type ScheduledTask } from 'node-cron';
import type { Server as SocketIOServer } from 'socket.io';
import config from '../config';
import logger from '../utils/logger';
import Reply from '../models/Reply';
import * as web3Service from './web3Service';

let task: ScheduledTask | null = null;
let ioRef: SocketIOServer | null = null;
let inFlight = false;

export interface ProcessResult {
  processed: number;
  succeeded?: number;
  skipped?: boolean;
}

export function setSocketIo(io: SocketIOServer): void {
  ioRef = io;
}

/** One pass over the pending-and-expired set. */
export async function processExpiredReplies(): Promise<ProcessResult> {
  if (inFlight) {
    logger.debug('cronService: previous run still in flight, skipping');
    return { processed: 0, skipped: true };
  }
  inFlight = true;

  try {
    const now = new Date();
    const expired = await Reply.find({ status: 'pending', deadline: { $lte: now } })
      .limit(50)
      .lean();

    if (expired.length === 0) return { processed: 0 };

    logger.info(`cronService: found ${expired.length} expired pending replies`);

    let succeeded = 0;
    for (const reply of expired) {
      try {
        const txHash = await web3Service.sendMusdRefund({
          to: reply.requesterWallet as string,
          amount: reply.amount as number,
        });

        await Reply.updateOne(
          { _id: reply._id, status: 'pending' },
          { $set: { status: 'refunded', refundTxHash: txHash } }
        );
        succeeded += 1;

        ioRef?.to(`requester:${reply.requesterWallet}`).emit('reply:refunded', {
          replyId: String(reply._id),
          postId: String(reply.post),
          amount: reply.amount,
          refundTxHash: txHash,
        });
      } catch (err) {
        logger.error(
          `cronService: refund failed for reply ${String(reply._id)}`,
          (err as Error).message
        );
      }
    }
    return { processed: expired.length, succeeded };
  } finally {
    inFlight = false;
  }
}

export function start(): void {
  if (task) {
    logger.warn('cronService: already started');
    return;
  }
  if (!cron.validate(config.reply.refundCron)) {
    logger.error(`cronService: invalid cron schedule "${config.reply.refundCron}"`);
    return;
  }

  task = cron.schedule(
    config.reply.refundCron,
    async () => {
      try {
        const res = await processExpiredReplies();
        if (res.processed > 0) {
          logger.info(
            `cronService: refund pass done — ${res.succeeded ?? 0}/${res.processed} succeeded`
          );
        }
      } catch (err) {
        logger.error('cronService: refund pass crashed', err);
      }
    },
    { scheduled: true }
  );

  logger.info(`cronService: started (schedule "${config.reply.refundCron}")`);
}

export function stop(): void {
  if (task) {
    task.stop();
    task = null;
    logger.info('cronService: stopped');
  }
}

export default { setSocketIo, start, stop, processExpiredReplies };
