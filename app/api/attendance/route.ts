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

  let body: { userCode?: string; binCode?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const { userCode, binCode, scannedAt: scannedAtOverride } = body as { userCode?: string; binCode?: string; scannedAt?: string };
  if (!userCode || !binCode) {
    return NextResponse.json(
      { ok: false, error: "userCode dan binCode wajib diisi" },
      { status: 400 }
    );
  }

  try {
    const db = getAdminDb();
    const cooldownMinutes = parseInt(process.env.COOLDOWN_MINUTES ?? "60", 10);

    const userSnap = await db.collection("users")
      .where("userCode", "==", userCode.toUpperCase().trim())
      .where("isActive", "==", true)
      .limit(1)
      .get();

    if (userSnap.empty) {
      return NextResponse.json(
        { ok: false, error: "Petugas tidak ditemukan atau tidak aktif." },
        { status: 404 }
      );
    }

    const binSnap = await db.collection("bins")
      .where("code", "==", binCode.toUpperCase().trim())
      .where("isActive", "==", true)
      .limit(1)
      .get();

    if (binSnap.empty) {
      return NextResponse.json(
        { ok: false, error: "Bin tidak ditemukan atau tidak aktif." },
        { status: 404 }
      );
    }

    const officer = userSnap.docs[0];
    const bin = binSnap.docs[0];

    // Cek apakah petugas sudah absen di bin yang sama dalam cooldown window
    const cutoffMs = Date.now() - cooldownMinutes * 60 * 1000;
    const recentSnap = await db.collection("attendances")
      .where("userId", "==", officer.id)
      .where("binId", "==", bin.id)
      .limit(50)
      .get();

    const recentDoc = recentSnap.docs
      .map((d) => {
        const scannedAt = d.data().scannedAt instanceof Timestamp
          ? d.data().scannedAt.toDate()
          : new Date(d.data().scannedAt);
        return { scannedAt, id: d.id };
      })
      .filter((d) => d.scannedAt.getTime() > cutoffMs)
      .sort((a, b) => b.scannedAt.getTime() - a.scannedAt.getTime())[0];

    const role = officer.data().role ?? "pemulung";

    if (recentDoc) {
      const minutesAgo = Math.floor((Date.now() - recentDoc.scannedAt.getTime()) / 60000);
      return NextResponse.json({
        ok: true,
        alreadyScanned: true,
        userName: officer.data().name,
        userRole: role,
        binLocation: bin.data().location,
        lastScannedAt: recentDoc.scannedAt.toISOString(),
        minutesAgo,
      });
    }

    // Belum absen dalam cooldown — insert baru
    const scannedAt = scannedAtOverride
      ? Timestamp.fromDate(new Date(scannedAtOverride))
      : Timestamp.now();

    const ref = await db.collection("attendances").add({
      userId: officer.id,
      userCode: officer.data().userCode,
      userName: officer.data().name,
      userRole: role,
      binId: bin.id,
      binCode: bin.data().code,
      binLocation: bin.data().location,
      scannedAt,
    });

    return NextResponse.json({
      ok: true,
      alreadyScanned: false,
      attendanceId: ref.id,
      userName: officer.data().name,
      userRole: role,
      binLocation: bin.data().location,
      scannedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[attendance] error:", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
