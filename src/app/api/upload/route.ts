import { NextResponse } from "next/server";
import { saveUploadedDataUrl, UploadedImageError } from "@/lib/uploaded-image-server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json() as { dataUrl?: string };
    if (typeof body.dataUrl !== "string") {
      return NextResponse.json({ ok: false, error: "Missing dataUrl" }, { status: 400 });
    }
    return NextResponse.json({ ok: true, path: await saveUploadedDataUrl(body.dataUrl) });
  } catch (error) {
    if (error instanceof UploadedImageError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Invalid JSON" },
      { status: 400 },
    );
  }
}
