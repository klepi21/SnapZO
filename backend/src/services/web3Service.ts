/**
 * Web3 service — talks to the Mezo testnet (EVM) via ethers.js v6.
 *
 * Responsibilities:
 *   1. Verify on-chain MUSD ERC-20 transfers given a txHash, expected from,
 *      expected to, and expected amount.
 *   2. Send refund transfers from the backend escrow wallet.
 *   3. Listen to MUSD Transfer events involving the escrow address (and,
 *      optionally, a hub contract) and broadcast them via socket.io.
 */

import { ethers, type JsonRpcProvider, type Wallet, type Contract } from 'ethers';

// In ethers v6, contract event listeners receive `(...args, payload)` where
// `payload` is a `ContractEventPayload` whose `.log` is an `EventLog`. We
// type the payload loosely here because the ABI is provided as a string
// array (no codegen) and the public type unions are awkward to spell out.
interface EthersContractEventPayload {
  log: { transactionHash: string; blockNumber: number };
}
import type { Server as SocketIOServer } from 'socket.io';
import config from '../config';
import logger from '../utils/logger';

// Minimal MUSD ERC-20 ABI we need.
const MUSD_ABI = [
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
];

// Optional hub contract ABI (only the events we care about).
const HUB_ABI = [
  'event PostUnlocked(bytes32 indexed postId, address indexed user, uint256 amount)',
  'event PostTipped(bytes32 indexed postId, address indexed from, uint256 amount)',
  'event ReplyRequested(bytes32 indexed postId, address indexed requester, uint256 amount, uint256 deadline)',
  'event ReplyResponded(bytes32 indexed postId, address indexed creator)',
  'event ReplyRefunded(bytes32 indexed postId, address indexed requester, uint256 amount)',
];

const TRANSFER_TOPIC = ethers.id('Transfer(address,address,uint256)');
const SOCIAL_TIP_TOPIC = ethers.id('Tip(address,address,uint256,uint256,address)');

let provider: JsonRpcProvider | null = null;
let escrowWallet: Wallet | null = null;
let musdContract: Contract | null = null;
let hubContract: Contract | null = null;
let ioRef: SocketIOServer | null = null;

export interface VerifyMusdTransferParams {
  txHash: string;
  from: string;
  to: string;
  amount: number;
}

export interface VerifyMusdTransferResult {
  from: string;
  to: string;
  value: bigint;
  blockNumber: number;
}

export interface SendMusdRefundParams {
  to: string;
  amount: number;
}

export interface VerifySocialTipParams {
  txHash: string;
  tipper: string;
  creator: string;
}

/** Initialize the provider + signer + contracts. Idempotent. */
export function init(): void {
  if (provider) return;

  if (!config.chain.rpcUrl) {
    logger.warn('web3Service: RPC_URL not set, on-chain features disabled');
    return;
  }

  provider = new ethers.JsonRpcProvider(config.chain.rpcUrl, {
    chainId: config.chain.chainId,
    name: `mezo-${config.chain.chainId}`,
  });

  if (config.chain.escrowPrivateKey) {
    try {
      escrowWallet = new ethers.Wallet(config.chain.escrowPrivateKey, provider);
      logger.info(`web3Service: escrow wallet loaded ${escrowWallet.address}`);
    } catch (err) {
      logger.error('web3Service: invalid ESCROW_PRIVATE_KEY', (err as Error).message);
    }
  }

  if (config.chain.musdAddress && config.chain.musdAddress !== ethers.ZeroAddress) {
    musdContract = new ethers.Contract(
      config.chain.musdAddress,
      MUSD_ABI,
      escrowWallet ?? provider
    );
  } else {
    logger.warn('web3Service: MUSD_TOKEN_ADDRESS not set');
  }

  if (config.chain.hubContractAddress) {
    hubContract = new ethers.Contract(config.chain.hubContractAddress, HUB_ABI, provider);
  }
}

export function setSocketIo(io: SocketIOServer): void {
  ioRef = io;
}

export function getProvider(): JsonRpcProvider | null {
  init();
  return provider;
}

export function getEscrowAddress(): string {
  init();
  return escrowWallet
    ? escrowWallet.address.toLowerCase()
    : config.chain.escrowAddress.toLowerCase();
}

/** Convert a human MUSD amount (e.g. 0.1) to base units. */
export function musdToWei(amount: number | string): bigint {
  return ethers.parseUnits(String(amount), config.chain.musdDecimals);
}

/** Convert base units to human MUSD amount (number — fine for hackathon scale). */
export function weiToMusd(wei: bigint): number {
  return Number(ethers.formatUnits(wei, config.chain.musdDecimals));
}

/**
 * Verify that a given txHash represents an MUSD transfer matching the
 * provided expectations. Throws on failure; resolves with the parsed
 * transfer event on success.
 */
export async function verifyMusdTransfer(
  params: VerifyMusdTransferParams
): Promise<VerifyMusdTransferResult> {
  init();
  if (!provider) throw new Error('web3 provider not configured');
  if (!config.chain.musdAddress) throw new Error('MUSD address not configured');

  const { txHash, from, to, amount } = params;

  const receipt = await provider.getTransactionReceipt(txHash);
  if (!receipt) throw new Error(`Transaction ${txHash} not found`);
  if (receipt.status !== 1) throw new Error(`Transaction ${txHash} failed on-chain`);

  // Confirmations check.
  const currentBlock = await provider.getBlockNumber();
  const confirmations = currentBlock - receipt.blockNumber + 1;
  if (confirmations < config.chain.minConfirmations) {
    throw new Error(
      `Transaction ${txHash} only has ${confirmations} confirmation(s); need ${config.chain.minConfirmations}`
    );
  }

  const musdAddrLc = config.chain.musdAddress.toLowerCase();
  const fromLc = from.toLowerCase();
  const toLc = to.toLowerCase();
  const expectedValue = musdToWei(amount);

  const matching = receipt.logs.find((log) => {
    if (log.address.toLowerCase() !== musdAddrLc) return false;
    if (!log.topics || log.topics[0] !== TRANSFER_TOPIC) return false;
    const decodedFrom = ethers
      .getAddress('0x' + log.topics[1].slice(26))
      .toLowerCase();
    const decodedTo = ethers
      .getAddress('0x' + log.topics[2].slice(26))
      .toLowerCase();
    const decodedValue = BigInt(log.data);
    return decodedFrom === fromLc && decodedTo === toLc && decodedValue === expectedValue;
  });

  if (!matching) {
    throw new Error(
      `No matching MUSD Transfer found in tx ${txHash} (expected ${amount} from ${from} to ${to})`
    );
  }

  return {
    from: fromLc,
    to: toLc,
    value: expectedValue,
    blockNumber: receipt.blockNumber,
  };
}

/** Verify SnapZoSocial Tip event for expected tipper/creator. */
export async function verifySocialTipEvent(params: VerifySocialTipParams): Promise<void> {
  init();
  if (!provider) throw new Error('web3 provider not configured');
  if (!config.chain.socialContractAddress) throw new Error('SOCIAL_CONTRACT_ADDRESS not configured');

  const receipt = await provider.getTransactionReceipt(params.txHash);
  if (!receipt) throw new Error(`Transaction ${params.txHash} not found`);
  if (receipt.status !== 1) throw new Error(`Transaction ${params.txHash} failed on-chain`);

  const socialAddrLc = config.chain.socialContractAddress.toLowerCase();
  const tipperLc = params.tipper.toLowerCase();
  const creatorLc = params.creator.toLowerCase();
  const found = receipt.logs.find((log) => {
    if (log.address.toLowerCase() !== socialAddrLc) return false;
    if (!log.topics || log.topics[0] !== SOCIAL_TIP_TOPIC || log.topics.length < 3) return false;
    const decodedTipper = ethers.getAddress('0x' + log.topics[1].slice(26)).toLowerCase();
    const decodedCreator = ethers.getAddress('0x' + log.topics[2].slice(26)).toLowerCase();
    return decodedTipper === tipperLc && decodedCreator === creatorLc;
  });
  if (!found) {
    throw new Error(
      `No matching SnapZoSocial Tip event found in tx ${params.txHash} (tipper ${params.tipper}, creator ${params.creator})`
    );
  }
}

/**
 * Send an MUSD refund from the escrow wallet to a user.
 * @returns the refund tx hash
 */
export async function sendMusdRefund(params: SendMusdRefundParams): Promise<string> {
  init();
  if (!escrowWallet) throw new Error('escrow wallet not configured (ESCROW_PRIVATE_KEY)');
  if (!musdContract) throw new Error('MUSD contract not configured');

  const value = musdToWei(params.amount);
  logger.info(`web3Service: refunding ${params.amount} MUSD to ${params.to}`);

  // ethers v6: contract methods live on the contract directly; cast to any
  // because the ABI is provided as a string array (no generated types).
  const tx = await (musdContract as any).transfer(params.to, value);
  logger.info(`web3Service: refund tx submitted ${tx.hash}, awaiting confirmation`);
  await tx.wait(config.chain.minConfirmations);
  return (tx.hash as string).toLowerCase();
}

/** Subscribe to MUSD + optional hub-contract events; rebroadcast via socket.io. */
export function startListeners(): void {
  init();
  if (!provider) {
    logger.warn('web3Service: cannot start listeners (no provider)');
    return;
  }

  if (musdContract) {
    const escrowAddr = getEscrowAddress();
    if (escrowAddr && escrowAddr !== ethers.ZeroAddress.toLowerCase()) {
      void (musdContract as any).on(
        (musdContract as any).filters.Transfer(),
        (from: string, to: string, value: bigint, event: EthersContractEventPayload) => {
          const fromLc = from.toLowerCase();
          const toLc = to.toLowerCase();
          if (fromLc !== escrowAddr && toLc !== escrowAddr) return;
          const payload = {
            type: 'musd_transfer',
            from: fromLc,
            to: toLc,
            amount: weiToMusd(value),
            txHash: event.log.transactionHash,
            blockNumber: event.log.blockNumber,
          };
          logger.debug('web3Service: escrow transfer detected', payload);
          ioRef?.emit('chain:transfer', payload);
        }
      );
      logger.info(`web3Service: listening to MUSD transfers involving ${escrowAddr}`);
    }
  }

  if (hubContract) {
    const hub = hubContract as any;
    hub.on('PostUnlocked', (postId: string, user: string, amount: bigint, event: EthersContractEventPayload) => {
      ioRef?.emit('chain:event', {
        type: 'PostUnlocked',
        postId,
        user: user.toLowerCase(),
        amount: weiToMusd(amount),
        txHash: event.log.transactionHash,
      });
    });
    hub.on('PostTipped', (postId: string, from: string, amount: bigint, event: EthersContractEventPayload) => {
      ioRef?.emit('chain:event', {
        type: 'PostTipped',
        postId,
        from: from.toLowerCase(),
        amount: weiToMusd(amount),
        txHash: event.log.transactionHash,
      });
    });
    hub.on(
      'ReplyRequested',
      (
        postId: string,
        requester: string,
        amount: bigint,
        deadline: bigint,
        event: EthersContractEventPayload
      ) => {
        ioRef?.emit('chain:event', {
          type: 'ReplyRequested',
          postId,
          requester: requester.toLowerCase(),
          amount: weiToMusd(amount),
          deadline: Number(deadline),
          txHash: event.log.transactionHash,
        });
      }
    );
    hub.on('ReplyResponded', (postId: string, creator: string, event: EthersContractEventPayload) => {
      ioRef?.emit('chain:event', {
        type: 'ReplyResponded',
        postId,
        creator: creator.toLowerCase(),
        txHash: event.log.transactionHash,
      });
    });
    hub.on('ReplyRefunded', (postId: string, requester: string, amount: bigint, event: EthersContractEventPayload) => {
      ioRef?.emit('chain:event', {
        type: 'ReplyRefunded',
        postId,
        requester: requester.toLowerCase(),
        amount: weiToMusd(amount),
        txHash: event.log.transactionHash,
      });
    });
    logger.info(`web3Service: listening to hub contract ${config.chain.hubContractAddress}`);
  }
}

/** Tear down listeners (used on graceful shutdown). */
export async function stopListeners(): Promise<void> {
  if (musdContract) await (musdContract as any).removeAllListeners();
  if (hubContract) await (hubContract as any).removeAllListeners();
}

export default {
  init,
  setSocketIo,
  getProvider,
  getEscrowAddress,
  verifyMusdTransfer,
  verifySocialTipEvent,
  sendMusdRefund,
  startListeners,
  stopListeners,
  musdToWei,
  weiToMusd,
};
