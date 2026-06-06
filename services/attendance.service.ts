// services/attendance.service.ts
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
  Timestamp,
  limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Attendance } from "@/types/attendance";
import { getOfficerByUserCode } from "@/services/user.service";
import { getBinByCode } from "@/services/pickup.service";

export async function createAttendance(
  userCode: string,
  binCode: string
): Promise<{ ok: boolean; attendance?: Attendance; error?: string }> {
  const [officer, bin] = await Promise.all([
    getOfficerByUserCode(userCode),
    getBinByCode(binCode),
  ]);

  if (!officer) return { ok: false, error: "Petugas tidak ditemukan atau tidak aktif." };
  if (!bin) return { ok: false, error: "Bin tidak ditemukan atau tidak aktif." };

  const docRef = await addDoc(collection(db, "attendances"), {
    userId: officer.id,
    userCode: officer.userCode,
    userName: officer.name,
    userRole: officer.role,
    binId: bin.id,
    binCode: bin.code,
    binLocation: bin.location,
    scannedAt: serverTimestamp(),
  });

  const attendance: Attendance = {
    id: docRef.id,
    userId: officer.id,
    userCode: officer.userCode,
    userName: officer.name,
    userRole: officer.role,
    binId: bin.id,
    binCode: bin.code,
    binLocation: bin.location,
    scannedAt: new Date().toISOString(),
  };

  return { ok: true, attendance };
}

export async function getAttendanceByRange(startDate: Date, endDate: Date): Promise<Attendance[]> {
  const q = query(
    collection(db, "attendances"),
    orderBy("scannedAt", "desc"),
    limit(2000)
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        scannedAt:
          data.scannedAt instanceof Timestamp
            ? data.scannedAt.toDate().toISOString()
            : data.scannedAt,
      } as Attendance;
    })
    .filter((a) => {
      const t = new Date(a.scannedAt).getTime();
      return t >= startDate.getTime() && t <= endDate.getTime();
    });
}

export async function getAttendanceHistory(limitCount: number = 100): Promise<Attendance[]> {
  const q = query(
    collection(db, "attendances"),
    orderBy("scannedAt", "desc"),
    limit(limitCount)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      ...data,
      scannedAt:
        data.scannedAt instanceof Timestamp
          ? data.scannedAt.toDate().toISOString()
          : data.scannedAt,
    } as Attendance;
  });
}
