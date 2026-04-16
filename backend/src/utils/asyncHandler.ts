import type { NextFunction, Request, Response, RequestHandler } from 'express';

export type AsyncHandler<Req extends Request = Request, Res extends Response = Response> = (
  req: Req,
  res: Res,
  next: NextFunction
) => Promise<unknown>;

/**
 * Wraps an async route handler so thrown errors propagate to Express
 * error middleware instead of crashing the process.
 */
const asyncHandler =
  <Req extends Request = Request, Res extends Response = Response>(
    fn: AsyncHandler<Req, Res>
  ): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req as Req, res as Res, next)).catch(next);
  };

export default asyncHandler;
