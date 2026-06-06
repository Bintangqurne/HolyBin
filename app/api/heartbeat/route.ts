import { NextRequest, NextResponse } from "next/server";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import fs from "fs";
import path from "path";

function getAdminDb() {
  if (!getApps().length) {
    const keyPath = path.join(process.cwd(), "scripts", "serviceAccountKey.json");
    const serviceAccount = JSON.parse(fs.readFileSync(keyPath, "utf-8"));
    initializeApp({ credential: cert(serviceAccount) });
  }
  return getFirestore();
}

export async function POST(req: NextRequest) {
  const token = req.headers.get("x-scanner-token");
  if (!token || token !== process.env.SCANNER_API_TOKEN) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: { binCode?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 }); }

  const { binCode } = body;
  if (!binCode) return NextResponse.json({ ok: false, error: "binCode wajib diisi" }, { status: 400 });

  try {
    const db = getAdminDb();
    const snap = await db.collection("bins")
      .where("code", "==", binCode.toUpperCase().trim())
      .limit(1).get();

    if (snap.empty) return NextResponse.json({ ok: false, error: "Bin tidak ditemukan" }, { status: 404 });

    await snap.docs[0].ref.update({ lastSeenAt: Timestamp.now() });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
