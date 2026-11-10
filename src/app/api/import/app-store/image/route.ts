import { NextResponse } from "next/server";
import { AppStoreImportError, appleImageUrl, fetchAppleImage } from "@/lib/app-store-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("url");
  const url = raw ? appleImageUrl(raw) : null;
  if (!url) return NextResponse.json({ ok: false, error: "Unsupported Apple image URL." }, { status: 400 });

  try {
    const { buffer, contentType } = await fetchAppleImage(url.toString());
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "content-type": contentType,
        "cache-control": "private, max-age=3600",
        // The bytes come from a third party; never let a browser treat them as
        // a document on this origin.
        "x-content-type-options": "nosniff",
        "content-security-policy": "default-src 'none'; sandbox",
      },
    });
  } catch (error) {
    if (error instanceof AppStoreImportError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    return NextResponse.json({ ok: false, error: "Could not proxy the Apple image." }, { status: 502 });
  }
}
