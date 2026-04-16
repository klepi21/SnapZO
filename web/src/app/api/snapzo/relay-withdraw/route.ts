import { NextResponse } from "next/server";
import { createWalletClient, http, isAddress, isHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { mezoTestnet } from "@/lib/chains/mezo-testnet";
import { snapZoHubAbi } from "@/lib/constants/snapzo-hub";
import { normalizeRelayerPrivateKey } from "@/lib/snapzo/relayer-key";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const hub = process.env.NEXT_PUBLIC_SNAPZO_HUB_ADDRESS;
  if (!hub || !isAddress(hub)) {
    return NextResponse.json({ error: "NEXT_PUBLIC_SNAPZO_HUB_ADDRESS not set" }, { status: 503 });
  }

  const pk = normalizeRelayerPrivateKey(process.env.RELAYER_PRIVATE_KEY);
  if (!pk) {
    return NextResponse.json(
      {
        error:
          "RELAYER_PRIVATE_KEY missing or invalid. Add to web/.env.local (never NEXT_PUBLIC_*).",
      },
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
  const user = b.user;
  const snapAmount = b.snapAmount;
  const nonce = b.nonce;
  const deadline = b.deadline;
  const signature = b.signature;

  if (typeof user !== "string" || !isAddress(user)) {
    return NextResponse.json({ error: "Invalid user" }, { status: 400 });
  }
  if (typeof signature !== "string" || !isHex(signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }
  if (
    typeof snapAmount !== "string" ||
    typeof nonce !== "string" ||
    typeof deadline !== "string"
  ) {
    return NextResponse.json({ error: "Missing snapAmount, nonce, or deadline" }, { status: 400 });
  }

  let snapBi: bigint;
  let nonceBi: bigint;
  let deadlineBi: bigint;
  try {
    snapBi = BigInt(snapAmount);
    nonceBi = BigInt(nonce);
    deadlineBi = BigInt(deadline);
  } catch {
    return NextResponse.json({ error: "Invalid numeric fields" }, { status: 400 });
  }

  if (snapBi <= BigInt(0)) {
    return NextResponse.json({ error: "snapAmount must be positive" }, { status: 400 });
  }

  const now = BigInt(Math.floor(Date.now() / 1000));
  if (deadlineBi <= now) {
    return NextResponse.json({ error: "Deadline expired" }, { status: 400 });
  }

  const account = privateKeyToAccount(pk);
  const client = createWalletClient({
    account,
    chain: mezoTestnet,
    transport: http(mezoTestnet.rpcUrls.default.http[0]),
  });

  const hash = await client.writeContract({
    address: hub,
    abi: snapZoHubAbi,
    functionName: "withdrawWithSig",
    args: [user, snapBi, nonceBi, deadlineBi, signature],
  });

  return NextResponse.json({ hash });
}
