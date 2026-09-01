import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function allowedAppleImage(raw: string) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || !url.hostname.endsWith(".mzstatic.com")) return null;
  return url;
}

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("url");
  const url = raw ? allowedAppleImage(raw) : null;
  if (!url) return NextResponse.json({ ok: false, error: "Unsupported Apple image URL." }, { status: 400 });

  try {
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
    if (!response.ok) return NextResponse.json({ ok: false, error: `Image request failed with HTTP ${response.status}.` }, { status: 502 });
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > 15 * 1024 * 1024) return NextResponse.json({ ok: false, error: "Image is too large." }, { status: 413 });
    const contentType = response.headers.get("content-type") || "image/jpeg";
    if (!contentType.startsWith("image/")) return NextResponse.json({ ok: false, error: "Apple returned a non-image response." }, { status: 502 });
    return new NextResponse(bytes, {
      headers: {
        "content-type": contentType,
        "cache-control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Could not proxy the Apple image." }, { status: 502 });
  }
}
