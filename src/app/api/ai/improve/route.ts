import { NextResponse } from "next/server";
import { AiServiceError, requestAiProposal } from "@/lib/ai-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  try {
    const proposal = await requestAiProposal(body);
    return NextResponse.json({ ok: true, proposal });
  } catch (error) {
    if (error instanceof AiServiceError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    return NextResponse.json({ ok: false, error: "AI improvement failed." }, { status: 500 });
  }
}
