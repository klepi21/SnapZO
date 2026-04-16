import type { ErrorRequestHandler } from 'express';

export class HttpError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.details = details;
  }
}

export const badRequest = (msg: string, details?: unknown): HttpError =>
  new HttpError(400, msg, details);
export const notFound = (msg = 'Not found'): HttpError => new HttpError(404, msg);
export const conflict = (msg = 'Conflict'): HttpError => new HttpError(409, msg);
export const unprocessable = (msg: string, details?: unknown): HttpError =>
  new HttpError(422, msg, details);
export const serverError = (msg = 'Internal server error', details?: unknown): HttpError =>
  new HttpError(500, msg, details);

interface ErrorPayload {
  error: string;
  details?: unknown;
}

/** Express error-handling middleware. */
export const errorMiddleware: ErrorRequestHandler = (err, _req, res, _next) => {
  const httpErr = err as Partial<HttpError> & Error;
  const status = httpErr.status ?? 500;
  const payload: ErrorPayload = {
    error: httpErr.message || 'Unknown error',
  };
  if (httpErr.details !== undefined) payload.details = httpErr.details;
  if (status >= 500) {
    // eslint-disable-next-line no-console
    console.error('[ERROR]', err);
  }
  res.status(status).json(payload);
};
