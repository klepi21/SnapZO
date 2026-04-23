import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MEZO_VAULTS_URL = "https://api.testnet.mezo.org/earn/vaults";
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36";

export async function GET() {
  try {
    const upstream = await fetch(MEZO_VAULTS_URL, {
      method: "GET",
      headers: {
        accept: "*/*",
        "accept-language": "en-US,en;q=0.8",
        origin: "https://testnet.mezo.org",
        referer: "https://testnet.mezo.org/",
        "user-agent": BROWSER_UA,
      },
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
