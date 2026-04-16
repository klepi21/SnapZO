import { ethers } from 'ethers';
import { badRequest } from './errors';

export const isAddress = (v: unknown): v is string =>
  typeof v === 'string' && ethers.isAddress(v);

/** Normalizes an EVM address to checksum format or throws 400. */
export function requireAddress(value: unknown, fieldName: string): string {
  if (!isAddress(value)) {
    throw badRequest(`${fieldName} must be a valid EVM address`);
  }
  return ethers.getAddress(value);
}

export interface RequireStringOptions {
  max?: number;
  allowEmpty?: boolean;
}

export function requireString(
  value: unknown,
  fieldName: string,
  { max = 10_000, allowEmpty = false }: RequireStringOptions = {}
): string {
  if (typeof value !== 'string') {
    throw badRequest(`${fieldName} must be a string`);
  }
  if (!allowEmpty && value.trim() === '') {
    throw badRequest(`${fieldName} must not be empty`);
  }
  if (value.length > max) {
    throw badRequest(`${fieldName} must be at most ${max} characters`);
  }
  return value;
}

export function requirePositiveNumber(value: unknown, fieldName: string): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    throw badRequest(`${fieldName} must be a positive number`);
  }
  return n;
}

export function requireTxHash(value: unknown, fieldName = 'txHash'): string {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw badRequest(`${fieldName} must be a 0x-prefixed 32-byte hex hash`);
  }
  return value.toLowerCase();
}
