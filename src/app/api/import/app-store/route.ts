import { NextResponse } from "next/server";
import { AppStoreImportError, fetchAppStoreCampaign } from "@/lib/app-store-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }
  const url = typeof (body as { url?: unknown })?.url === "string" ? (body as { url: string }).url : "";
  if (!url.trim()) return NextResponse.json({ ok: false, error: "Add an App Store URL." }, { status: 400 });

  try {
    const result = await fetchAppStoreCampaign(url);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof AppStoreImportError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "App Store import failed.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
