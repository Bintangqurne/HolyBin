// app/api/generate-code/route.ts
import { NextRequest, NextResponse } from "next/server";
import { generateCode } from "@/services/pickup.service";

export async function POST(req: NextRequest) {
  try {
    const { binId, binLocation, hoursValid } = await req.json();

    if (!binId || !binLocation) {
      return NextResponse.json({ error: "binId and binLocation are required" }, { status: 400 });
    }

    const code = await generateCode(binId, binLocation, hoursValid ?? 24);
    return NextResponse.json({ success: true, data: code });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
