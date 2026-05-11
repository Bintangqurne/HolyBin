// services/pickup.service.ts
import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  query,
  where,
  orderBy,
  updateDoc,
  serverTimestamp,
  Timestamp,
  limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { UniqueCode, PickupRecord, TrashBin } from "@/types/pickup";
import { generateUniqueCode, getExpiryDate } from "@/lib/generateCode";

// ──────────────────────────────────────────────
// CODES
// ──────────────────────────────────────────────

export async function generateCode(
  binId: string,
  binLocation: string,
  hoursValid: number = 24
): Promise<UniqueCode> {
  const code = generateUniqueCode();
  const expiresAt = getExpiryDate(hoursValid);

  const docRef = await addDoc(collection(db, "codes"), {
    code,
    binId,
    binLocation,
    generatedAt: serverTimestamp(),
    expiresAt: Timestamp.fromDate(expiresAt),
    status: "pending",
  });

  return {
    id: docRef.id,
    code,
    binId,
    binLocation,
    generatedAt: new Date().toISOString(),
    expiresAt: expiresAt.toISOString(),
    status: "pending",
  };
}

export async function verifyCode(
  inputCode: string
): Promise<{ valid: boolean; codeData?: UniqueCode; error?: string }> {
  const normalized = inputCode.toUpperCase().trim();

  const q = query(
    collection(db, "codes"),
    where("code", "==", normalized),
    where("status", "==", "pending"),
    limit(1)
  );

  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    return { valid: false, error: "Kode tidak ditemukan atau sudah digunakan." };
  }

  const codeDoc = snapshot.docs[0];
  const data = codeDoc.data();

  // Check expiry
  const expiresAt =
    data.expiresAt instanceof Timestamp
      ? data.expiresAt.toDate()
      : new Date(data.expiresAt);

  if (new Date() > expiresAt) {
    // Mark as expired
    await updateDoc(doc(db, "codes", codeDoc.id), { status: "expired" });
    return { valid: false, error: "Kode sudah kadaluarsa." };
  }

  return {
    valid: true,
    codeData: {
      id: codeDoc.id,
      ...data,
      generatedAt:
        data.generatedAt instanceof Timestamp
          ? data.generatedAt.toDate().toISOString()
          : data.generatedAt,
      expiresAt: expiresAt.toISOString(),
    } as UniqueCode,
  };
}

export async function getLatestActiveCodeForBin(
  binId: string
): Promise<UniqueCode | null> {
  const q = query(
    collection(db, "codes"),
    where("binId", "==", binId),
    where("status", "==", "pending"),
    limit(1)
  );

  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    return null;
  }

  const codeDoc = snapshot.docs[0];
  const data = codeDoc.data();

  // Check expiry
  const expiresAt =
    data.expiresAt instanceof Timestamp
      ? data.expiresAt.toDate()
      : new Date(data.expiresAt);

  if (new Date() > expiresAt) {
    // Mark as expired
    await updateDoc(doc(db, "codes", codeDoc.id), { status: "expired" });
    return null;
  }

  return {
    id: codeDoc.id,
    ...data,
    generatedAt:
      data.generatedAt instanceof Timestamp
        ? data.generatedAt.toDate().toISOString()
        : data.generatedAt,
    expiresAt: expiresAt.toISOString(),
  } as UniqueCode;
}

export async function confirmPickup(
  codeId: string,
  officerName: string,
  officerPhone: string,
  binId: string,
  binLocation: string,
  code: string,
  notes?: string,
  weight?: number
): Promise<PickupRecord> {
  const now = new Date();

  // Mark code as completed (only if it is a real unique code, not a static QR scan)
  if (codeId && codeId !== "STATIC_QR") {
    await updateDoc(doc(db, "codes", codeId), {
      status: "completed",
      usedBy: officerName,
      usedAt: serverTimestamp(),
    });
  }

  // Create pickup record
  const recordRef = await addDoc(collection(db, "pickups"), {
    codeId: codeId || "STATIC_QR",
    code: code || "QR-SCAN",
    binId,
    binLocation,
    officerName,
    officerPhone,
    pickedUpAt: serverTimestamp(),
    notes: notes || "",
    weight: weight || null,
  });

  return {
    id: recordRef.id,
    codeId: codeId || "STATIC_QR",
    code: code || "QR-SCAN",
    binId,
    binLocation,
    officerName,
    officerPhone,
    pickedUpAt: now.toISOString(),
    notes,
    weight,
  };
}

// ──────────────────────────────────────────────
// HISTORY
// ──────────────────────────────────────────────

export async function getPickupHistory(
  limitCount: number = 50
): Promise<PickupRecord[]> {
  const q = query(
    collection(db, "pickups"),
    orderBy("pickedUpAt", "desc"),
    limit(limitCount)
  );
  const snapshot = await getDocs(q);

  return snapshot.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      ...data,
      pickedUpAt:
        data.pickedUpAt instanceof Timestamp
          ? data.pickedUpAt.toDate().toISOString()
          : data.pickedUpAt,
    } as PickupRecord;
  });
}

export async function getAllCodes(): Promise<UniqueCode[]> {
  const q = query(collection(db, "codes"), orderBy("generatedAt", "desc"), limit(100));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      ...data,
      generatedAt:
        data.generatedAt instanceof Timestamp
          ? data.generatedAt.toDate().toISOString()
          : data.generatedAt,
      expiresAt:
        data.expiresAt instanceof Timestamp
          ? data.expiresAt.toDate().toISOString()
          : data.expiresAt,
    } as UniqueCode;
  });
}

// ──────────────────────────────────────────────
// BINS
// ──────────────────────────────────────────────

export async function getTrashBins(): Promise<TrashBin[]> {
  const q = query(
    collection(db, "bins"),
    where("isActive", "==", true)
  );
  const snapshot = await getDocs(q);

  const bins = snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
    createdAt:
      d.data().createdAt instanceof Timestamp
        ? d.data().createdAt.toDate().toISOString()
        : d.data().createdAt,
  })) as TrashBin[];

  // Urutkan berdasarkan lokasi secara alfabetis di sisi klien untuk menghindari kebutuhan Composite Index di Firestore
  return bins.sort((a, b) => a.location.localeCompare(b.location));
}

export async function getTrashBinById(binId: string): Promise<TrashBin | null> {
  const docSnap = await getDoc(doc(db, "bins", binId));
  if (!docSnap.exists() || !docSnap.data().isActive) {
    return null;
  }
  return {
    id: docSnap.id,
    ...docSnap.data(),
    createdAt:
      docSnap.data().createdAt instanceof Timestamp
        ? docSnap.data().createdAt.toDate().toISOString()
        : docSnap.data().createdAt,
  } as TrashBin;
}

export async function addTrashBin(
  location: string,
  address: string,
  capacity: number
): Promise<TrashBin> {
  const docRef = await addDoc(collection(db, "bins"), {
    location,
    address,
    capacity,
    isActive: true,
    createdAt: serverTimestamp(),
  });

  return {
    id: docRef.id,
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
  const [pickupsSnap, codesSnap, binsSnap] = await Promise.all([
    getDocs(collection(db, "pickups")),
    getDocs(query(collection(db, "codes"), where("status", "==", "pending"))),
    getDocs(query(collection(db, "bins"), where("isActive", "==", true))),
  ]);

  // Today's pickups
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayPickups = pickupsSnap.docs.filter((d) => {
    const data = d.data();
    const t =
      data.pickedUpAt instanceof Timestamp
        ? data.pickedUpAt.toDate()
        : new Date(data.pickedUpAt);
    return t >= today;
  }).length;

  return {
    totalPickups: pickupsSnap.size,
    todayPickups,
    activeCodes: codesSnap.size,
    totalBins: binsSnap.size,
  };
}
