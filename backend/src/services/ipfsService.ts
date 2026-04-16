/**
 * IPFS service backed by nft.storage.
 *
 * Exposes:
 *   - uploadJSON(obj)   → CID
 *   - uploadFile({ data, name, mimeType }) → CID
 *
 * Inputs are buffers / base64 strings (never raw filesystem paths) so the
 * controllers stay platform-independent.
 */

// nft.storage's typings don't always match latest Node Blob/File globals,
// so we import then use loose typing where needed.
import { NFTStorage, File, Blob } from 'nft.storage';
import config from '../config';
import logger from '../utils/logger';

let client: NFTStorage | null = null;

function getClient(): NFTStorage {
  if (client) return client;
  if (!config.ipfs.nftStorageToken) {
    throw new Error('NFT_STORAGE_TOKEN is not configured');
  }
  client = new NFTStorage({ token: config.ipfs.nftStorageToken });
  return client;
}

function decodeBase64(input: Buffer | string): Buffer {
  if (Buffer.isBuffer(input)) return input;
  if (typeof input !== 'string') {
    throw new Error('expected base64 string or Buffer');
  }
  // Strip "data:...;base64," prefix if present.
  const idx = input.indexOf('base64,');
  const stripped = idx >= 0 ? input.slice(idx + 'base64,'.length) : input;
  return Buffer.from(stripped, 'base64');
}

/** Upload a JSON-serializable object as a file to IPFS. */
export async function uploadJSON(obj: unknown): Promise<string> {
  const c = getClient();
  const blob = new Blob([JSON.stringify(obj)], { type: 'application/json' });
  const cid = await c.storeBlob(blob as unknown as Blob);
  logger.debug(`ipfsService: uploaded JSON → ${cid}`);
  return cid;
}

export interface UploadFileParams {
  data: Buffer | string;
  name?: string;
  mimeType?: string;
}

/** Upload a file (image, video, etc.) to IPFS. */
export async function uploadFile({
  data,
  name = 'file.bin',
  mimeType = 'application/octet-stream',
}: UploadFileParams): Promise<string> {
  const c = getClient();
  const buf = decodeBase64(data);
  const file = new File([buf], name, { type: mimeType });
  const cid = await c.storeBlob(file as unknown as Blob);
  logger.debug(`ipfsService: uploaded file ${name} (${buf.length}B) → ${cid}`);
  return cid;
}

/** Best-effort gateway URL helper for clients. */
export function gatewayUrl(cid: string | null | undefined): string | null {
  if (!cid) return null;
  return `https://${cid}.ipfs.nftstorage.link`;
}

export default { uploadJSON, uploadFile, gatewayUrl };
