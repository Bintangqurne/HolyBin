// app/api/verify-code/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyCode } from "@/services/pickup.service";

export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json();

    if (!code) {
      return NextResponse.json({ error: "code is required" }, { status: 400 });
    }

    const result = await verifyCode(code);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
