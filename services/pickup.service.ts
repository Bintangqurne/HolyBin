// services/pickup.service.ts — bin management only
import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  query,
  where,
  serverTimestamp,
  Timestamp,
  limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { TrashBin } from "@/types/pickup";
import { generateBinCode } from "@/lib/generateCode";

// ──────────────────────────────────────────────
// BINS
// ──────────────────────────────────────────────

export async function getTrashBins(): Promise<TrashBin[]> {
  const q = query(collection(db, "bins"), where("isActive", "==", true));
  const snapshot = await getDocs(q);

  const bins = snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
    createdAt:
      d.data().createdAt instanceof Timestamp
        ? d.data().createdAt.toDate().toISOString()
        : d.data().createdAt,
  })) as TrashBin[];

  return bins.sort((a, b) => a.location.localeCompare(b.location));
}

export async function getTrashBinById(binId: string): Promise<TrashBin | null> {
  const docSnap = await getDoc(doc(db, "bins", binId));
  if (!docSnap.exists() || !docSnap.data().isActive) return null;
  const data = docSnap.data();
  return {
    id: docSnap.id,
    ...data,
    createdAt:
      data.createdAt instanceof Timestamp
        ? data.createdAt.toDate().toISOString()
        : data.createdAt,
  } as TrashBin;
}

export async function getBinByCode(binCode: string): Promise<TrashBin | null> {
  const q = query(
    collection(db, "bins"),
    where("code", "==", binCode.toUpperCase().trim()),
    where("isActive", "==", true),
    limit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  const data = d.data();
  return {
    id: d.id,
    ...data,
    createdAt:
      data.createdAt instanceof Timestamp
        ? data.createdAt.toDate().toISOString()
        : data.createdAt,
  } as TrashBin;
}

export async function addTrashBin(
  location: string,
  address: string,
  capacity: number
): Promise<TrashBin> {
  const code = generateBinCode();

  const docRef = await addDoc(collection(db, "bins"), {
    code,
    location,
    address,
    capacity,
    isActive: true,
    createdAt: serverTimestamp(),
  });

  return {
    id: docRef.id,
    code,
    location,
    address,
    capacity,
    isActive: true,
    createdAt: new Date().toISOString(),
  };
}

// ──────────────────────────────────────────────
// STATS
// ──────────────────────────────────────────────

export async function getDashboardStats() {
  const [attendancesSnap, usersSnap, binsSnap] = await Promise.all([
    getDocs(collection(db, "attendances")),
    getDocs(query(collection(db, "users"), where("isActive", "==", true))),
    getDocs(query(collection(db, "bins"), where("isActive", "==", true))),
  ]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayAttendances = attendancesSnap.docs.filter((d) => {
    const data = d.data();
    const t =
      data.scannedAt instanceof Timestamp
        ? data.scannedAt.toDate()
        : new Date(data.scannedAt);
    return t >= today;
  }).length;

  return {
    totalAttendances: attendancesSnap.size,
    todayAttendances,
    activeOfficers: usersSnap.size,
    totalBins: binsSnap.size,
  };
}
