/**
 * IPFS service backed by Pinata.
 *
 * Pinata exposes a simple REST endpoint:
 *   POST https://api.pinata.cloud/pinning/pinFileToIPFS
 *     Authorization: Bearer <JWT>
 *     Content-Type: multipart/form-data
 *     body: { file: <binary> }
 *   → { IpfsHash: "<CID>", PinSize: 123, Timestamp: "..." }
 *
 * We keep the public surface of this module identical to the previous
 * nft.storage-backed version (`uploadJSON`, `uploadFile`, `gatewayUrl`)
 * so the rest of the codebase doesn't need to change.
 */

import config from '../config';
import logger from '../utils/logger';

const PINATA_PIN_ENDPOINT = 'https://api.pinata.cloud/pinning/pinFileToIPFS';

interface PinataPinResponse {
  IpfsHash?: string;
  PinSize?: number;
  Timestamp?: string;
}

function decodeBase64(input: Buffer | string): Buffer {
  if (Buffer.isBuffer(input)) return input;
  if (typeof input !== 'string') {
    throw new Error('expected base64 string or Buffer');
  }
  // Strip a "data:...;base64," prefix if present.
  const idx = input.indexOf('base64,');
  const stripped = idx >= 0 ? input.slice(idx + 'base64,'.length) : input;
  return Buffer.from(stripped, 'base64');
}

/** Low-level: send a Blob to Pinata and return its CID. */
async function pinBlob(blob: Blob, fileName: string): Promise<string> {
  if (!config.ipfs.pinataJwt) {
    throw new Error('PINATA_JWT is not configured');
  }

  const form = new FormData();
  form.append('file', blob, fileName);

  const res = await fetch(PINATA_PIN_ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.ipfs.pinataJwt}` },
    body: form,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `Pinata upload failed (${res.status} ${res.statusText}): ${text.slice(0, 500)}`
    );
  }

  const data = (await res.json()) as PinataPinResponse;
  if (!data.IpfsHash) {
    throw new Error('Pinata response missing IpfsHash');
  }
  return data.IpfsHash;
}

/** Upload a JSON-serializable object to IPFS. */
export async function uploadJSON(obj: unknown): Promise<string> {
  const blob = new Blob([JSON.stringify(obj)], { type: 'application/json' });
  const cid = await pinBlob(blob, 'data.json');
  logger.debug(`ipfsService: uploaded JSON → ${cid}`);
  return cid;
}

export interface UploadFileParams {
  data: Buffer | string;
  name?: string;
  mimeType?: string;
}

/** Upload a binary file (image, video, …) to IPFS. */
export async function uploadFile({
  data,
  name = 'file.bin',
  mimeType = 'application/octet-stream',
}: UploadFileParams): Promise<string> {
  const buf = decodeBase64(data);
  const blob = new Blob([buf], { type: mimeType });
  const cid = await pinBlob(blob, name);
  logger.debug(`ipfsService: uploaded file ${name} (${buf.length}B) → ${cid}`);
  return cid;
}

/** Best-effort gateway URL helper for clients. */
export function gatewayUrl(cid: string | null | undefined): string | null {
  if (!cid) return null;
  return `https://gateway.pinata.cloud/ipfs/${cid}`;
}

export default { uploadJSON, uploadFile, gatewayUrl };
