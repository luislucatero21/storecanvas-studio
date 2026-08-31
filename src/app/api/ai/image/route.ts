import { NextResponse } from "next/server";
import { ArtworkImageError, requestArtworkImage } from "@/lib/artwork-ai-server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
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
