import { NextResponse } from "next/server";
import { createPublicClient, createWalletClient, http, isAddress, isHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { mezoTestnet } from "@/lib/chains/mezo-testnet";
import { SNAPZO_SUBSCRIPTIONS_ADDRESS } from "@/lib/constants/snapzo-hub";
import { normalizeRelayerPrivateKey } from "@/lib/snapzo/relayer-key";

const snapZoSubscriptionsAbi = [
  {
    type: "function",
    name: "isRelayer",
    stateMutability: "view",
    inputs: [{ name: "a", type: "address" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "subscribeWithSig",
    stateMutability: "nonpayable",
    inputs: [
      { name: "subscriber", type: "address" },
      { name: "creator", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "nonce", type: "uint256" },
      { name: "deadline", type: "uint256" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "nonces",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!SNAPZO_SUBSCRIPTIONS_ADDRESS || !isAddress(SNAPZO_SUBSCRIPTIONS_ADDRESS)) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_SNAPZO_SUBSCRIPTIONS_ADDRESS not set" },
      { status: 503 },
    );
  }

  const pk = normalizeRelayerPrivateKey(process.env.RELAYER_PRIVATE_KEY);
  if (!pk) {
    return NextResponse.json(
      { error: "RELAYER_PRIVATE_KEY missing or invalid. Add to web/.env.local." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const subscriber = b.subscriber;
  const creator = b.creator;
  const amount = b.amount;
  const nonce = b.nonce;
  const deadline = b.deadline;
  const signature = b.signature;

  if (typeof subscriber !== "string" || !isAddress(subscriber))
    return NextResponse.json({ error: "Invalid subscriber" }, { status: 400 });
  if (typeof creator !== "string" || !isAddress(creator))
    return NextResponse.json({ error: "Invalid creator" }, { status: 400 });
  if (subscriber.toLowerCase() === creator.toLowerCase()) {
    return NextResponse.json({ error: "Self-subscribe is not allowed" }, { status: 400 });
  }
  if (typeof signature !== "string" || !isHex(signature))
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  if (
    typeof amount !== "string" ||
    typeof nonce !== "string" ||
    typeof deadline !== "string"
  )
    return NextResponse.json(
      { error: "Missing amount, nonce, or deadline" },
      { status: 400 },
    );

  const amountBi = BigInt(amount);
  const nonceBi = BigInt(nonce);
  const deadlineBi = BigInt(deadline);

  const transport = http(mezoTestnet.rpcUrls.default.http[0]);
  const publicClient = createPublicClient({ chain: mezoTestnet, transport });
  const account = privateKeyToAccount(pk);
  const client = createWalletClient({ account, chain: mezoTestnet, transport });

  const relayerAllowed = await publicClient
    .readContract({
      address: SNAPZO_SUBSCRIPTIONS_ADDRESS,
      abi: snapZoSubscriptionsAbi,
      functionName: "isRelayer",
      args: [account.address],
    })
    .catch(() => false);
  if (!relayerAllowed) {
    return NextResponse.json(
      {
        error: `Relayer ${account.address} is not allowlisted in SnapZoSubscriptions. Add it via setRelayer(address,true).`,
      },
      { status: 403 },
    );
  }

  let gas: bigint;
  try {
    const est = await publicClient.estimateContractGas({
      address: SNAPZO_SUBSCRIPTIONS_ADDRESS,
      abi: snapZoSubscriptionsAbi,
      functionName: "subscribeWithSig",
      args: [
        subscriber as `0x${string}`,
        creator as `0x${string}`,
        amountBi,
        nonceBi,
        deadlineBi,
        signature as `0x${string}`,
      ],
      account: account.address,
    });
    gas = est + (est * BigInt(30)) / BigInt(100);
  } catch {
    gas = BigInt(450_000);
  }

  try {
    const hash = await client.writeContract({
      address: SNAPZO_SUBSCRIPTIONS_ADDRESS,
      abi: snapZoSubscriptionsAbi,
      functionName: "subscribeWithSig",
      args: [
        subscriber as `0x${string}`,
        creator as `0x${string}`,
        amountBi,
        nonceBi,
        deadlineBi,
        signature as `0x${string}`,
      ],
      gas,
    });
    return NextResponse.json({ hash });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Relay subscriptions transaction failed";
    if (message.includes("0xcf32f3c2") || message.includes("SnapZoSubscriptions__BadNonce")) {
      const latestNonce = await publicClient
        .readContract({
          address: SNAPZO_SUBSCRIPTIONS_ADDRESS,
          abi: snapZoSubscriptionsAbi,
          functionName: "nonces",
          args: [subscriber as `0x${string}`],
        })
        .catch(() => undefined);
      return NextResponse.json(
        {
          error: "Bad nonce. Please sign again with the latest subscriptions nonce.",
          code: "BAD_NONCE",
          latestNonce: latestNonce !== undefined ? String(latestNonce) : undefined,
        },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
