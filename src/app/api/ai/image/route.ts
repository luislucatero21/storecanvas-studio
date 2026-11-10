import { NextResponse } from "next/server";
import { ArtworkImageError, requestArtworkImage } from "@/lib/artwork-ai-server";
import { rejectCrossSiteRequest } from "@/lib/request-guard";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const forbidden = rejectCrossSiteRequest(request);
  if (forbidden) return forbidden;
  try {
    const result = await requestArtworkImage(await request.json());
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const known = error instanceof ArtworkImageError;
    return NextResponse.json(
      { ok: false, error: known ? error.message : "Invalid image generation request." },
      { status: known ? error.status : 400 },
    );
  }
}
