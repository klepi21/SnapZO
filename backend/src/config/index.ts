/**
 * Central configuration loader.
 * Reads from process.env (populated by dotenv in server.ts) and exposes
 * a typed object to the rest of the backend.
 */

const required = (name: string, fallback?: string): string => {
  const value = process.env[name];
  if (value === undefined || value === '') {
    if (fallback !== undefined) return fallback;
    return '';
  }
  return value;
};

const toInt = (v: string | undefined, def: number): number => {
  if (v === undefined) return def;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : def;
};

export interface ChainConfig {
  rpcUrl: string;
  chainId: number;
  musdAddress: string;
  musdDecimals: number;
  escrowAddress: string;
  escrowPrivateKey: string;
  hubContractAddress: string;
  minConfirmations: number;
}

export interface IpfsConfig {
  pinataJwt: string;
}

export interface ReplyConfig {
  windowHours: number;
  refundCron: string;
}

export interface AppConfig {
  env: string;
  port: number;
  corsOrigin: string;
  mongoUri: string;
  chain: ChainConfig;
  ipfs: IpfsConfig;
  reply: ReplyConfig;
}

const config: AppConfig = {
  env: required('NODE_ENV', 'development'),
  port: toInt(process.env.PORT, 4000),
  corsOrigin: required('CORS_ORIGIN', '*'),

  mongoUri: required('MONGO_URI', 'mongodb://127.0.0.1:27017/snapzo'),

  chain: {
    rpcUrl: required('RPC_URL', 'https://rpc.test.mezo.org'),
    chainId: toInt(process.env.CHAIN_ID, 31611),
    musdAddress: required('MUSD_TOKEN_ADDRESS', ''),
    musdDecimals: toInt(process.env.MUSD_DECIMALS, 18),
    escrowAddress: required('ESCROW_WALLET_ADDRESS', ''),
    escrowPrivateKey: required('ESCROW_PRIVATE_KEY', ''),
    hubContractAddress: required('HUB_CONTRACT_ADDRESS', ''),
    minConfirmations: toInt(process.env.TX_MIN_CONFIRMATIONS, 1),
  },

  ipfs: {
    pinataJwt: required('PINATA_JWT', ''),
  },

  reply: {
    windowHours: toInt(process.env.REPLY_WINDOW_HOURS, 24),
    refundCron: required('REFUND_CRON_SCHEDULE', '*/5 * * * *'),
  },
};

export default config;
