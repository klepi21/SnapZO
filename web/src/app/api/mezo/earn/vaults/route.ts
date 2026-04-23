import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MEZO_VAULTS_URL = "https://api.testnet.mezo.org/earn/vaults";

export async function GET() {
  try {
    const upstream = await fetch(MEZO_VAULTS_URL, {
      method: "GET",
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    if (!upstream.ok) {
      const body = await upstream.text().catch(() => "");
      return NextResponse.json(
        {
          success: false,
          data: [],
          error: `Upstream failed (${upstream.status})`,
          details: body || upstream.statusText,
        },
        { status: 200 },
      );
    }
    const json = (await upstream.json()) as unknown;
    return NextResponse.json(json, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        success: false,
        data: [],
        error: "Failed to fetch Mezo vaults",
        details: message,
      },
      { status: 200 },
    );
  }
}
