// app/api/pickup/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getPickupHistory } from "@/services/pickup.service";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") ?? "50");
    const history = await getPickupHistory(limit);
    return NextResponse.json({ success: true, data: history });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
