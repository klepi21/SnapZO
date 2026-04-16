import 'dotenv/config';

import http from 'http';
import express, { type Request, type Response } from 'express';
import cors from 'cors';
import { Server as SocketIOServer, type Socket } from 'socket.io';
import swaggerUi from 'swagger-ui-express';

import config from './src/config';
import logger from './src/utils/logger';
import { connectDB, mongoose } from './src/config/db';
import swaggerSpec from './src/swagger';
import { errorMiddleware } from './src/utils/errors';

import * as web3Service from './src/services/web3Service';
import * as cronService from './src/services/cronService';

import healthRoutes from './src/routes/health';
import postsRoutes from './src/routes/posts';
import feedRoutes from './src/routes/feed';
import unlockRoutes from './src/routes/unlock';
import tipRoutes from './src/routes/tip';
import replyRoutes from './src/routes/reply';
import userRoutes from './src/routes/user';

const app = express();
const httpServer = http.createServer(app);

// ---- socket.io -------------------------------------------------------------
const io = new SocketIOServer(httpServer, {
  cors: { origin: config.corsOrigin, credentials: true },
});
app.set('io', io);

io.on('connection', (socket: Socket) => {
  logger.debug(`socket connected ${socket.id}`);

  socket.on('subscribe:creator', (wallet: unknown) => {
    if (typeof wallet !== 'string') return;
    socket.join(`creator:${wallet.toLowerCase()}`);
  });
  socket.on('unsubscribe:creator', (wallet: unknown) => {
    if (typeof wallet !== 'string') return;
    socket.leave(`creator:${wallet.toLowerCase()}`);
  });

  socket.on('subscribe:requester', (wallet: unknown) => {
    if (typeof wallet !== 'string') return;
    socket.join(`requester:${wallet.toLowerCase()}`);
  });
  socket.on('unsubscribe:requester', (wallet: unknown) => {
    if (typeof wallet !== 'string') return;
    socket.leave(`requester:${wallet.toLowerCase()}`);
  });

  socket.on('subscribe:post', (postId: unknown) => {
    if (typeof postId !== 'string') return;
    socket.join(`post:${postId}`);
  });
  socket.on('unsubscribe:post', (postId: unknown) => {
    if (typeof postId !== 'string') return;
    socket.leave(`post:${postId}`);
  });

  socket.on('disconnect', () => logger.debug(`socket disconnected ${socket.id}`));
});

// Hand the io instance to services that emit events from outside HTTP context.
web3Service.setSocketIo(io);
cronService.setSocketIo(io);

// ---- Express middleware ----------------------------------------------------
app.use(
  cors({
    origin:
      config.corsOrigin === '*'
        ? true
        : config.corsOrigin.split(',').map((s) => s.trim()),
    credentials: true,
  })
);
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

app.use((req: Request, _res: Response, next) => {
  logger.debug(`${req.method} ${req.originalUrl}`);
  next();
});

// ---- Routes ----------------------------------------------------------------
app.get('/', (_req: Request, res: Response) =>
  res.json({
    name: 'SnapZO Backend',
    version: '1.0.0',
    docs: '/api-docs',
    health: '/api/health',
  })
);

app.use('/api/health', healthRoutes);
app.use('/api/posts', postsRoutes);
app.use('/api/feed', feedRoutes);
app.use('/api/unlock', unlockRoutes);
app.use('/api/tip', tipRoutes);
app.use('/api/reply', replyRoutes);
app.use('/api/user', userRoutes);

// ---- Swagger UI ------------------------------------------------------------
app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customSiteTitle: 'SnapZO Backend API',
    swaggerOptions: { persistAuthorization: true },
  })
);
app.get('/api-docs.json', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// ---- 404 + error handler ---------------------------------------------------
app.use((req: Request, res: Response) =>
  res.status(404).json({ error: `Not found: ${req.method} ${req.originalUrl}` })
);
app.use(errorMiddleware);

// ---- Bootstrap -------------------------------------------------------------
async function start(): Promise<void> {
  await connectDB();

  try {
    web3Service.init();
    web3Service.startListeners();
  } catch (err) {
    logger.error('web3 init failed', (err as Error).message);
  }

  cronService.start();

  httpServer.listen(config.port, () => {
    logger.info(`SnapZO backend listening on http://localhost:${config.port}`);
    logger.info(`Swagger UI    → http://localhost:${config.port}/api-docs`);
    logger.info(`Health        → http://localhost:${config.port}/api/health`);
  });
}

// ---- Graceful shutdown -----------------------------------------------------
async function shutdown(signal: string): Promise<void> {
  logger.info(`received ${signal}, shutting down`);
  cronService.stop();
  try {
    await web3Service.stopListeners();
  } catch (err) {
    logger.warn('web3 listener stop error', (err as Error).message);
  }
  io.close();
  httpServer.close(async () => {
    try {
      await mongoose.disconnect();
    } catch {
      // ignore
    }
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('unhandledRejection', (err) => logger.error('unhandledRejection', err));
process.on('uncaughtException', (err) => logger.error('uncaughtException', err));

start().catch((err: unknown) => {
  logger.error('fatal startup error', err);
  process.exit(1);
});
