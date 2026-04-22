import { NextResponse } from "next/server";
import { createPublicClient, createWalletClient, http, isAddress, isHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { mezoTestnet } from "@/lib/chains/mezo-testnet";
import { SNAPZO_SOCIAL_ADDRESS } from "@/lib/constants/snapzo-hub";
import { normalizeRelayerPrivateKey } from "@/lib/snapzo/relayer-key";

const snapZoSocialReplyAbi = [
  {
    type: "function",
    name: "isRelayer",
    stateMutability: "view",
    inputs: [{ name: "a", type: "address" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "replyDepositWithSig",
    stateMutability: "nonpayable",
    inputs: [
      { name: "payer", type: "address" },
      { name: "postId", type: "uint256" },
      { name: "creator", type: "address" },
      { name: "nonce", type: "uint256" },
      { name: "deadline", type: "uint256" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
  },
] as const;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!SNAPZO_SOCIAL_ADDRESS || !isAddress(SNAPZO_SOCIAL_ADDRESS)) {
    return NextResponse.json({ error: "NEXT_PUBLIC_SNAPZO_SOCIAL_ADDRESS not set" }, { status: 503 });
  }

  const pk = normalizeRelayerPrivateKey(process.env.RELAYER_PRIVATE_KEY);
  if (!pk) {
    return NextResponse.json(
      { error: "RELAYER_PRIVATE_KEY missing or invalid. Add to web/.env.local." },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  const payer = b.payer;
  const postId = b.postId;
  const creator = b.creator;
  const nonce = b.nonce;
  const deadline = b.deadline;
  const signature = b.signature;

  if (typeof payer !== "string" || !isAddress(payer))
    return NextResponse.json({ error: "Invalid payer" }, { status: 400 });
  if (typeof creator !== "string" || !isAddress(creator))
    return NextResponse.json({ error: "Invalid creator" }, { status: 400 });
  if (payer.toLowerCase() === creator.toLowerCase()) {
    return NextResponse.json({ error: "Self-reply request is not allowed" }, { status: 400 });
  }
  if (typeof signature !== "string" || !isHex(signature))
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  if (typeof postId !== "string" || typeof nonce !== "string" || typeof deadline !== "string")
    return NextResponse.json({ error: "Missing postId, nonce, or deadline" }, { status: 400 });

  const postIdBi = BigInt(postId);
  const nonceBi = BigInt(nonce);
  const deadlineBi = BigInt(deadline);

  const transport = http(mezoTestnet.rpcUrls.default.http[0]);
  const publicClient = createPublicClient({ chain: mezoTestnet, transport });
  const account = privateKeyToAccount(pk);
  const client = createWalletClient({ account, chain: mezoTestnet, transport });

  const relayerAllowed = await publicClient
    .readContract({
      address: SNAPZO_SOCIAL_ADDRESS,
      abi: snapZoSocialReplyAbi,
      functionName: "isRelayer",
      args: [account.address],
    })
    .catch(() => false);
  if (!relayerAllowed) {
    return NextResponse.json(
      {
        error: `Relayer ${account.address} is not allowlisted in SnapZoSocial. Add it via setRelayer(address,true).`,
      },
      { status: 403 }
    );
  }

  let gas: bigint;
  try {
    const est = await publicClient.estimateContractGas({
      address: SNAPZO_SOCIAL_ADDRESS,
      abi: snapZoSocialReplyAbi,
      functionName: "replyDepositWithSig",
      args: [
        payer as `0x${string}`,
        postIdBi,
        creator as `0x${string}`,
        nonceBi,
        deadlineBi,
        signature as `0x${string}`,
      ],
      account: account.address,
    });
    gas = est + (est * BigInt(30)) / BigInt(100);
  } catch {
    gas = BigInt(500_000);
  }

  const hash = await client.writeContract({
    address: SNAPZO_SOCIAL_ADDRESS,
    abi: snapZoSocialReplyAbi,
    functionName: "replyDepositWithSig",
    args: [
      payer as `0x${string}`,
      postIdBi,
      creator as `0x${string}`,
      nonceBi,
      deadlineBi,
      signature as `0x${string}`,
    ],
    gas,
  });

  return NextResponse.json({ hash });
}
