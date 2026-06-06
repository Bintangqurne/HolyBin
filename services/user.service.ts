// services/user.service.ts
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
import { Officer, OfficerRole } from "@/types/user";
import { generateUserCode } from "@/lib/generateCode";

export async function getOfficers(): Promise<Officer[]> {
  const q = query(collection(db, "users"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      ...data,
      role: (data.role as OfficerRole) ?? "pemulung",
      createdAt:
        data.createdAt instanceof Timestamp
          ? data.createdAt.toDate().toISOString()
          : data.createdAt,
    } as Officer;
  });
}

export async function getOfficerById(id: string): Promise<Officer | null> {
  const snap = await getDoc(doc(db, "users", id));
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    id: snap.id,
    ...data,
    role: (data.role as OfficerRole) ?? "pemulung",
    createdAt:
      data.createdAt instanceof Timestamp
        ? data.createdAt.toDate().toISOString()
        : data.createdAt,
  } as Officer;
}

export async function getOfficerByUserCode(userCode: string): Promise<Officer | null> {
  const q = query(
    collection(db, "users"),
    where("userCode", "==", userCode.toUpperCase().trim()),
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
    role: (data.role as OfficerRole) ?? "pemulung",
    createdAt:
      data.createdAt instanceof Timestamp
        ? data.createdAt.toDate().toISOString()
        : data.createdAt,
  } as Officer;
}

export async function addOfficer(
  name: string,
  phone: string,
  role: OfficerRole = "pemulung"
): Promise<Officer> {
  const userCode = generateUserCode();

  const docRef = await addDoc(collection(db, "users"), {
    userCode,
    name,
    phone,
    role,
    isActive: true,
    createdAt: serverTimestamp(),
  });

  return {
    id: docRef.id,
    userCode,
    name,
    phone,
    role,
    isActive: true,
    createdAt: new Date().toISOString(),
  };
}

export async function deactivateOfficer(id: string): Promise<void> {
  await updateDoc(doc(db, "users", id), { isActive: false });
}
